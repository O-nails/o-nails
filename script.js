(() => {
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

  if (!form || !calendar || !dateInput || !submit) {
    console.error("O.nails: элементы формы не найдены.");
    return;
  }

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

  const isConfigured = () =>
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
    SUPABASE_KEY.length > 20 &&
    !/PASTE_YOUR|YOUR_|<.*>/i.test(SUPABASE_KEY);

  function setDateMessage(text, type = "") {
    dateStatus.textContent = text;
    dateStatus.className = "date-status " + type;
  }

  function setStatus(text, type = "") {
    statusBox.textContent = text;
    statusBox.className = "status show " + type;
  }

  async function supabaseFetch(path, options = {}) {
    if (!isConfigured()) throw new Error("Supabase не настроен в index.html.");

    const response = await fetch(SUPABASE_URL + path, {
      ...options,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY,
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}

    if (!response.ok) {
      const message = data?.message || data?.hint || data?.details || data?.error_description || data?.error || raw || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.details = data;
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

  const isWeekend = date => date.getDay() === 0 || date.getDay() === 6;
  const isPast = date => date < today;

  function monthName(date) {
    return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
      .replace(/^./, c => c.toUpperCase());
  }

  function updateSummary() {
    summaryDate.textContent = dateInput.value ? `${fmt(dateInput.value)} · 16:00` : "не выбрана";
    const selected = document.querySelector('input[name="length"]:checked')?.value;
    summaryLength.textContent = selected ? `${selected} · ${prices[selected]}` : "не выбрана";
  }

  function selectLength(value, shouldScroll = false) {
    const input = [...document.querySelectorAll('input[name="length"]')].find(x => x.value === value);
    if (!input) return;
    input.checked = true;
    updateSummary();
    if (shouldScroll) document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCalendar() {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const canPrev = view > minMonth;

    let html = `<div class="cal-top"><div class="cal-title">${monthName(view)}</div><div class="cal-nav">
      <button type="button" id="prevMonth" ${canPrev ? "" : "disabled"} aria-label="Предыдущий месяц">‹</button>
      <button type="button" id="nextMonth" aria-label="Следующий месяц">›</button></div></div>
      <div class="week"><div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div></div><div class="days">`;

    for (let i = 0; i < offset; i++) html += '<button class="day mutedday" type="button" tabindex="-1" aria-hidden="true"></button>';

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const value = iso(date);
      const weekend = isWeekend(date);
      const past = isPast(date);
      const busy = booked.has(value);
      const selected = dateInput.value === value;
      const disabled = !ready || weekend || past || busy;
      const classes = ["day", weekend ? "weekend" : "", busy ? "booked" : "", selected ? "selected" : ""].filter(Boolean).join(" ");
      html += `<button class="${classes}" type="button" data-date="${value}" ${disabled ? "disabled" : ""}>${day}</button>`;
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
    calendar.querySelectorAll("[data-date]").forEach(btn => btn.addEventListener("click", () => selectDate(btn.dataset.date)));
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
    ready = false;
    submit.disabled = true;
    renderCalendar();

    if (!isConfigured()) {
      setDateMessage("Supabase не настроен. Проверьте URL и publishable/anon key в index.html.", "error");
      return;
    }

    setDateMessage("Проверяем свободные даты…", "info");
    try {
      const rows = await supabaseFetch("/rest/v1/booked_dates?select=booking_date,status&status=eq.confirmed");
      booked = new Set((rows || []).map(row => row.booking_date));
      ready = true;
      submit.disabled = false;
      setDateMessage("Свободные будни загружены.", "free");
      renderCalendar();
    } catch (error) {
      console.error("O.nails / Supabase calendar error:", error);
      setDateMessage(`Supabase: ${error.message}`, "error");
      setStatus("Не удалось подключиться к базе. Ниже показана точная ошибка Supabase.", "err");
    }
  }

  function buildTelegramText(data) {
    return [
      "Здравствуйте! Хочу записаться на маникюр 💗", "",
      `Имя: ${data.name}`,
      `Дата: ${fmt(data.date)}`,
      "Время: 16:00",
      `Длина: ${data.length}`,
      `Стоимость: ${prices[data.length]}`,
      `Дизайн: ${data.design}`,
      `Снятие: ${data.removal ? "да" : "нет"}`,
      `Коррекция: ${data.correction ? "да" : "нет"}`,
      `Комментарий: ${data.comment}`,
      "", "Дата уже забронирована через сайт O.nails."
    ].join("\n");
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!ready) {
      setStatus("Система бронирования не готова. Обновите страницу после настройки Supabase.", "err");
      return;
    }

    const name = nameInput.value.trim();
    const date = dateInput.value;
    const length = document.querySelector('input[name="length"]:checked')?.value;
    const design = document.getElementById("design").value.trim() || "пришлю фото / обсудим";
    const removal = document.getElementById("removal").checked;
    const correction = document.getElementById("correction").checked;
    const comment = document.getElementById("comment").value.trim() || "нет";

    if (!name) { setStatus("Введите имя.", "err"); nameInput.focus(); return; }
    if (!date || !length) { setStatus("Выберите дату и длину ногтей.", "err"); return; }

    const dateObject = new Date(date + "T00:00:00");
    if (isWeekend(dateObject)) { setStatus("Суббота и воскресенье недоступны.", "err"); return; }
    if (booked.has(date)) { setStatus("Эта дата уже занята. Выберите другую.", "err"); renderCalendar(); return; }

    submit.disabled = true;
    submit.textContent = "Бронируем…";
    setStatus("Сохраняем бронь в Supabase…", "info");

    try {
      await supabaseFetch("/rest/v1/rpc/create_booking", {
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
      setStatus("Готово! Бронь сохранена. Открываем Telegram…", "ok");

      const telegramText = buildTelegramText({
  name,
  date,
  length,
  design,
  removal,
  correction,
  comment
});

const telegramUrl = `https://t.me/olkadolka228?text=${encodeURIComponent(telegramText)}`;
window.location.href = telegramUrl;
    } catch (error) {
      console.error("O.nails / Supabase booking error:", error);
      const msg = String(error.message || "");
      if (error.status === 409 || /duplicate|unique|already exists|DATE_ALREADY_BOOKED/i.test(msg)) {
        booked.add(date);
        dateInput.value = "";
        renderCalendar();
        updateSummary();
        setDateMessage("Эту дату только что забронировала другая клиентка. Выберите другую.", "busy");
        setStatus("Бронь не создана: дата уже занята.", "err");
      } else {
        setStatus(`Ошибка Supabase: ${msg}`, "err");
      }
    } finally {
      submit.disabled = !ready;
      submit.textContent = "Забронировать дату и открыть Telegram ↗";
    }
  });

  document.querySelectorAll('input[name="length"]').forEach(input => input.addEventListener("change", updateSummary));
  document.querySelectorAll(".price-action[data-length]").forEach(button => button.addEventListener("click", () => selectLength(button.dataset.length, true)));

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: .08 });
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
  } else document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));

  updateSummary();
  loadBookings();
})();
