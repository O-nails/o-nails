O.NAILS — АВТОМАТИЧЕСКАЯ ОТПРАВКА ЗАЯВКИ В TELEGRAM
====================================================

Что изменено:
- бронь создаётся через RPC create_booking;
- после успешной брони сайт автоматически вызывает Edge Function;
- Edge Function отправляет готовый текст в Telegram через бота;
- клиенту всё равно открывается Telegram с готовым текстом как резервный вариант;
- токен Telegram НИКОГДА не находится в index.html или script.js.

ФАЙЛЫ:
index.html
script.js
price-menu.jpg
supabase.sql
SETUP.md
supabase/functions/send-booking-telegram/index.ts

ВАЖНО — ОДИН РАЗ НАСТРОИТЬ SUPABASE:

1. Supabase → Edge Functions → send-booking-telegram.
2. В Code замените index.ts содержимым из:
   supabase/functions/send-booking-telegram/index.ts
3. Нажмите Deploy.
4. Откройте Secrets/Function Secrets.
5. Добавьте:
   TELEGRAM_BOT_TOKEN = токен вашего Telegram-бота
   TELEGRAM_CHAT_ID = ID чата, куда бот должен присылать заявки
6. Если эти Secrets уже созданы — повторно вводить их не нужно.

Как получить TELEGRAM_CHAT_ID:
- отправьте любое сообщение боту/в нужный чат;
- затем можно получить ID через getUpdates или использовать уже известный ID.

Не вставляйте TELEGRAM_BOT_TOKEN в сайт, GitHub или index.html.

ПОСЛЕ НАСТРОЙКИ:
Клиент нажимает «Забронировать дату» → дата сохраняется → текст автоматически уходит в Telegram владельцу → клиенту открывается Telegram с готовым текстом.
