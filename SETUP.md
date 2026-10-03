O.nails — НОРМАЛЬНОЕ БРОНИРОВАНИЕ
=====================================

Готовые правила:
• время строго 16:00;
• суббота и воскресенье нельзя выбрать;
• одна запись на одну дату;
• после брони дата сразу занята для всех клиентов;
• база данных защищает от двойной брони при одновременных кликах;
• посетители видят только занятые даты, а не данные других клиентов;
• после успешной брони открывается Telegram @olkadolka228.

НАСТРОЙКА

1. Создайте проект на https://supabase.com/
2. Supabase → SQL Editor → New query.
3. Скопируйте весь файл supabase.sql и нажмите Run.
4. Supabase → Project Settings → API.
5. Возьмите Project URL и anon/publishable key.
6. Откройте index.html и в самом низу найдите:

window.ONAILES_SUPABASE={
  url:"PASTE_YOUR_SUPABASE_PROJECT_URL_HERE",
  anonKey:"PASTE_YOUR_SUPABASE_ANON_KEY_HERE"
};

Вставьте свои значения.

НИКОГДА не вставляйте service_role/secret key в сайт.

GITHUB PAGES

Загрузите в репозиторий:
index.html
script.js
assets/price-menu.jpg

В GitHub:
Settings → Pages → Deploy from a branch → main → / (root) → Save.

ПРОВЕРКА

• Сб/Вс в календаре серые и недоступны.
• Время всегда 16:00 и не редактируется.
• После записи дата становится занятой для всех.
• Вторая попытка на ту же дату получает сообщение, что дата занята.
• Supabase → Table Editor → bookings покажет запись.

ОТМЕНА

Чтобы освободить дату, откройте Supabase → Table Editor → bookings
и поменяйте status у записи с confirmed на cancelled.

ПОЧЕМУ ЭТО ДЕЙСТВИТЕЛЬНОЕ БРОНИРОВАНИЕ

Календарь получает занятые даты из Supabase, а при сохранении база
ставит уникальность на booking_date. Поэтому даже две клиентки,
нажавшие кнопку почти одновременно, не смогут занять один день.
