-- O.nails: add Telegram username to bookings
alter table public.bookings
  add column if not exists telegram_username text;

-- Existing RLS insert policy remains valid; this field is optional.
