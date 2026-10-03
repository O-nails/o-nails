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

const api = async (path, opt = {}) => {
  const r = await fetch(URL + path, {
    ...opt,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      ...(opt.headers || {})
    }
  });

  const text = await r.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  if (!r.ok) {
    const error = new Error(
      data?.message ||
      data?.hint ||
      data?.error_description ||
      text ||
      "Ошибка Supabase"
    );

    error.status = r.status;
    throw error;
  }

  return data;
};

const iso = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmt = v => {
  const [y, m, d] = v.split("-");
  return `${d}.${m}.${y}`;
};

const weekend = d => d.getDay() === 0 || d.getDay() === 6;
const past = d => d < today;

function msg(text, type = "") {
  dateStatus.textContent = text;
  dateStatus.className = "date-status " + type;
}

function status(text, type = "") {
  statusBox.textContent = text;
  statusBox.className = "status show " + type;
}

function monthName(d) {
  return d
    .toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric"
    })
    .replace(/^./, c => c.toUpperCase());
}

function render() {
  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const off = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canPrev = view > minMonth;

  let s = `<div class="calhead">
    <strong>${monthName(view)}</strong>
    <div class="calnav">
      <button type="button" id="prev" ${canPrev ? "" : "disabled"}>‹</button>
      <button type="button" id="next">›</button>
    </div>
  </div>
  <div class="week">
    <div>Пн</div><div>Вт</div><div>Ср</div>
    <div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
  </div><div class="days">`;

  for (let i = 0; i < off; i++) {
    s += '<button class="day mutedday" type="button" tabindex="-1"></button>';
  }

  for (let day = 1; day <= days; day++) {
    const d = new Date(y, m, day);
    const v = iso(d);
    const w = weekend(d);
    const p = past(d);
    const b = booked.has(v);
    const sel = dateInput.value === v;
    const dis = !ready || w || p || b;

    s += `<button class="day ${w ? "weekend " : ""}${b ? "booked " : ""}${sel ? "selected" : ""}" type="button" data-date="${v}" ${dis ? "disabled" : ""}>${day}</button>`;
  }

  calendar.innerHTML = s + "</div>";

  calendar.querySelector("#prev")?.addEventListener("click", () => {
    if (canPrev) {
      view = new Date(y, m - 1, 1);
      render();
    }
  });

  calendar.querySelector("#next")?.addEventListener("click", () => {
    view = new Date(y, m + 1, 1);
    render();
  });

  calendar.querySelectorAll("[data-date]").forEach(b =>
    b.addEventListener("click", () => select(b.dataset.date))
  );
}

function select(v) {
  const d = new Date(v + "T00:00:00");

  if (!ready || weekend(d) || past(d) || booked.has(v)) return;

  dateInput.value = v;
  render();
  msg("Выбрано: " + fmt(v) + " · 16:00", "free");
}

async function load() {
  render();

  if (!URL || !KEY) {
    msg("Нет подключения к Supabase. Проверь настройки.", "error");
    return;
  }

  msg("Загружаем свободные даты…", "info");

  try {
    const response = await fetch(
      URL + "/rest/v1/booked_dates?select=booking_date,status",
      {
        method: "GET",
        headers: {
          apikey: KEY,
          Authorization: "Bearer " + KEY,
          "Content-Type": "application/json"
        }
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        "Supabase HTTP " + response.status + ": " + text
      );
    }

    let rows = [];

    try {
      rows = text ? JSON.parse(text) : [];
    } catch {
      throw new Error("Supabase вернул неверный ответ: " + text);
    }

    booked = new Set(
      rows
        .filter(row => row.status === "confirmed")
        .map(row => row.booking_date)
    );

    ready = true;
    submit.disabled = false;

    msg("Свободные будни загружены.", "free");
    render();

  } catch (error) {
    console.error("Ошибка календаря:", error);

    ready = false;
    submit.disabled = true;

    msg("Ошибка загрузки дат: " + error.message, "error");
    render();
  }
}

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!ready) {
    status("Система бронирования не подключена.", "err");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const date = dateInput.value;
  const length = document.querySelector('input[name="length"]:checked')?.value;
  const design = document.getElementById("design").value.trim() || "пришлю фото / обсудим";
  const removal = document.getElementById("removal").checked;
  const correction = document.getElementById("correction").checked;
  const comment = document.getElementById("comment").value.trim() || "нет";

  if (!date || !length) {
    status("Выберите дату и длину ногтей.", "err");
    return;
  }

  const d = new Date(date + "T00:00:00");

  if (weekend(d)) {
    msg("Суббота и воскресенье недоступны.", "busy");
    return;
  }

  if (booked.has(date)) {
    msg("Эта дата уже занята.", "busy");
    render();
    return;
  }

  submit.disabled = true;
  submit.textContent = "Бронируем…";
  status("Проверяем дату и сохраняем запись…", "info");

  try {
    await api("/rest/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
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
    render();

    msg(`Дата ${fmt(date)} забронирована · 16:00`, "free");
    status("Готово! Дата закреплена. Открываем Telegram.", "ok");

    const telegramText = [
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

    try {
      await navigator.clipboard.writeText(telegramText);
    } catch (copyError) {
      console.error(copyError);
    }

    window.location.href = "https://t.me/olkadolka228";

  } catch (err) {
    if (err.status === 409) {
      booked.add(date);
      dateInput.value = "";
      render();

      msg(
        "Эту дату только что забронировала другая клиентка. Выберите другую.",
        "busy"
      );

      status("Бронь не создана: дата уже занята.", "err");
    } else {
      status(
        "Не получилось сохранить бронь. Проверьте Supabase.",
        "err"
      );
    }

    console.error(err);

  } finally {
    submit.disabled = false;
    submit.textContent = "Забронировать дату и открыть Telegram ↗";
  }
});

render();
load();
