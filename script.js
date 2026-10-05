/* O.nails — add this to your existing script.js.
   It reads Telegram data from the personalized bot link:
   https://o-nails.github.io/o-nails/?tg_id=123&tg_username=%40name
*/

// Put near the top of your existing script.js:
const ONAILS_TELEGRAM_PARAMS = new URLSearchParams(window.location.search);

const ONAILS_TELEGRAM_CHAT_ID =
  ONAILS_TELEGRAM_PARAMS.get("tg_id") || "";

const ONAILS_TELEGRAM_USERNAME =
  ONAILS_TELEGRAM_PARAMS.get("tg_username") || "";

// Then, inside the JSON body sent to
// /functions/v1/send-booking-telegram, add:
//
// telegram_username: ONAILS_TELEGRAM_USERNAME || telegramUsernameFromYourForm,
// telegram_chat_id: ONAILS_TELEGRAM_CHAT_ID || null,
//
// If your form already has a Telegram username field, use its value
// as telegram_username. Do NOT remove the existing field.
(() => {
  "use strict";

  const CFG = window.ONAILES_SUPABASE || {};
  const SUPABASE_URL = CFG.url || "";
  const SUPABASE_KEY = CFG.anonKey || "";
  const FUNCTION_NAME = "send-booking-telegram";

  const form = document.getElementById("bookingForm");
  const calendar = document.getElementById("calendar");
  const dateInput = document.getElementById("date");
  const dateStatus = document.getElementById("dateStatus");
  const statusBox = document.getElementById("bookingStatus");
  const submit = document.getElementById("submitBtn");
  const summaryDate = document.getElementById("summaryDate");
  const summaryLength = document.getElementById("summaryLength");
  const nameInput = document.getElementById("name");

  if (!form || !calendar || !dateInput) {
    console.error("O.nails: booking form elements are missing.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let booked = new Set();
  let ready = false;
  let sending = false;

  const prices = {
    "1–2": "1 300 ₽",
    "3–5": "1 500 ₽",
    "6–7": "1 700 ₽",
    "8+": "2 000 ₽"
  };

  // The current index.html may not yet contain the Telegram username field.
  // Create it automatically so index.html does not need another manual edit.
  let telegramInput = document.getElementById("telegram_username");

  if (!telegramInput && nameInput) {
    const row = document.createElement("div");
    row.className = "form-row";
    row.innerHTML = `
      <div class="num">02</div>
      <div>
        <label class="label" for="telegram_username">Ваш Telegram</label>
        <input
          class="field"
          id="telegram_username"
          name="telegram_username"
          type="text"
          autocomplete="off"
          placeholder="@username"
          maxlength="64"
        >
        <small style="display:block;margin-top:7px;color:#a18791;font-size:10px;">
          Например: @skyezq
        </small>
      </div>
    `;

    const firstRow = nameInput.closest(".form-row");
    if (firstRow) {
      firstRow.insertAdjacentElement("afterend", row);
    } else {
      form.prepend(row);
    }

    telegramInput = row.querySelector("#telegram_username");
  }

  function isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_KEY);
  }

  async function supabaseFetch(path, options = {}) {
    const response = await fetch(SUPABASE_URL + path, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        "Content-Type": "application/json",
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
      throw new Error(
        data?.message ||
        data?.hint ||
        data?.error_description ||
        text ||
        `Supabase HTTP ${response.status}`
      );
    }

    return data;
  }

  function iso(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function fmt(value) {
    if (!value) return "";
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
      .replace(/^./, c => c.toUpperCase());
  }

  function updateSummary() {
    if (summaryDate) {
      summaryDate.textContent = dateInput.value
        ? `${fmt(dateInput.value)} · 16:00`
        : "не выбрана";
    }

    const selected = document.querySelector('input[name="length"]:checked')?.value;

    if (summaryLength) {
      summaryLength.textContent = selected
        ? `${selected} · ${prices[selected] || ""}`
        : "не выбрана";
    }
  }

  function updateSubmitState() {
    if (!submit) return;

    const length = document.querySelector('input[name="length"]:checked')?.value;
    submit.disabled = !(
      ready &&
      !sending &&
      nameInput?.value.trim() &&
      dateInput.value &&
      length
    );
  }

  function render() {
    const y = view.getFullYear();
    const m = view.getMonth();

    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();

    const minMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const canPrev = view > minMonth;

    let html = `
      <div class="calhead">
        <strong>${monthName(view)}</strong>
        <div class="calnav">
          <button type="button" id="prev" ${canPrev ? "" : "disabled"}>‹</button>
          <button type="button" id="next">›</button>
        </div>
      </div>
      <div class="week">
        <div>Пн</div><div>Вт</div><div>Ср</div>
        <div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
      </div>
      <div class="days">
    `;

    for (let i = 0; i < offset; i++) {
      html += '<button class="day mutedday" type="button" tabindex="-1"></button>';
    }

    for (let day = 1; day <= days; day++) {
      const d = new Date(y, m, day);
      const value = iso(d);
      const weekend = isWeekend(d);
      const past = isPast(d);
      const isBooked = booked.has(value);
      const selected = dateInput.value === value;
      const disabled = !ready || weekend || past || isBooked;

      html += `
        <button
          class="day ${weekend ? "weekend " : ""}${isBooked ? "booked " : ""}${selected ? "selected" : ""}"
          type="button"
          data-date="${value}"
          ${disabled ? "disabled" : ""}
        >${day}</button>
      `;
    }

    html += "</div>";
    calendar.innerHTML = html;

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

    calendar.querySelectorAll("[data-date]").forEach(button => {
      button.addEventListener("click", () => selectDate(button.dataset.date));
    });
  }

  function selectDate(value) {
    const date = new Date(value + "T00:00:00");

    if (!ready || isWeekend(date) || isPast(date) || booked.has(value)) {
      return;
    }

    dateInput.value = value;
    render();
    setDateMessage(`Выбрано: ${fmt(value)} · 16:00`, "free");
    setStatus("", "");
    updateSummary();
    updateSubmitState();
  }

  async function loadBookedDates() {
    render();

    if (!isConfigured()) {
      setDateMessage("Нет подключения к Supabase.", "error");
      updateSubmitState();
      return;
    }

    setDateMessage("Проверяем свободные даты…", "info");

    try {
      const rows = await supabaseFetch(
        "/rest/v1/booked_dates?select=booking_date,status"
      );

      booked = new Set(
        (rows || [])
          .filter(row => row.status === "confirmed")
          .map(row => row.booking_date)
      );

      ready = true;
      render();
      setDateMessage("Выберите свободную дату · 16:00", "info");
      updateSubmitState();
    } catch (error) {
      console.error("O.nails calendar error:", error);
      ready = false;
      render();
      setDateMessage("Не удалось загрузить свободные даты.", "error");
      setStatus("Проверьте подключение Supabase.", "error");
      updateSubmitState();
    }
  }

  function normalizeTelegramUsername(value) {
    let username = (value || "").trim();
    if (!username) return "";
    if (!username.startsWith("@")) username = "@" + username;
    return username;
  }

  async function sendBookingToFunction(payload) {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(
        data?.error ||
        data?.message ||
        text ||
        `Edge Function HTTP ${response.status}`
      );
    }

    return data;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (sending) return;

    const name = nameInput?.value.trim() || "";
    const telegramUsername = normalizeTelegramUsername(
      telegramInput?.value || ""
    );
    const bookingDate = dateInput.value;
    const nailLength =
      document.querySelector('input[name="length"]:checked')?.value || "";
    const design = document.getElementById("design")?.value.trim() || "";
    const removal = Boolean(document.getElementById("removal")?.checked);
    const correction = Boolean(document.getElementById("correction")?.checked);
    const comment = document.getElementById("comment")?.value.trim() || "";

    if (!name) {
      setStatus("Введите имя.", "error");
      nameInput?.focus();
      return;
    }

    if (!bookingDate) {
      setStatus("Выберите дату.", "error");
      return;
    }

    if (!nailLength) {
      setStatus("Выберите длину ногтей.", "error");
      return;
    }

    if (booked.has(bookingDate)) {
      setStatus("Эта дата уже занята. Выберите другую.", "error");
      await loadBookedDates();
      return;
    }

    if (!isConfigured()) {
      setStatus("Нет подключения к Supabase.", "error");
      return;
    }

    sending = true;
    updateSubmitState();
    setStatus("Сохраняем бронь и отправляем сообщение в Telegram…", "info");

    const payload = {
      name,
      telegram_username: telegramUsername,
      booking_date: bookingDate,
      booking_time: "16:00",
      nail_length: nailLength,
      design,
      removal,
      correction,
      comment
    };

    try {
      const result = await sendBookingToFunction(payload);

      booked.add(bookingDate);
      render();

      setStatus(
        result?.telegram_sent
          ? "Бронь успешно создана 💗 Сообщение автоматически отправлено в Telegram."
          : "Бронь успешно создана 💗",
        "success"
      );

      setDateMessage(`Дата забронирована: ${fmt(bookingDate)} · 16:00`, "busy");

      form.reset();
      dateInput.value = "";
      updateSummary();
      updateSubmitState();

      // Keep the selected date unavailable after reset.
      render();
    } catch (error) {
      console.error("O.nails booking error:", error);

      const message = String(error?.message || error);

      if (message.includes("Эта дата уже занята")) {
        booked.add(bookingDate);
        render();
        setStatus("Эта дата уже занята. Выберите другую.", "error");
      } else {
        setStatus(
          "Не получилось сохранить бронь или отправить сообщение в Telegram: " +
          message,
          "error"
        );
      }
    } finally {
      sending = false;
      updateSubmitState();
    }
  });

  nameInput?.addEventListener("input", updateSubmitState);
  telegramInput?.addEventListener("input", () => {
    telegramInput.value = telegramInput.value.replace(/\s/g, "");
  });

  form.addEventListener("change", event => {
    if (event.target.matches('input[name="length"]')) {
      updateSummary();
      updateSubmitState();
    }
  });

  updateSummary();
  updateSubmitState();
  loadBookedDates();
})();
