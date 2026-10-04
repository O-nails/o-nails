O.nails — версия с Telegram username

Файлы:
- index.html — добавлено поле Telegram username.
- script.js — сохраняет username в Supabase и передаёт его в Edge Function.
- O.nails-telegram-username.sql — один раз добавить колонку telegram_username в bookings.
- supabase/functions/send-booking-telegram/index.ts — готовая Edge Function для автоматической отправки заявки в Telegram.

ВАЖНО:
1. В Supabase SQL Editor выполните O.nails-telegram-username.sql.
2. В Edge Function Secrets должны быть:
   TELEGRAM_BOT_TOKEN = токен бота
   TELEGRAM_CHAT_ID = ID чата, куда бот отправляет заявку
3. Вставьте index.ts в send-booking-telegram и нажмите Deploy updates.
4. После этого на сайте клиент вводит @username в поле Telegram username.
5. После бронирования запись сохраняется в Supabase, а Edge Function автоматически отправляет заявку в Telegram.
6. Сайт также открывает Telegram с готовым текстом как дополнительный вариант.

Токены и секреты в этот архив не включены.
