// 易問 AI 解卦 Worker — POST /divine
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: corsHeaders() });
    try {
      const b = await req.json();
      const moving = (b.moving || []).map(m =>
        `變爻${m.label}：本卦「${m.ben}」→之卦${m.zhiLabel}「${m.zhi}」`).join("；") || "無變爻";
      const user = `問事：${b.question}\n本卦：第${b.benGua.n}卦 ${b.benGua.name}，卦辭「${b.benGua.guaci}」，白話「${b.benGua.baihua}」\n${moving}\n之卦：第${b.zhiGua.n}卦 ${b.zhiGua.name}，卦辭「${b.zhiGua.guaci}」，白話「${b.zhiGua.baihua}」\n請依以上起卦結果解卦，只輸出 JSON。`;
      const messages = [
        { role: "system", content: SYS },
        { role: "user", content: user },
      ];
      let txt = await callAI(env, messages);
      // 簡體防線：若含簡體字，重試一次並明確要求繁體
      if (SIMP_RE.test(txt)) {
        messages.push({ role: "user", content: "請將上述內容全部改寫為繁體中文（台灣用法），嚴禁簡體字，只輸出 JSON。" });
        txt = await callAI(env, messages);
      }
      // 容錯：擷取第一個 {...}
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) txt = m[0];
      const out = JSON.parse(txt);
      for (const k of ["xiankuang", "bianhua", "jianyi", "tixing"])
        if (typeof out[k] !== "string") out[k] = "";
      return new Response(JSON.stringify(out), { headers: corsHeaders() });
    } catch (e) {
      return new Response(JSON.stringify({ error: "divine_failed", detail: String(e && e.message || e).slice(0, 200) }),
        { status: 500, headers: corsHeaders() });
    }
  }
};
