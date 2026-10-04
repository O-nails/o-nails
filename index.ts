const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      return json({ ok: false, error: "Telegram secrets are not configured" }, 500);
    }

    const body = await req.json();
    const {
      name,
      date,
      time = "16:00",
      length,
      price,
      design,
      removal,
      correction,
      comment,
      telegramUsername,
    } = body;

    if (!name || !date || !length) {
      return json({ ok: false, error: "Missing booking fields" }, 400);
    }

    const message = [
      "💅 НОВАЯ ЗАПИСЬ O.NAILS",
      "",
      `👤 Имя: ${name}`,
      `📱 Telegram: ${telegramUsername || "не указан"}`,
      `📅 Дата: ${date}`,
      `🕐 Время: ${time}`,
      `💅 Длина: ${length}`,
      `💰 Цена: ${price ?? "не указана"} ₽`,
      `🎨 Дизайн: ${design || "не указан"}`,
      `🧹 Снятие: ${removal ? "да" : "нет"}`,
      `🔧 Коррекция: ${correction ? "да" : "нет"}`,
      `💬 Пожелания: ${comment || "нет"}`,
    ].join("\n");

    const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    const tgData = await tg.json().catch(() => null);

    if (!tg.ok || !tgData?.ok) {
      return json({
        ok: false,
        error: `Telegram: ${tgData?.description || `HTTP ${tg.status}`}`,
      }, 502);
    }

    return json({ ok: true, telegram_message_id: tgData.result?.message_id ?? null });
  } catch (error) {
    console.error(error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
