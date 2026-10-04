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
    console.error("Supabase error:", r.status, data || text);

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

const cfg = () => {
  return Boolean(URL && KEY);
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
const today=new Date();today.setHours(0,0,0,0);let view=new Date(today.getFullYear(),today.getMonth(),1),booked=new Set(),ready=false;
const api=async(path,opt={})=>{const r=await fetch(URL+path,{...opt,headers:{"apikey":KEY,"Authorization":"Bearer "+KEY,...(opt.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{}if(!r.ok){const e=new Error(d?.message||d?.hint||"Ошибка сервера");e.status=r.status;throw e}return d};
const cfg=()=>URL&&KEY&&!URL.includes("PASTE_YOUR")&&!KEY.includes("PASTE_YOUR");
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fmt=v=>{const [y,m,d]=v.split("-");return `${d}.${m}.${y}`};
const weekend=d=>d.getDay()===0||d.getDay()===6, past=d=>d<today;
function msg(t,k=""){dateStatus.textContent=t;dateStatus.className="date-status "+k}
function status(t,k=""){statusBox.textContent=t;statusBox.className="status show "+k}
function monthName(d){return d.toLocaleDateString("ru-RU",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}

function render(){
 const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1),off=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),minMonth=new Date(today.getFullYear(),today.getMonth(),1),canPrev=view>minMonth;
 let s=`<div class="calhead"><strong>${monthName(view)}</strong><div class="calnav"><button type="button" id="prev" ${canPrev?"":"disabled"}>‹</button><button type="button" id="next">›</button></div></div><div class="week"><div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div></div><div class="days">`;
 for(let i=0;i<off;i++)s+='<button class="day mutedday" type="button" tabindex="-1"></button>';
 for(let day=1;day<=days;day++){
   const d=new Date(y,m,day),v=iso(d),w=weekend(d),p=past(d),b=booked.has(v),sel=dateInput.value===v,dis=!ready||w||p||b;
   s+=`<button class="day ${w?"weekend ":""}${b?"booked ":""}${sel?"selected":""}" type="button" data-date="${v}" ${dis?"disabled":""}>${day}</button>`;
 }
 calendar.innerHTML=s+"</div>";
 calendar.querySelector("#prev")?.addEventListener("click",()=>{if(canPrev){view=new Date(y,m-1,1);render()}});
 calendar.querySelector("#next")?.addEventListener("click",()=>{view=new Date(y,m+1,1);render()});
 calendar.querySelectorAll("[data-date]").forEach(b=>b.addEventListener("click",()=>select(b.dataset.date)));
}
function select(v){const d=new Date(v+"T00:00:00");if(!ready||weekend(d)||past(d)||booked.has(v))return;dateInput.value=v;render();msg("Выбрано: "+fmt(v)+" · 16:00","free")}
async function load() {
  render();

  console.log("1. load() запущен");
  console.log("URL:", URL);
  console.log("KEY есть:", !!KEY);

  if (!URL || !KEY) {
    msg("Нет подключения к Supabase.", "error");
    return;
  }

  msg("Проверяем Supabase…", "info");

  try {
    const response = await fetch(
      URL + "/rest/v1/booked_dates?select=booking_date,status",
      {
        method: "GET",
        headers: {
          "apikey": KEY,
          "Authorization": "Bearer " + KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("2. HTTP статус:", response.status);

    const text = await response.text();

    console.log("3. Ответ Supabase:", text);

    if (!response.ok) {
      throw new Error(
        "Supabase HTTP " + response.status + ": " + text
      );
    }

    let rows = [];

    try {
      rows = text ? JSON.parse(text) : [];
    } catch {
      throw new Error("Supabase вернул не JSON: " + text);
    }

    console.log("4. Получены даты:", rows);

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

    console.error("ОШИБКА КАЛЕНДАРЯ:", error);

    ready = false;
    submit.disabled = true;

    msg(
      "Ошибка Supabase: " + error.message,
      "error"
    );

    render();
  }
}
form.addEventListener("submit",async e=>{
 e.preventDefault();
 if(!ready){status("Система бронирования не подключена.","err");return}
 const name=document.getElementById("name").value.trim(),date=dateInput.value,length=document.querySelector('input[name="length"]:checked')?.value;
 const telegramUsername=(document.getElementById("telegramUsername")?.value||"").trim();
 const design=document.getElementById("design").value.trim()||"пришлю фото / обсудим";
 const removal=document.getElementById("removal").checked,correction=document.getElementById("correction").checked;
 const comment=document.getElementById("comment").value.trim()||"нет";
 const priceMap={"1–2":1300,"3–5":1500,"6–7":1700,"8+":2000};
 const price=priceMap[length]||0;
 if(!date||!length){status("Выберите дату и длину ногтей.","err");return}
 const d=new Date(date+"T00:00:00");if(weekend(d)){msg("Суббота и воскресенье недоступны.","busy");return}
 if(booked.has(date)){msg("Эта дата уже занята.","busy");render();return}
 submit.disabled = true;
submit.textContent = "Бронируем…";
status("Проверяем дату и сохраняем запись…", "info");

try{
  await api("/rest/v1/bookings",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Prefer":"return=minimal"
    },
    body:JSON.stringify({
      name,
      telegram_username:telegramUsername || null,
      booking_date:date,
      booking_time:"16:00",
      nail_length:length,
      design,
      removal,
      correction,
      comment,
      status:"confirmed"
    })
  });

  booked.add(date);
  render();

  msg(`Дата ${fmt(date)} забронирована · 16:00`,"free");

  const text=[
    "💅 НОВАЯ ЗАПИСЬ O.NAILS",
    "",
    `👤 Имя: ${name}`,
    `📱 Telegram: ${telegramUsername || "не указан"}`,
    `📅 Дата: ${fmt(date)}`,
    "🕐 Время: 16:00",
    `💅 Длина: ${length}`,
    `💰 Цена: ${price} ₽`,
    `🎨 Дизайн: ${design}`,
    `🧹 Снятие: ${removal?"да":"нет"}`,
    `🔧 Коррекция: ${correction?"да":"нет"}`,
    `💬 Пожелания: ${comment || "нет"}`
  ].join("\n");

  // Серверная отправка: Edge Function отправляет сообщение в Telegram автоматически.
  const tgResponse = await fetch(
    "https://agvkksymvwsmrcxpjhts.supabase.co/functions/v1/send-booking-telegram",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":KEY,
        "Authorization":"Bearer "+KEY
      },
      body:JSON.stringify({
        name,
        date,
        time:"16:00",
        length,
        price,
        design,
        removal,
        correction,
        comment,
        telegramUsername
      })
    }
  );

  const tgText=await tgResponse.text();
  let tgData=null;
  try{tgData=tgText?JSON.parse(tgText):null}catch{}

  if(!tgResponse.ok || tgData?.ok===false){
    console.error("Telegram function error:",tgResponse.status,tgData||tgText);
    status("Бронь сохранена, но Telegram не получил сообщение. Проверьте Edge Function и Telegram.","err");
    throw new Error("Telegram: "+(tgData?.error||tgText||("HTTP "+tgResponse.status)));
  }

  status("Готово! Бронь сохранена, сообщение автоматически отправлено в Telegram.","ok");

  // Открываем Telegram для клиента после успешной серверной отправки.
  window.location.href = "https://t.me/olkadolka228?text=" + encodeURIComponent(text);

}catch(err){

  if(err.status===409){
    booked.add(date);
    dateInput.value="";
    render();
    msg(
      "Эту дату только что забронировала другая клиентка. Выберите другую.",
      "busy"
    );
    status("Бронь не создана: дата уже занята.","err");
  }else{
    status(
      "Не получилось сохранить бронь. Проверьте Supabase.",
      "err"
    );
  }

  console.error(err);

}finally{
  submit.disabled=false;
  submit.textContent="Забронировать дату и открыть Telegram ↗";
}
render();
load();
