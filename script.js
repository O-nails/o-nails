(() => {
  "use strict";

  const CFG = window.ONAILES_SUPABASE || {};
  const SUPABASE_URL = String(CFG.url || "").replace(/\/$/, "");
  const SUPABASE_KEY = String(CFG.anonKey || "");

  const form = document.getElementById("bookingForm");
  const calendar = document.getElementById("calendar");
  const dateInput = document.getElementById("date");
  const dateStatus = document.getElementById("dateStatus");
  const statusBox = document.getElementById("bookingStatus");
  const submit = document.getElementById("submitBtn");
  const summaryDate = document.getElementById("summaryDate");
  const summaryLength = document.getElementById("summaryLength");
  const nameInput = document.getElementById("name");
  const telegramUsernameInput = document.getElementById("telegramUsername");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let booked = new Set();
  let ready = false;

  const prices = {
    "1–2": "1 300 ₽",
    "3–5": "1 500 ₽",
    "6–7": "1 700 ₽",
    "8+": "2 000 ₽"
  };

  function isConfigured() {
    return Boolean(
      SUPABASE_URL &&
      SUPABASE_KEY &&
      !SUPABASE_URL.includes("PASTE_YOUR") &&
      !SUPABASE_KEY.includes("PASTE_YOUR")
    );
  }

  async function api(path, options = {}) {
    if (!isConfigured()) {
      const error = new Error("Supabase не настроен.");
      error.status = 0;
      throw error;
    }

    const response = await fetch(SUPABASE_URL + path, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.hint ||
        data?.details ||
        data?.error_description ||
        text ||
        "Ошибка Supabase";
      const error = new Error(message);
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
    if (!dateStatus) return;
    dateStatus.textContent = text;
    dateStatus.className = "date-status " + type;
  }

  function setStatus(text, type = "") {
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.className = "status show " + type;
  }

  function monthName(date) {
    return date
      .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/^./, char => char.toUpperCase());
  }

  function updateSummary() {
    if (!summaryDate || !summaryLength) return;
    summaryDate.textContent = dateInput?.value
      ? `${fmt(dateInput.value)} · 16:00`
      : "не выбрана";
    const selected = document.querySelector('input[name="length"]:checked')?.value;
    summaryLength.textContent = selected
      ? `${selected} · ${prices[selected]}`
      : "не выбрана";
  }

  function selectLength(value, shouldScroll = false) {
    const input = Array.from(document.querySelectorAll('input[name="length"]'))
      .find(item => item.value === value);
    if (!input) return;
    input.checked = true;
    updateSummary();
    if (shouldScroll) {
      document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderCalendar() {
    if (!calendar || !dateInput) return;

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
      <div class="week"><div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div></div>
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
    updateSummary();
    setDateMessage(`Выбрано: ${fmt(value)} · 16:00`, "free");
    setStatus("", "");
  }

  async function loadBookings() {
    renderCalendar();
    updateSummary();

    if (!isConfigured()) {
      ready = false;
      if (submit) submit.disabled = true;
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
      if (submit) submit.disabled = false;
      setDateMessage("Свободные будни загружены.", "free");
      renderCalendar();
    } catch (error) {
      console.error("ОШИБКА КАЛЕНДАРЯ:", error);
      ready = false;
      if (submit) submit.disabled = true;
      setDateMessage("Не удалось загрузить свободные даты. Проверьте подключение Supabase.", "error");
      renderCalendar();
    }
  }

  function normalizeTelegramUsername(value) {
    const clean = String(value || "").trim();
    if (!clean) return "не указан";
    return clean.startsWith("@") ? clean : "@" + clean;
  }

  function buildTelegramText({ name, telegramUsername, date, length, design, removal, correction, comment }) {
    return [
      "Здравствуйте! Хочу записаться на маникюр 💗",
      "",
      `Имя: ${name}`,
      `Telegram: ${normalizeTelegramUsername(telegramUsername)}`,
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

  if (form) {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!ready) {
        setStatus("Система бронирования пока не подключена.", "err");
        return;
      }

      const name = nameInput?.value.trim() || "";
      const telegramUsername = telegramUsernameInput?.value.trim() || "";
      const date = dateInput?.value || "";
      const length = document.querySelector('input[name="length"]:checked')?.value || "";
      const design = document.getElementById("design")?.value.trim() || "пришлю фото / обсудим";
      const removal = Boolean(document.getElementById("removal")?.checked);
      const correction = Boolean(document.getElementById("correction")?.checked);
      const comment = document.getElementById("comment")?.value.trim() || "нет";

      if (!name) {
        setStatus("Введите имя.", "err");
        nameInput?.focus();
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
        await api("/rest/v1/rpc/create_booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            p_name: name,
            p_booking_date: date,
            p_booking_time: "16:00",
            p_nail_length: length,
            p_design: design,
            p_removal: removal,
            p_correction: correction,
            p_comment: comment
          })
        });

        booked.add(date);
        renderCalendar();
        updateSummary();
        setDateMessage(`Дата ${fmt(date)} забронирована · 16:00`, "free");
        setStatus("Готово! Дата закреплена. Сейчас откроется Telegram.", "ok");

        const telegramText = buildTelegramText({
          name,
          telegramUsername,
          date,
          length,
          design,
          removal,
          correction,
          comment
        });

        // Безопасно используем встроенный конструктор URL, не создавая
        // локальную переменную с именем URL.
        const telegramUrl = new globalThis.URL("https://t.me/olkadolka228");
        telegramUrl.searchParams.set("text", telegramText);

        setTimeout(() => {
          window.location.assign(telegramUrl.toString());
        }, 250);
      } catch (error) {
        console.error("ОШИБКА БРОНИ:", error);

        const message = String(error?.message || "");
        const isBusyDate =
          error?.status === 409 ||
          /дата уже занята|already exists|duplicate|unique/i.test(message);

        if (isBusyDate) {
          booked.add(date);
          dateInput.value = "";
          renderCalendar();
          updateSummary();
          setDateMessage("Эту дату только что забронировала другая клиентка. Выберите другую.", "busy");
          setStatus("Бронь не создана: дата уже занята.", "err");
        } else {
          const details = message ? ` (${message})` : "";
          setStatus(`Не получилось сохранить бронь.${details}`, "err");
        }
      } finally {
        submit.disabled = !ready;
        submit.textContent = "Забронировать дату и открыть Telegram ↗";
      }
    });
  }

  document.querySelectorAll('input[name="length"]').forEach(input => {
    input.addEventListener("change", updateSummary);
  });

  document.querySelectorAll(".price-action[data-length]").forEach(button => {
    button.addEventListener("click", () => selectLength(button.dataset.length, true));
  });

  // All page sections are visible by default; this class is only a marker now.
  document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));

  updateSummary();
  loadBookings();
})();
