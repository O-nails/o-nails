O.nails — исправленная версия

Исправлено:
- ошибка "URL is not a constructor" устранена;
- Supabase URL теперь хранится в переменной SUPABASE_URL, без конфликта с глобальным URL;
- после успешной брони открывается Telegram @olkadolka228 с уже заполненным текстом заявки;
- время записи 16:00;
- только будние дни;
- одна подтверждённая запись на дату;
- браузер загружает новую версию script.js?v=7.

Файлы для GitHub Pages:
index.html
script.js
price-menu.jpg

SQL для Supabase:
supabase.sql

Важно: в index.html уже указаны текущие Supabase URL и publishable/anon key из проекта. Никогда не размещайте service_role/secret key на сайте.
