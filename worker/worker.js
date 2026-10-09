// 易問 v2 Worker — AI 解卦＋LINE 登入＋綠界金流＋額度系統
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FRONTEND = "https://iching-divination-exq.pages.dev";
const API_HOST = "https://yiwen-api.taicalc.com";

const SYS = `你是「易問」的解卦師，精通《周易》經文與象數義理。你用台灣繁體中文、白話但典雅的語氣解卦。
規則：
1. 只輸出 JSON，不要輸出其他文字。格式：{"xiankuang":"...","bianhua":"...","jianyi":"...","tixing":"..."}
2. xiankuang：依本卦卦辭與卦象，描述問事者當下的處境（2-4句）。
3. bianhua：依變爻爻辭與之卦，指出正在變化或需要注意的關鍵（2-4句）。
4. jianyi：給出具體、可執行的行動建議（2-4句）。
5. tixing：一句警醒或安頓人心的話（1-2句）。
6. 不可鐵口直斷吉凶禍福，不可給醫療、法律、投資買賣點等專業建議；語氣是參謀，不是神明。
7. 若問題空泛，仍就卦象給通用的人生建議。
8. 全文一律使用繁體中文（台灣用法），嚴禁出現任何簡體字。`;

// 簡體字偵測（僅簡體寫法才有的字）
const SIMP_RE = /[龙门见观变发过还请让说认为时来对现点开关无远运进实适这个么与后样]/;

function cors(req) {
  const o = req.headers.get("Origin") || "";
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
  if (o === FRONTEND) {
    h["Access-Control-Allow-Origin"] = o;
    h["Access-Control-Allow-Credentials"] = "true";
  } else {
    h["Access-Control-Allow-Origin"] = "*";
  }
  return h;
}
const json = (req, obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: cors(req) });

async function callAI(env, messages) {
  const ai = await env.AI.run(MODEL, { messages, max_tokens: 1200 });
  let txt = "";
  if (typeof ai.response === "string") txt = ai.response;
  else if (ai.choices && ai.choices[0]) {
    const c0 = ai.choices[0];
    txt = (c0.message && c0.message.content) || c0.text || "";
  }
  return String(txt).trim();
}

/* ---------- session (JWT HS256) ---------- */
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signSession(env, uid) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + 2592000 })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(header + "." + payload)));
  return header + "." + payload + "." + sig;
}
async function verifySession(env, token) {
  try {
    const [h, p, s] = token.split(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key,
      Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)),
      new TextEncoder().encode(h + "." + p));
    if (!ok) return null;
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp < Date.now() / 1000) return null;
    return payload.uid;
  } catch { return null; }
}
function getCookie(req, name) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
const sessCookie = tok =>
  `yiwen_sess=${encodeURIComponent(tok)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000`;

/* ---------- D1 helpers ---------- */
async function getEntitlement(env, uid) {
  let e = await env.DB.prepare("SELECT * FROM entitlements WHERE user_id = ?").bind(uid).first();
  if (!e) {
    await env.DB.prepare("INSERT INTO entitlements (user_id) VALUES (?)").bind(uid).run();
    e = { user_id: uid, plan: "free", credits: 0, free_month: "", free_used: 0, expires_at: 0 };
  }
  return e;
}
function monthStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
// 回傳 {ok:true} 或 {ok:false, reason}
async function consumeQuota(env, uid) {
  const m = monthStr();
  const e = await getEntitlement(env, uid);
  if (e.plan === "monthly" && e.expires_at > Date.now() / 1000) return { ok: true, plan: "monthly" };
  if (e.free_month !== m) {
    await env.DB.prepare("UPDATE entitlements SET free_month = ?, free_used = 0 WHERE user_id = ?").bind(m, uid).run();
    e.free_month = m; e.free_used = 0;
  }
  if (e.free_used < 3) {
    await env.DB.prepare("UPDATE entitlements SET free_used = free_used + 1 WHERE user_id = ?").bind(uid).run();
    return { ok: true, plan: "free", left: 2 - e.free_used };
  }
  if (e.credits > 0) {
    await env.DB.prepare("UPDATE entitlements SET credits = credits - 1 WHERE user_id = ?").bind(uid).run();
    return { ok: true, plan: "credits", left: e.credits - 1 };
  }
  return { ok: false, reason: "quota_exhausted" };
}

/* ---------- 綠界 CheckMacValue ---------- */
async function ecpayCheckMac(params, hashKey, hashIV) {
  const keys = Object.keys(params).filter(k => k !== "CheckMacValue").sort();
  let s = "HashKey=" + hashKey + "&" + keys.map(k => k + "=" + params[k]).join("&") + "&HashIV=" + hashIV;
  s = encodeURIComponent(s).toLowerCase()
    .replace(/%2d/g, "-").replace(/%5f/g, "_").replace(/%2e/g, ".")
    .replace(/%21/g, "!").replace(/%2a/g, "*").replace(/%28/g, "(").replace(/%29/g, ")");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function tradeNo() {
  return "YW" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
}
function tradeDate() {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 台灣時間
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });

    /* ===== LINE 登入 ===== */
    if (path === "/auth/line") {
      if (!env.LINE_CHANNEL_ID) return json(req, { error: "not_configured" }, 503);
      const state = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
      const q = new URLSearchParams({
        response_type: "code", client_id: env.LINE_CHANNEL_ID,
        redirect_uri: API_HOST + "/auth/callback", state, scope: "profile openid",
      });
      const headers = { ...cors(req), "Set-Cookie": `yiwen_oauth=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`, "Location": "https://access.line.me/oauth2/v2.1/authorize?" + q };
      return new Response(null, { status: 302, headers });
    }
    if (path === "/auth/callback") {
      try {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || state !== getCookie(req, "yiwen_oauth")) throw new Error("bad state");
        const tk = await fetch("https://api.line.me/oauth2/v2.1/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code", code,
            redirect_uri: API_HOST + "/auth/callback",
            client_id: env.LINE_CHANNEL_ID, client_secret: env.LINE_CHANNEL_SECRET,
          }),
        }).then(r => r.json());
        if (!tk.access_token) throw new Error("token failed");
        const prof = await fetch("https://api.line.me/v2/profile", {
          headers: { Authorization: "Bearer " + tk.access_token },
        }).then(r => r.json());
        if (!prof.userId) throw new Error("profile failed");
        return await finishLogin("line:" + prof.userId, prof.displayName, prof.pictureUrl);
      } catch (e) {
        return new Response(null, { status: 302, headers: { Location: FRONTEND + "/?login=fail" } });
      }
    }
    async function finishLogin(uid, name, picture) {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("INSERT INTO users (id, line_id, name, picture, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, picture = excluded.picture")
        .bind(uid, uid.split(":")[1] || "", name || "", picture || "", now).run();
      await getEntitlement(env, uid);
      const sess = await signSession(env, uid);
      return new Response(null, { status: 302, headers: {
        "Set-Cookie": sessCookie(sess) + ", yiwen_oauth=; Path=/; Max-Age=0",
        "Location": FRONTEND + "/?login=ok",
      }});
    }
    if (path === "/auth/google") {
      if (!env.GOOGLE_CLIENT_ID) return json(req, { error: "not_configured" }, 503);
      const state = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
      const q = new URLSearchParams({
        response_type: "code", client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: API_HOST + "/auth/google/callback", state,
        scope: "openid profile email",
      });
      const headers = { ...cors(req), "Set-Cookie": `yiwen_oauth=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`, "Location": "https://accounts.google.com/o/oauth2/v2/auth?" + q };
      return new Response(null, { status: 302, headers });
    }
    if (path === "/auth/google/callback") {
      try {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || state !== getCookie(req, "yiwen_oauth")) throw new Error("bad state");
        const tk = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code", code,
            redirect_uri: API_HOST + "/auth/google/callback",
            client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
          }),
        }).then(r => r.json());
        if (!tk.access_token) throw new Error("token failed");
        const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: "Bearer " + tk.access_token },
        }).then(r => r.json());
        if (!info.id) throw new Error("userinfo failed");
        return await finishLogin("google:" + info.id, info.name, info.picture);
      } catch (e) {
        return new Response(null, { status: 302, headers: { Location: FRONTEND + "/?login=fail" } });
      }
    }
    if (path === "/auth/logout") {
      return new Response(null, { status: 302, headers: { "Set-Cookie": "yiwen_sess=; Path=/; Max-Age=0", Location: FRONTEND + "/" } });
    }

    /* ===== 會員資訊 ===== */
    if (path === "/api/me") {
      const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
      if (!uid) return json(req, { loggedIn: false });
      const u = await env.DB.prepare("SELECT id, name, picture FROM users WHERE id = ?").bind(uid).first();
      const e = await getEntitlement(env, uid);
      const m = monthStr();
      const freeLeft = (e.free_month === m) ? Math.max(0, 3 - e.free_used) : 3;
      const monthly = e.plan === "monthly" && e.expires_at > Date.now() / 1000;
      return json(req, {
        loggedIn: true, name: u ? u.name : "", picture: u ? u.picture : "",
        plan: monthly ? "monthly" : "free", credits: e.credits, freeLeft,
        expiresAt: e.expires_at,
      });
    }

    /* ===== 建立綠界訂單 ===== */
    if (path === "/api/order" && req.method === "POST") {
      const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
      if (!uid) return json(req, { error: "login_required" }, 401);
      if (!env.ECPAY_MERCHANT_ID) return json(req, { error: "not_configured" }, 503);
      const { plan } = await req.json();
      if (plan !== "single" && plan !== "monthly") return json(req, { error: "bad_plan" }, 400);
      const amount = plan === "single" ? 49 : 149;
      const oid = tradeNo();
      await env.DB.prepare("INSERT INTO orders (id, user_id, plan, amount, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(oid, uid, plan, amount, Math.floor(Date.now() / 1000)).run();
      const params = {
        MerchantID: env.ECPAY_MERCHANT_ID,
        MerchantTradeNo: oid,
        MerchantTradeDate: tradeDate(),
        PaymentType: "aio",
        TotalAmount: String(amount),
        TradeDesc: "易問解卦",
        ItemName: plan === "single" ? "易問單次解卦包(10次)" : "易問月訂無限解卦",
        ReturnURL: API_HOST + "/api/ecpay/return",
        OrderResultURL: FRONTEND + "/?paid=1",
        NeedExtraPaidInfo: "N",
        EncryptType: "1",
      };
      if (plan === "single") {
        params.ChoosePayment = "Credit";
      } else {
        params.ChoosePayment = "Credit";
        params.PeriodAmount = String(amount);
        params.PeriodType = "M";
        params.Frequency = "1";
        params.ExecTimes = "12";
        params.PeriodReturnURL = API_HOST + "/api/ecpay/return";
      }
      params.CheckMacValue = await ecpayCheckMac(params, env.ECPAY_HASH_KEY, env.ECPAY_HASH_IV);
      return json(req, { action: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5", params });
    }

    /* ===== 綠界回調（server notify） ===== */
    if (path === "/api/ecpay/return" && req.method === "POST") {
      const form = await req.formData();
      const p = {};
      for (const [k, v] of form.entries()) p[k] = String(v);
      const mac = await ecpayCheckMac(p, env.ECPAY_HASH_KEY, env.ECPAY_HASH_IV);
      if (mac !== p.CheckMacValue) return new Response("0|CheckMacValue error");
      const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(p.MerchantTradeNo).first();
      if (!order) return new Response("0|order not found");
      if (p.RtnCode === "1" && order.status !== "paid") {
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare("UPDATE orders SET status = 'paid', trade_no = ?, paid_at = ? WHERE id = ?")
          .bind(p.TradeNo || "", now, order.id).run();
        await getEntitlement(env, order.user_id);
        if (order.plan === "single") {
          await env.DB.prepare("UPDATE entitlements SET credits = credits + 10 WHERE user_id = ?").bind(order.user_id).run();
        } else {
          const e = await getEntitlement(env, order.user_id);
          const base = Math.max(e.expires_at || 0, now);
          await env.DB.prepare("UPDATE entitlements SET plan = 'monthly', expires_at = ? WHERE user_id = ?")
            .bind(base + 31 * 86400, order.user_id).run();
        }
      }
      return new Response("1|OK");
    }

    /* ===== AI 解卦 ===== */
    if (path === "/divine" && req.method === "POST") {
      try {
        const b = await req.json();
        // 登入用戶走 server 端額度
        const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
        if (uid) {
          const q = await consumeQuota(env, uid);
          if (!q.ok) return json(req, { error: "quota_exhausted" }, 402);
        }
        const moving = (b.moving || []).map(m =>
          `變爻${m.label}：本卦「${m.ben}」→之卦${m.zhiLabel}「${m.zhi}」`).join("；") || "無變爻";
        const user = `問事：${b.question}\n本卦：第${b.benGua.n}卦 ${b.benGua.name}，卦辭「${b.benGua.guaci}」，白話「${b.benGua.baihua}」\n${moving}\n之卦：第${b.zhiGua.n}卦 ${b.zhiGua.name}，卦辭「${b.zhiGua.guaci}」，白話「${b.zhiGua.baihua}」\n請依以上起卦結果解卦，只輸出 JSON。`;
        const messages = [
          { role: "system", content: SYS },
          { role: "user", content: user },
        ];
        let txt = await callAI(env, messages);
        if (SIMP_RE.test(txt)) {
          messages.push({ role: "user", content: "請將上述內容全部改寫為繁體中文（台灣用法），嚴禁簡體字，只輸出 JSON。" });
          txt = await callAI(env, messages);
        }
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) txt = m[0];
        const out = JSON.parse(txt);
        for (const k of ["xiankuang", "bianhua", "jianyi", "tixing"])
          if (typeof out[k] !== "string") out[k] = "";
        return json(req, out);
      } catch (e) {
        return json(req, { error: "divine_failed", detail: String(e && e.message || e).slice(0, 200) }, 500);
      }
    }

    return json(req, { error: "not_found" }, 404);
  }
};
