-- O.nails: robust Supabase booking setup / migration
-- Run this ENTIRE file in Supabase -> SQL Editor -> Run.

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  booking_date date not null,
  booking_time time not null default time '16:00',
  nail_length text not null,
  design text,
  removal boolean not null default false,
  correction boolean not null default false,
  comment text,
  status text not null default 'confirmed'
);

-- If the table already existed with an older schema, make sure all fields exist.
alter table public.bookings add column if not exists created_at timestamptz not null default now();
alter table public.bookings add column if not exists name text;
alter table public.bookings add column if not exists booking_date date;
alter table public.bookings add column if not exists booking_time time;
alter table public.bookings add column if not exists nail_length text;
alter table public.bookings add column if not exists design text;
alter table public.bookings add column if not exists removal boolean;
alter table public.bookings add column if not exists correction boolean;
alter table public.bookings add column if not exists comment text;
alter table public.bookings add column if not exists status text;

update public.bookings set booking_time = time '16:00' where booking_time is null;
update public.bookings set removal = false where removal is null;
update public.bookings set correction = false where correction is null;
update public.bookings set status = 'confirmed' where status is null;

alter table public.bookings alter column booking_time set default time '16:00';
alter table public.bookings alter column removal set default false;
alter table public.bookings alter column correction set default false;
alter table public.bookings alter column status set default 'confirmed';

-- Remove conflicting old constraints and recreate the business rules.
alter table public.bookings drop constraint if exists bookings_weekday_check;
alter table public.bookings add constraint bookings_weekday_check
check (extract(isodow from booking_date) between 1 and 5);

alter table public.bookings drop constraint if exists bookings_fixed_time_check;
alter table public.bookings add constraint bookings_fixed_time_check
check (booking_time = time '16:00');

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
check (status in ('confirmed','cancelled'));

-- One confirmed booking per day.
create unique index if not exists bookings_one_confirmed_per_date
on public.bookings (booking_date)
where status = 'confirmed';

-- RLS protects the table. The public website uses the RPC below for inserts.
alter table public.bookings enable row level security;

revoke all on public.bookings from anon, authenticated;

-- Public calendar: only date + status, never names/comments.
drop view if exists public.booked_dates;
create view public.booked_dates as
select booking_date, status
from public.bookings
where status = 'confirmed';

grant select on public.booked_dates to anon, authenticated;

-- Atomic booking function. It validates the rules server-side and lets the
-- unique index reject simultaneous bookings for the same date.
drop function if exists public.create_booking(text,date,time,text,text,boolean,boolean,text);

create function public.create_booking(
  p_name text,
  p_booking_date date,
  p_booking_time time,
  p_nail_length text,
  p_design text default null,
  p_removal boolean default false,
  p_correction boolean default false,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;

  if p_booking_date < current_date then
    raise exception 'DATE_IN_PAST';
  end if;

  if extract(isodow from p_booking_date) not between 1 and 5 then
    raise exception 'WEEKDAY_ONLY';
  end if;

  if p_booking_time <> time '16:00' then
    raise exception 'FIXED_TIME_ONLY';
  end if;

  if p_nail_length not in ('1–2','3–5','6–7','8+') then
    raise exception 'INVALID_NAIL_LENGTH';
  end if;

  insert into public.bookings (
    name, booking_date, booking_time, nail_length,
    design, removal, correction, comment, status
  ) values (
    trim(p_name), p_booking_date, p_booking_time, p_nail_length,
    nullif(trim(p_design), ''), coalesce(p_removal,false),
    coalesce(p_correction,false), nullif(trim(p_comment), ''), 'confirmed'
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);

exception
  when unique_violation then
    raise exception 'DATE_ALREADY_BOOKED';
end;
$$;

grant execute on function public.create_booking(text,date,time,text,text,boolean,boolean,text)
to anon, authenticated;

-- Do not expose the underlying customer table through PostgREST.
revoke all on public.bookings from anon, authenticated;
