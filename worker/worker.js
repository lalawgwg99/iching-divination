// 易問 v2 Worker — AI 解卦＋LINE 登入＋綠界金流＋額度系統
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const TESTING_UNLIMITED = true; // 測試期：不限制 AI 使用次數；正式收費時改回 false
const DAILY_GUA = [{"n":1,"name":"乾","guaci":"乾：元亨。利貞。","qs":"天行健，君子以自強不息——該出手時就出手。"},{"n":2,"name":"坤","guaci":"坤：元亨。利牝馬之貞。君子有攸往，先迷後得主。利西南得朋，東北喪朋。安貞，吉。","qs":"厚德載物，先守後攻，柔軟是最強的韌性。"},{"n":3,"name":"屯","guaci":"屯：元亨，利貞。勿用有攸往，利建侯。","qs":"種子破土前都在黑暗裡，別急。"},{"n":4,"name":"蒙","guaci":"蒙：亨。匪我求童蒙，童蒙求我。初筮告，再三瀆，瀆則不告。利貞。","qs":"不懂就問，是最快的路。"},{"n":5,"name":"需","guaci":"需：有孚，光亨。貞吉，利涉大川。","qs":"該等的時候等，本身就是實力。"},{"n":6,"name":"訟","guaci":"訟：有孚，窒，惕，中吉，終凶。利見大人，不利涉大川。","qs":"贏了道理輸了關係，不划算。"},{"n":7,"name":"師","guaci":"師：貞丈人吉，无咎。","qs":"帶人先帶心，號令要清楚。"},{"n":8,"name":"比","guaci":"比：吉。原筮元永貞，无咎。不寧方來，後夫凶。","qs":"選對夥伴，事半功倍。"},{"n":9,"name":"小畜","guaci":"小畜：亨。密雲不雨，自我西郊。","qs":"小步前進，別想一次到位。"},{"n":10,"name":"履","guaci":"履虎尾，不咥人，亨。","qs":"禮數做足，貴人自來。"},{"n":11,"name":"泰","guaci":"泰：小往大來，吉亨。","qs":"好運來時，要敢接。"},{"n":12,"name":"否","guaci":"否之匪人，不利君子貞，大往小來。","qs":"低潮時不亂動，就是贏。"},{"n":13,"name":"同人","guaci":"同人于野，亨。利涉大川，利君子貞。","qs":"同頻的人會互相照亮。"},{"n":14,"name":"大有","guaci":"大有：元亨。","qs":"得到越多，越要低調。"},{"n":15,"name":"謙","guaci":"謙：亨，君子有終。","qs":"真本事不需要張揚。"},{"n":16,"name":"豫","guaci":"豫：利建侯行師。","qs":"開心的時候，想想風險。"},{"n":17,"name":"隨","guaci":"隨：元亨。利貞。无咎。","qs":"順勢而為，比逆流划船輕鬆。"},{"n":18,"name":"蠱","guaci":"蠱：元亨。利涉大川。先甲三日，後甲三日。","qs":"該修的現在修，別拖。"},{"n":19,"name":"臨","guaci":"臨：元亨。利貞。至于八月有凶。","qs":"位置越高，姿態越低。"},{"n":20,"name":"觀","guaci":"觀：盥而不薦，有孚顒若。","qs":"先看清楚，再出手。"},{"n":21,"name":"噬嗑","guaci":"噬嗑：亨。利用獄。","qs":"該斷就斷，拖只會更痛。"},{"n":22,"name":"賁","guaci":"賁：亨。小利有攸往。","qs":"門面顧好，是對人的尊重。"},{"n":23,"name":"剝","guaci":"剝：不利。有攸往。","qs":"逆風時，先保本。"},{"n":24,"name":"復","guaci":"復：亨。出入无疾，朋來无咎。反復其道，七日來復，利有攸往。","qs":"跌倒了，爬起來就是新的開始。"},{"n":25,"name":"无妄","guaci":"无妄：元亨。利貞。其匪正有眚，不利有攸往。","qs":"別算計太多，真誠最省力。"},{"n":26,"name":"大畜","guaci":"大畜：利貞，不家食吉，利涉大川。","qs":"存夠了本事，就等風來。"},{"n":27,"name":"頤","guaci":"頤：貞吉。觀頤，自求口實。","qs":"照顧好身體，才有本錢談未來。"},{"n":28,"name":"大過","guaci":"大過：棟橈，利有攸往，亨。","qs":"非常時期，別用平常心態。"},{"n":29,"name":"坎","guaci":"習坎：有孚，維心亨。行有尚。","qs":"關關難過，關關過。"},{"n":30,"name":"離","guaci":"離：利貞。亨。畜牝牛，吉。","qs":"發光之前，先找對可以依靠的。"},{"n":31,"name":"咸","guaci":"咸：亨。利貞。取女吉。","qs":"真誠相待，感應自然來。"},{"n":32,"name":"恒","guaci":"恆：亨，无咎。利貞，利有攸往。","qs":"每天做一點，勝過一次爆發。"},{"n":33,"name":"遯","guaci":"遯：亨。小利貞。","qs":"退一步不是輸，是為了走更遠。"},{"n":34,"name":"大壯","guaci":"大壯：利貞。","qs":"強的時候，更要守規矩。"},{"n":35,"name":"晉","guaci":"晉：康侯用錫馬蕃庶，晝日三接。","qs":"順風時，把帆張滿。"},{"n":36,"name":"明夷","guaci":"明夷：利艱貞。","qs":"環境不對時，先保護自己。"},{"n":37,"name":"家人","guaci":"家人：利女貞。","qs":"把家顧好，是最大的底氣。"},{"n":38,"name":"睽","guaci":"睽：小事吉。","qs":"不合沒關係，各走各的也行。"},{"n":39,"name":"蹇","guaci":"蹇：利西南，不利東北；利見大人，貞吉。","qs":"卡住的時候，停下來想比硬闖好。"},{"n":40,"name":"解","guaci":"解：利西南，无所往，其來復吉。有攸往，夙吉。","qs":"難關過了，就別再回頭看。"},{"n":41,"name":"損","guaci":"損：有孚，元吉。无咎，可貞，利有攸往。曷之用？二簋可用享。","qs":"有捨才有得。"},{"n":42,"name":"益","guaci":"益：利有攸往。利涉大川。","qs":"幫人，就是幫未來的自己。"},{"n":43,"name":"夬","guaci":"夬：揚于王庭，孚號，有厲，告自邑，不利即戎，利有攸往。","qs":"該切割的，漂亮地切割。"},{"n":44,"name":"姤","guaci":"姤：女壯，勿用取女。","qs":"好的開始要珍惜，壞的苗頭要早斷。"},{"n":45,"name":"萃","guaci":"萃：王假有廟，利見大人，亨。利貞。用大牲吉，利有攸往。","qs":"把對的人聚在一起，事就成了一半。"},{"n":46,"name":"升","guaci":"升：元亨，用見大人，勿恤，南征吉。","qs":"爬樓梯比坐電梯踏實。"},{"n":47,"name":"困","guaci":"困：亨，貞大人吉，无咎，有言不信。","qs":"被困住時，守住心就不算輸。"},{"n":48,"name":"井","guaci":"井：改邑不改井，无喪无得，往來井井。汔至亦未繘井。羸其瓶，凶。","qs":"做那口人人需要的井。"},{"n":49,"name":"革","guaci":"革：已日乃孚，元亨。利貞。悔亡。","qs":"該換跑道時，別留戀舊地圖。"},{"n":50,"name":"鼎","guaci":"鼎：元吉，亨。","qs":"能扛鼎的人，先穩住自己。"},{"n":51,"name":"震","guaci":"震：亨。震來虩虩，笑言啞啞。震驚百里，不喪匕鬯。","qs":"被嚇醒之後，記得往前走。"},{"n":52,"name":"艮","guaci":"艮：艮其背，不獲其身，行其庭，不見其人，无咎。","qs":"懂得停下來，也是一種能力。"},{"n":53,"name":"漸","guaci":"漸：女歸吉，利貞。","qs":"慢就是快，穩就是贏。"},{"n":54,"name":"歸妹","guaci":"歸妹：征凶，无攸利。","qs":"位置不對時，先把本分做好。"},{"n":55,"name":"豐","guaci":"豐：亨。王假之，勿憂，宜日中。","qs":"最滿的時候，記得留白。"},{"n":56,"name":"旅","guaci":"旅：小亨，旅貞吉。","qs":"出門在外，低調平安是福。"},{"n":57,"name":"巽","guaci":"巽：小亨。利有攸往。利見大人。","qs":"柔軟的身段，走得進人心。"},{"n":58,"name":"兌","guaci":"兌：亨。利貞。","qs":"讓人開心的人，運氣不會差。"},{"n":59,"name":"渙","guaci":"渙：亨，王假有廟，利涉大川，利貞。","qs":"散了，就一個一個找回來。"},{"n":60,"name":"節","guaci":"節：亨。苦節不可貞。","qs":"有節制的人，走得遠。"},{"n":61,"name":"中孚","guaci":"中孚：豚魚吉，利涉大川，利貞。","qs":"誠信是最硬的通貨。"},{"n":62,"name":"小過","guaci":"小過：亨。利貞。可小事，不可大事。飛鳥遺之音，不宜上宜下，大吉。","qs":"小事做到位，大事自然來。"},{"n":63,"name":"既濟","guaci":"既濟：亨小。利貞。初吉終亂。","qs":"成功之後，更要小心。"},{"n":64,"name":"未濟","guaci":"未濟：亨。小狐汔濟，濡其尾，无攸利。","qs":"故事還沒完，好戲在後頭。"}];
const FRONTEND = "https://yiwen.taicalc.com";
const API_HOST = "https://yiwen-api.taicalc.com";

const SYS = `你是「易問」的解卦師，精通《周易》經文與象數義理。你用台灣繁體中文、白話但典雅的語氣解卦。
規則：
1. 只輸出 JSON，不要輸出其他文字。格式：{"xiankuang":"...","bianhua":"...","jianyi":"...","tixing":"..."}，有問事領域時再加 "sanzhi":{"ju":"...","shi":"...","xin":"..."}（只放適用的欄位）
2. xiankuang：依本卦卦辭與卦象，描述問事者當下的處境（2-4句）。
3. bianhua：依變爻爻辭與之卦，指出正在變化或需要注意的關鍵（2-4句）。
4. jianyi：給出具體、可執行的行動建議（2-4句）。
5. tixing：一句警醒或安頓人心的話（1-2句）。
6. 不可鐵口直斷吉凶禍福，不可給醫療、法律、投資買賣點等專業建議；語氣是參謀，不是神明。
7. 若問題空泛，仍就卦象給通用的人生建議。
8. 全文一律使用繁體中文（台灣用法），嚴禁出現任何簡體字。
9. 若使用者訊息中有「問事領域」（求職／感情／創業／考試／人際／抉擇／商戰），在 JSON 中增加 "sanzhi" 物件，每欄 1-2 句，不適用的欄位直接省略，不要硬湊：
   - "ju"（觀局・易經）：必有，一句話點出卦象的大勢。
   - "shi"（取勢・兵法）：領域為商戰／求職／創業／抉擇時才有，取貼合卦象的一兩句兵法（如知己知彼、不戰而屈人之兵、兵貴神速、上下同欲者勝、避實擊虛等），轉化為現代商場或職場競爭的具體打法，務實、不掉書袋。
   - "xin"（懂心・人心）：領域為人際／感情／抉擇／考試時才有，人性心理視角（如界限感、期望管理、換位思考、損失厭惡、沉沒成本），用白話講，不貼學術標籤。不可做心理診斷或諮商，不可貼病名。`;

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

async function callAI(env, messages, model, maxTokens) {
  const ai = await env.AI.run(model || MODEL, { messages, max_tokens: maxTokens || 1200 });
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

/* ===== Web Push（每日一卦） ===== */
function b64u(buf) {
  const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
async function hkdfExpand(ikm, salt, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}
async function vapidJWT(jwk, aud) {
  const enc = new TextEncoder();
  const h = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:hello@taicalc.com" })));
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(h + "." + p));
  return h + "." + p + "." + b64u(sig); // ECDSA sign 直接回傳 raw r||s（64 bytes）
}
async function encryptPush(p256dhB64, authB64, payloadStr) {
  const uaPub = unb64u(p256dhB64);
  const auth = unb64u(authB64);
  const payload = new TextEncoder().encode(payloadStr);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const info = (s) => { const e = new TextEncoder().encode(s); const o = new Uint8Array(e.length + 1 + 130); o.set(e); o[e.length] = 0; o.set(uaPub, e.length + 1); o.set(ephPubRaw, e.length + 1 + 65); return o; };
  const cek = await hkdfExpand(shared, auth, info("Content-Encoding: aes128gcm"), 16);
  const nonce = await hkdfExpand(shared, auth, info("Content-Encoding: nonce"), 12);
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const m = new Uint8Array(2 + payload.length);
  m.set(payload, 2);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, m));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(ephPubRaw, 21);
  const body = new Uint8Array(header.length + ct.length);
  body.set(header, 0); body.set(ct, header.length);
  return body;
}
async function sendPush(env, sub, payloadObj) {
  const jwk = JSON.parse(env.VAPID_PRIV_JWK);
  const pub = new Uint8Array(65);
  pub[0] = 4; pub.set(unb64u(jwk.x), 1); pub.set(unb64u(jwk.y), 33);
  const url = new URL(sub.endpoint);
  const jwt = await vapidJWT(jwk, url.origin);
  const body = await encryptPush(sub.p256dh, sub.auth, JSON.stringify(payloadObj));
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": "vapid t=" + jwt + ", k=" + b64u(pub),
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body,
  });
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

    /* ===== 單爻求籤短解 ===== */
    if (path === "/divine/yao" && req.method === "POST") {
      try {
        const b = await req.json();
        const messages = [
          { role: "system", content: "你是「易問」的解籤人，精通《周易》爻辭。你用台灣繁體中文、白話但典雅的語氣，針對抽到的爻給 2-4 句籤語短解：先點出這一爻在說什麼處境，再給一句今天可用的提醒。不可鐵口直斷吉凶禍福，不可給醫療、法律、投資買賣點等專業建議。只輸出短解文字，不要 JSON，不要標題。全文一律繁體中文（台灣用法），嚴禁簡體字。" },
          { role: "user", content: `第${b.guaN}卦${b.guaName}・${b.yaoLabel}：「${b.yaoText}」\n請給籤語短解。` },
        ];
        let txt = await callAI(env, messages);
        if (SIMP_RE.test(txt)) {
          messages.push({ role: "user", content: "請將上述內容全部改寫為繁體中文（台灣用法），嚴禁簡體字。" });
          txt = await callAI(env, messages);
        }
        return json(req, { answer: txt.slice(0, 600) });
      } catch (e) { return json(req, { error: "divine_failed" }, 500); }
    }

    /* ===== 追問 ===== */
    if (path === "/divine/follow" && req.method === "POST") {
      try {
        const b = await req.json();
        const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
        if (uid && !TESTING_UNLIMITED) {
          const q = await consumeQuota(env, uid);
          if (!q.ok) return json(req, { error: "quota_exhausted" }, 402);
        }
        const hist = (b.history || []).slice(-6).map(h => (h.role === "user" ? "問" : "答") + "：" + h.text).join("\n");
        const topic = b.topic ? `\n問事領域：${b.topic}` : "";
        const messages = [
          { role: "system", content: "你是「易問」的解卦師，精通《周易》。針對使用者的追問，用台灣繁體中文、白話但典雅的語氣回答（2-5句），緊扣原本的卦象與先前的解卦，不要重複整段解卦內容。不可鐵口直斷吉凶禍福，不可給醫療、法律、投資買賣點等專業建議。只輸出回答文字，不要輸出 JSON。全文一律繁體中文（台灣用法），嚴禁簡體字。" },
          { role: "user", content: `原問事：${b.question}${topic}\n本卦：第${b.benGua.n}卦 ${b.benGua.name}；之卦：第${b.zhiGua.n}卦 ${b.zhiGua.name}\n先前建議：${b.prev || ""}${hist ? "\n先前追問：\n" + hist : ""}\n本次追問：${b.follow}` },
        ];
        let txt = await callAI(env, messages);
        if (SIMP_RE.test(txt)) {
          messages.push({ role: "user", content: "請將上述內容全部改寫為繁體中文（台灣用法），嚴禁簡體字。" });
          txt = await callAI(env, messages);
        }
        return json(req, { answer: txt.slice(0, 1500) });
      } catch (e) {
        return json(req, { error: "divine_failed" }, 500);
      }
    }

    /* ===== 釐清式解卦：AI 先問關鍵問題 ===== */
    if (path === "/divine/clarify" && req.method === "POST") {
      try {
        const b = await req.json();
        // 明顯具體的問題（夠長）直接跳過，不浪費一次 AI 判斷
        if ((b.question || "").trim().length >= 15) return json(req, { questions: [] });
        const messages = [
          { role: "system", content: "你是「易問」的解卦師。用戶剛起了一卦，準備請你解卦。你先判斷他的問題是否具體到可以準確解卦。\n- 若問題含糊籠統（如「幫我看看」「最近怎麼樣」「問事業」但沒說情境），回傳 1-2 個最關鍵的釐清問題（繁體中文、口語、每個不超過 30 字），幫你解得更準。\n- 若問題已有明確的人、事或抉擇點（例如已說出選項、數字、時間），一律回傳空陣列，直接解卦，不要多問。寧可少問，不可擾民。\n只輸出 JSON：{\"questions\": [\"問題1\", \"問題2\"]}，不要其他文字。全文繁體中文（台灣用法），嚴禁簡體字。" },
          { role: "user", content: `問事：${b.question || ""}${b.topic ? "\n領域：" + b.topic : ""}\n本卦：第${b.benGua.n}卦 ${b.benGua.name}；之卦：第${b.zhiGua.n}卦 ${b.zhiGua.name}` },
        ];
        let txt = await callAI(env, messages, null, 300);
        const m = txt.match(/\{[\s\S]*\}/);
        let out = { questions: [] };
        if (m) { try { const j = JSON.parse(m[0]); if (Array.isArray(j.questions)) out.questions = j.questions.slice(0, 2); } catch {} }
        return json(req, out);
      } catch (e) { return json(req, { questions: [] }); }
    }

    /* ===== AI 解卦 ===== */
    if (path === "/divine" && req.method === "POST") {
      try {
        const b = await req.json();
        // 登入用戶走 server 端額度
        const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
        if (uid && !TESTING_UNLIMITED) {
          const q = await consumeQuota(env, uid);
          if (!q.ok) return json(req, { error: "quota_exhausted" }, 402);
        }
        const moving = (b.moving || []).map(m =>
          `變爻${m.label}：本卦「${m.ben}」→之卦${m.zhiLabel}「${m.zhi}」`).join("；") || "無變爻";
        const topic = b.topic ? `\n問事領域：${b.topic}（請多從該領域角度切入）` : "";
        const clarifyTxt = (b.clarify || []).filter(c => c.a && c.a.trim()).map(c => `問：${c.q}\n答：${c.a}`).join("\n");
        const user = `問事：${b.question}${topic}\n本卦：第${b.benGua.n}卦 ${b.benGua.name}，卦辭「${b.benGua.guaci}」，白話「${b.benGua.baihua}」\n${moving}\n之卦：第${b.zhiGua.n}卦 ${b.zhiGua.name}，卦辭「${b.zhiGua.guaci}」，白話「${b.zhiGua.baihua}」${clarifyTxt ? "\n解卦師先釐清：\n" + clarifyTxt + "\n（請將以上問答納入解卦，解得更貼近他的真實處境）" : ""}\n請依以上起卦結果解卦，只輸出 JSON。`;
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
        const norm = (o) => {
          for (const k of ["xiankuang", "bianhua", "jianyi", "tixing"])
            if (typeof o[k] !== "string") o[k] = "";
          return o;
        };
        let out = norm(JSON.parse(txt));
        if (!out.xiankuang) {
          // AI 回了畸形 JSON，重試一次並強制格式
          messages.push({ role: "user", content: "上次輸出格式錯誤。請只輸出 JSON，不要有任何其他文字，格式：{\"xiankuang\":\"...\",\"bianhua\":\"...\",\"jianyi\":\"...\",\"tixing\":\"...\"}，有問事領域時再加 \"sanzhi\" 物件。" });
          txt = await callAI(env, messages);
          const m2 = txt.match(/\{[\s\S]*\}/);
          if (m2) txt = m2[0];
          out = norm(JSON.parse(txt));
          if (!out.xiankuang) throw new Error("ai_empty_response");
        }
        return json(req, out);
      } catch (e) {
        return json(req, { error: "divine_failed", detail: String(e && e.message || e).slice(0, 200) }, 500);
      }
    }

    /* ===== 占問雲端同步＋統計 ===== */
    if ((path === "/api/history/sync" || path === "/api/history/add") && req.method === "POST") {
      const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
      if (!uid) return json(req, { error: "auth" }, 401);
      try {
        const b = await req.json();
        const items = path.endsWith("/sync") ? (b.items || []).slice(0, 100) : [b.item || b];
        for (const it of items) {
          if (!it || !it.at) continue;
          await env.DB.prepare("INSERT OR IGNORE INTO divinations (user_id, question, topic, ben, zhi, ai, created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(uid, String(it.q || "").slice(0, 500), String(it.topic || "").slice(0, 20),
              String(it.ben || "").slice(0, 4), String(it.zhi || "").slice(0, 4),
              it.ai ? JSON.stringify(it.ai).slice(0, 4000) : null, it.at | 0).run();
        }
        return json(req, { ok: true, n: items.length });
      } catch (e) { return json(req, { error: "db" }, 500); }
    }
    if (path === "/api/stats" && req.method === "GET") {
      const uid = await verifySession(env, getCookie(req, "yiwen_sess"));
      if (!uid) return json(req, { error: "auth" }, 401);
      const total = await env.DB.prepare("SELECT COUNT(*) c FROM divinations WHERE user_id = ?").bind(uid).first();
      const topGua = await env.DB.prepare("SELECT ben AS name, COUNT(*) c FROM divinations WHERE user_id = ? AND ben <> '' GROUP BY ben ORDER BY c DESC LIMIT 3").bind(uid).all();
      const topics = await env.DB.prepare("SELECT topic AS name, COUNT(*) c FROM divinations WHERE user_id = ? AND topic <> '' GROUP BY topic ORDER BY c DESC").bind(uid).all();
      return json(req, { total: total.c, topGua: topGua.results || [], topics: topics.results || [] });
    }

    /* ===== 推播訂閱 ===== */
    if (path === "/api/push/subscribe" && req.method === "POST") {
      try {
        const b = await req.json();
        if (!b.endpoint || !b.p256dh || !b.auth) return json(req, { error: "bad" }, 400);
        await env.DB.prepare("INSERT OR REPLACE INTO push_subs (endpoint, p256dh, auth, created_at) VALUES (?,?,?,?)")
          .bind(String(b.endpoint).slice(0, 500), String(b.p256dh).slice(0, 200), String(b.auth).slice(0, 100), Math.floor(Date.now() / 1000)).run();
        return json(req, { ok: true });
      } catch (e) { return json(req, { error: "db" }, 500); }
    }
    if (path === "/api/push/unsubscribe" && req.method === "POST") {
      try {
        const b = await req.json();
        await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(b.endpoint || "").run();
        return json(req, { ok: true });
      } catch (e) { return json(req, { error: "db" }, 500); }
    }

    return json(req, { error: "not_found" }, 404);
  }
  ,
  async scheduled(event, env, ctx) {
    try {
      const tw = new Date(Date.now() + 8 * 3600 * 1000);
      const seed = tw.getUTCFullYear() * 10000 + (tw.getUTCMonth() + 1) * 100 + tw.getUTCDate();
      const rnd = mulberry32(seed);
      const g = DAILY_GUA[Math.floor(rnd() * 64)];
      const payload = {
        title: "易問・每日一卦",
        body: `今日第${g.n}卦・${g.name}：${g.qs}`,
        url: "https://yiwen.taicalc.com/",
      };
      const subs = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subs").all();
      for (const s of (subs.results || [])) {
        try {
          const r = await sendPush(env, s, payload);
          if (r.status === 404 || r.status === 410) {
            await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(s.endpoint).run();
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
};
