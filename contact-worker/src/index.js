// FUNavi お問い合わせフォームの受け口
// ホームページから送られた内容をチェックし、Discord のチャンネルに通知する

const CATEGORIES = ["活動について", "取材・協力の依頼", "その他"];
const LIMITS = { name: 100, email: 254, message: 3000 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = origin === env.ALLOWED_ORIGIN;
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "このアドレスはお問い合わせの送信専用です。" });
    if (!allowed) return reply(403, { error: "このページからは送信できません。" });

    // 大きすぎる送信は読み込まずに拒否する（フォームの上限は合計でも数KB）
    const size = Number(request.headers.get("Content-Length") || 0);
    if (size > 16 * 1024) return reply(413, { error: "送信内容が大きすぎます。" });

    let data;
    try {
      const text = await request.text();
      if (text.length > 16 * 1024) return reply(413, { error: "送信内容が大きすぎます。" });
      data = JSON.parse(text);
    } catch {
      return reply(400, { error: "送信内容を読み取れませんでした。もう一度お試しください。" });
    }

    // ボット除けの隠し入力欄に何か入っていたら、成功したふりをして捨てる
    if (data.website) return reply(200, { ok: true });

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const category = String(data.category || "").trim();
    const message = String(data.message || "").trim();

    if (!name || !email || !message) return reply(400, { error: "未入力の項目があります。" });
    if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message)
      return reply(400, { error: "入力が長すぎます。文字数を減らしてもう一度お試しください。" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply(400, { error: "メールアドレスの形式が正しくありません。" });
    if (!CATEGORIES.includes(category)) return reply(400, { error: "お問い合わせの種類を選んでください。" });

    if (!env.DISCORD_WEBHOOK_URL) return reply(500, { error: "現在お問い合わせを受け付けられません。時間をおいてお試しください。" });

    const sentAt = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

    const payload = {
      username: "FUNavi お問い合わせ",
      allowed_mentions: { parse: [] }, // @everyone などのメンションを無効にする
      embeds: [
        {
          title: `新しいお問い合わせ：${category}`,
          color: 0x2f9a6a,
          fields: [
            { name: "お名前", value: clip(name, 1024), inline: true },
            { name: "メールアドレス", value: clip(email, 1024), inline: true },
            { name: "お問い合わせ内容", value: clip(message, 1024) },
          ],
          footer: { text: `受信：${sentAt}` },
        },
      ],
    };
    // 1024文字を超える本文は、続きを別メッセージで送る
    const rest = message.length > 1024 ? message.slice(1023) : "";

    const post = (body) =>
      fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    const res = await post(payload);
    if (!res.ok) {
      console.error(JSON.stringify({ event: "discord_post_failed", status: res.status }));
      return reply(502, { error: "送信できませんでした。時間をおいてもう一度お試しください。" });
    }
    console.log(JSON.stringify({ event: "contact_received", category, length: message.length }));
    if (rest) {
      for (let i = 0; i < rest.length; i += 1900) {
        await post({ username: "FUNavi お問い合わせ", allowed_mentions: { parse: [] }, content: "（続き）\n" + rest.slice(i, i + 1900) });
      }
    }
    return reply(200, { ok: true });
  },
};
