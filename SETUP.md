# O.nails — запуск

## Файлы
- `index.html` — сайт
- `script.js` — календарь и бронирование
- `price-menu.jpg` — изображение прайса
- `supabase.sql` — база данных и RPC для безопасной брони

## 1. Supabase
Откройте Supabase → **SQL Editor** → вставьте **весь** `supabase.sql` → **Run**.

Скрипт создаёт таблицу `bookings`, календарь занятых дат и функцию `create_booking`, которая не позволяет двум клиентам забронировать одну дату.

## 2. Ключи
В `index.html` внизу должны быть ваши Project URL и publishable/anon key:

```js
window.ONAILES_SUPABASE = {
  url: "https://ВАШ-ПРОЕКТ.supabase.co",
  anonKey: "ВАШ-PUBLISHABLE-KEY"
};
```

`service_role` / secret key в сайт вставлять нельзя.

## 3. GitHub Pages
Загрузите в корень репозитория все 4 файла:
- `index.html`
- `script.js`
- `price-menu.jpg`
- `supabase.sql`

После публикации откройте сайт заново с очисткой кэша. Скрипт подключается как `script.js?v=6`.

## Правила брони
- только Пн–Пт;
- время всегда 16:00;
- одна подтверждённая бронь на дату;
- после успешной брони открывается Telegram `@olkadolka228` с заполненным сообщением.
