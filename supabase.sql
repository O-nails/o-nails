-- O.nails booking database
-- Supabase -> SQL Editor -> Run this whole file.

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
    check (status in ('confirmed','cancelled'))
);

-- Real protection against double booking.
create unique index if not exists bookings_one_confirmed_per_date
on public.bookings (booking_date)
where status='confirmed';

-- Business rules: weekdays only + fixed time 16:00.
alter table public.bookings drop constraint if exists bookings_weekday_check;
alter table public.bookings add constraint bookings_weekday_check
check (extract(isodow from booking_date) between 1 and 5);

alter table public.bookings drop constraint if exists bookings_fixed_time_check;
alter table public.bookings add constraint bookings_fixed_time_check
check (booking_time = time '16:00');

alter table public.bookings enable row level security;

drop policy if exists "Public can insert bookings" on public.bookings;
create policy "Public can insert bookings"
on public.bookings
for insert to anon, authenticated
with check (
  status='confirmed'
  and booking_time=time '16:00'
  and extract(isodow from booking_date) between 1 and 5
);

grant insert on public.bookings to anon, authenticated;

-- Do NOT expose customer names/comments publicly.
revoke select, update, delete on public.bookings from anon, authenticated;

-- Public calendar gets only occupied dates.
drop view if exists public.booked_dates;
create view public.booked_dates as
select booking_date, status
from public.bookings
where status='confirmed';

grant select on public.booked_dates to anon, authenticated;
