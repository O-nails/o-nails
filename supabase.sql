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
create view public.booked_dates
with (security_invoker = false) as
select booking_date, status
from public.bookings
where status='confirmed';

grant select on public.booked_dates to anon, authenticated;


-- Надёжное публичное создание брони через RPC.
-- Функция сама проверяет правила и возвращает ошибку при занятой дате.
create or replace function public.create_booking(
  p_name text,
  p_booking_date date,
  p_booking_time time,
  p_nail_length text,
  p_design text default null,
  p_removal boolean default false,
  p_correction boolean default false,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if nullif(trim(p_name), '') is null then
    raise exception 'Введите имя';
  end if;

  if p_booking_time <> time '16:00' then
    raise exception 'Время записи должно быть 16:00';
  end if;

  if extract(isodow from p_booking_date) not between 1 and 5 then
    raise exception 'Суббота и воскресенье недоступны';
  end if;

  if p_booking_date < current_date then
    raise exception 'Нельзя выбрать прошедшую дату';
  end if;

  insert into public.bookings (
    name, booking_date, booking_time, nail_length, design, removal, correction, comment, status
  ) values (
    trim(p_name), p_booking_date, time '16:00', p_nail_length, p_design, p_removal, p_correction, p_comment, 'confirmed'
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    raise exception 'Эта дата уже занята';
end;
$$;

grant execute on function public.create_booking(text, date, time, text, text, boolean, boolean, text)
to anon, authenticated;

-- Для публичной RPC-функции не требуются права SELECT/UPDATE/DELETE на bookings.
