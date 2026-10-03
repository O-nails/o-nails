const CFG=window.ONAILES_SUPABASE||{},URL=CFG.url,KEY=CFG.anonKey;
const form=document.getElementById("bookingForm"),calendar=document.getElementById("calendar"),dateInput=document.getElementById("date"),dateStatus=document.getElementById("dateStatus"),statusBox=document.getElementById("bookingStatus"),submit=document.getElementById("submitBtn");
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
async function load(){
 if(!cfg()){submit.disabled=true;msg("Подключите Supabase в index.html.","error");render();return}
 try{
   const rows=await api("/rest/v1/booked_dates?select=booking_date&status=eq.confirmed");
   booked=new Set((rows||[]).map(x=>x.booking_date));ready=true;submit.disabled=false;msg("Свободные будни загружены.","free");render()
 }catch(e){submit.disabled=true;msg("Не удалось загрузить календарь. Обновите страницу.","error");render();console.error(e)}
}
form.addEventListener("submit",async e=>{
 e.preventDefault();
 if(!ready){status("Система бронирования не подключена.","err");return}
 const name=document.getElementById("name").value.trim(),date=dateInput.value,length=document.querySelector('input[name="length"]:checked')?.value;
 const design=document.getElementById("design").value.trim()||"пришлю фото / обсудим";
 const removal=document.getElementById("removal").checked,correction=document.getElementById("correction").checked;
 const comment=document.getElementById("comment").value.trim()||"нет";
 if(!date||!length){status("Выберите дату и длину ногтей.","err");return}
 const d=new Date(date+"T00:00:00");if(weekend(d)){msg("Суббота и воскресенье недоступны.","busy");return}
 if(booked.has(date)){msg("Эта дата уже занята.","busy");render();return}
 submit.disabled=true;submit.textContent="Бронируем…";status("Проверяем дату и сохраняем запись…","info");
 try{
   await api("/rest/v1/bookings",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify({name,booking_date:date,booking_time:"16:00",nail_length:length,design,removal,correction,comment,status:"confirmed"})});
   booked.add(date);render();msg(`Дата ${fmt(date)} забронирована · 16:00`,"free");status("Готово! Дата закреплена. Открываем Telegram.","ok");
   const text = [
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

// Копируем готовое сообщение
try {
  await navigator.clipboard.writeText(text);
} catch (copyError) {
  console.error("Не удалось скопировать сообщение:", copyError);
}

// Открываем Telegram мастера
window.location.href = "https://t.me/olkadolka228";
  catch(err){
   if(err.status===409){booked.add(date);dateInput.value="";render();msg("Эту дату только что забронировала другая клиентка. Выберите другую.","busy");status("Бронь не создана: дата уже занята.","err")}
   else status("Не получилось сохранить бронь. Проверьте Supabase.","err");
   console.error(err)
 }finally{submit.disabled=false;submit.textContent="Забронировать дату и открыть Telegram ↗"}
});
render();
load();
