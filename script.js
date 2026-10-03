const CFG = window.ONAILES_SUPABASE || {};
const URL = CFG.url;
const KEY = CFG.anonKey;

const form = document.getElementById("bookingForm");
const calendar = document.getElementById("calendar");
const dateInput = document.getElementById("date");
const dateStatus = document.getElementById("dateStatus");
const statusBox = document.getElementById("bookingStatus");
const submit = document.getElementById("submitBtn");

const today = new Date();
today.setHours(0, 0, 0, 0);

let view = new Date(today.getFullYear(), today.getMonth(), 1);
let booked = new Set();
let ready = false;

function isConfigured() {
  return Boolean(URL && KEY && !URL.includes("PASTE_YOUR") && !KEY.includes("PASTE_YOUR"));
}

async function api(path, options = {}) {
  const response = await fetch(URL + path, {
    ...options,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.hint || data?.error_description || text || "Ошибка Supabase"
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fmt(value) {
  const [y, m, d] = value.split("-");
  return `${d}.${m}.${y}`;
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function isPast(date) {
  return date < today;
}

function setDateMessage(text, type = "") {
  dateStatus.textContent = text;
  dateStatus.className = "date-status " + type;
}

function setStatus(text, type = "") {
  statusBox.textContent = text;
  statusBox.className = "status show " + type;
}

function monthName(date) {
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    .replace(/^./, char => char.toUpperCase());
}

function renderCalendar() {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canPrev = view > minMonth;

  let html = `
    <div class="cal-top">
      <div class="cal-title">${monthName(view)}</div>
      <div class="cal-nav">
        <button type="button" id="prevMonth" ${canPrev ? "" : "disabled"} aria-label="Предыдущий месяц">‹</button>
        <button type="button" id="nextMonth" aria-label="Следующий месяц">›</button>
      </div>
    </div>
    <div class="week">
      <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
    </div>
    <div class="days">`;

  for (let i = 0; i < offset; i++) {
    html += '<button class="day mutedday" type="button" tabindex="-1" aria-hidden="true"></button>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const value = iso(date);
    const weekend = isWeekend(date);
    const past = isPast(date);
    const busy = booked.has(value);
    const selected = dateInput.value === value;
    const disabled = !ready || weekend || past || busy;

    const classes = [
      "day",
      weekend ? "weekend" : "",
      busy ? "booked" : "",
      selected ? "selected" : ""
    ].filter(Boolean).join(" ");

    let label = `${day}`;
    if (busy) label += " — занято";
    else if (weekend) label += " — выходной";
    else if (past) label += " — прошедшая дата";

    html += `<button class="${classes}" type="button" data-date="${value}" ${disabled ? "disabled" : ""} aria-label="${label}">${day}</button>`;
  }

  html += "</div>";
  calendar.innerHTML = html;

  calendar.querySelector("#prevMonth")?.addEventListener("click", () => {
    if (!canPrev) return;
    view = new Date(year, month - 1, 1);
    renderCalendar();
  });

  calendar.querySelector("#nextMonth")?.addEventListener("click", () => {
    view = new Date(year, month + 1, 1);
    renderCalendar();
  });

  calendar.querySelectorAll("[data-date]").forEach(button => {
    button.addEventListener("click", () => selectDate(button.dataset.date));
  });
}

function selectDate(value) {
  const date = new Date(value + "T00:00:00");
  if (!ready || isWeekend(date) || isPast(date) || booked.has(value)) return;

  dateInput.value = value;
  renderCalendar();
  setDateMessage(`Выбрано: ${fmt(value)} · 16:00`, "free");
  setStatus("", "");
}

async function loadBookings() {
  renderCalendar();

  if (!isConfigured()) {
    setDateMessage("Нет подключения к Supabase.", "error");
    return;
  }

  setDateMessage("Проверяем свободные даты…", "info");

  try {
    const rows = await api("/rest/v1/booked_dates?select=booking_date,status");
    booked = new Set(
      (rows || [])
        .filter(row => row.status === "confirmed")
        .map(row => row.booking_date)
    );
    ready = true;
    submit.disabled = false;
    setDateMessage("Свободные будни загружены.", "free");
    renderCalendar();
  } catch (error) {
    console.error("ОШИБКА КАЛЕНДАРЯ:", error);
    ready = false;
    submit.disabled = true;
    setDateMessage("Не удалось загрузить свободные даты. Проверьте подключение Supabase.", "error");
    renderCalendar();
  }
}

function buildTelegramText({ name, date, length, design, removal, correction, comment }) {
  return [
    "Здравствуйте! Хочу записаться на маникюр 💗",
    "",
    `Имя: ${name}`,
    `Дата: ${fmt(date)}`,
    "Время: 16:00",
    `Длина: ${length}`,
    `Дизайн: ${design}`,
    `Снятие: ${removal ? "да" : "нет"}`,
    `Коррекция: ${correction ? "да" : "нет"}`,
    `Комментарий: ${comment}`,
    "",
    "Дата уже забронирована через сайт O.nails."
  ].join("\n");
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!ready) {
    setStatus("Система бронирования пока не подключена.", "err");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const date = dateInput.value;
  const length = document.querySelector('input[name="length"]:checked')?.value;
  const design = document.getElementById("design").value.trim() || "пришлю фото / обсудим";
  const removal = document.getElementById("removal").checked;
  const correction = document.getElementById("correction").checked;
  const comment = document.getElementById("comment").value.trim() || "нет";

  if (!name) {
    setStatus("Введите имя.", "err");
    document.getElementById("name").focus();
    return;
  }

  if (!date || !length) {
    setStatus("Выберите дату и длину ногтей.", "err");
    return;
  }

  const dateObject = new Date(date + "T00:00:00");

  if (isWeekend(dateObject)) {
    setDateMessage("Суббота и воскресенье недоступны.", "busy");
    return;
  }

  if (booked.has(date)) {
    setDateMessage("Эта дата уже занята.", "busy");
    renderCalendar();
    return;
  }

  submit.disabled = true;
  submit.textContent = "Бронируем…";
  setStatus("Проверяем дату и сохраняем запись…", "info");

  try {
    await api("/rest/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        name,
        booking_date: date,
        booking_time: "16:00",
        nail_length: length,
        design,
        removal,
        correction,
        comment,
        status: "confirmed"
      })
    });

    booked.add(date);
    renderCalendar();
    setDateMessage(`Дата ${fmt(date)} забронирована · 16:00`, "free");
    setStatus("Готово! Дата закреплена. Сейчас откроется Telegram.", "ok");

    const telegramText = buildTelegramText({ name, date, length, design, removal, correction, comment });

    try {
      await navigator.clipboard.writeText(telegramText);
    } catch (copyError) {
      console.warn("Clipboard unavailable:", copyError);
    }

    setTimeout(() => {
      window.location.href = "https://t.me/olkadolka228";
    }, 450);
  } catch (error) {
    console.error(error);

    if (error.status === 409) {
      booked.add(date);
      dateInput.value = "";
      renderCalendar();
      setDateMessage("Эту дату только что забронировала другая клиентка. Выберите другую.", "busy");
      setStatus("Бронь не создана: дата уже занята.", "err");
    } else {
      setStatus("Не получилось сохранить бронь. Проверьте подключение Supabase.", "err");
    }
  } finally {
    submit.disabled = !ready;
    submit.textContent = "Забронировать дату и открыть Telegram ↗";
  }
});

loadBookings();
