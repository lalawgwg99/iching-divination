/* 易問 app.js */
const API_BASE = "https://yiwen-api.taicalc.com";
let GUA = [], SYM = {}, BH = {};
let cur = null;
let ME = null;
async function loadMe() {
  try {
    const r = await fetch(API_BASE + "/api/me", { credentials: "include" });
    ME = await r.json();
  } catch (e) { ME = { loggedIn: false }; }
  renderAuth(); renderQuota();
}
function renderAuth() {
  const box = $("authBox");
  if (!ME || !ME.loggedIn) {
    box.innerHTML = `<button class="line-btn" onclick="location.href=API_BASE+'/auth/line'">用 LINE 登入</button>`;
    return;
  }
  const planLbl = ME.plan === "monthly" ? "月訂會員" : "免費會員";
  box.innerHTML = `<span class="userchip">${ME.picture ? `<img src="${ME.picture}" alt="">` : ""}
    <span>${esc(ME.name || "會員")}</span><span class="plan ${ME.plan}">${planLbl}</span>
    <a href="${API_BASE}/auth/logout">登出</a></span>`;
}
function plansHTML() {
  return `<div class="plans">
    <div class="plan-card"><div class="pn">單次包</div><div class="pp">NT$49</div>
      <div class="pd">10 次 AI 解卦<br>用完再買就好</div>
      <button onclick="buyPlan('single')">購買</button></div>
    <div class="plan-card hot"><span class="tag">划算</span><div class="pn">月訂無限</div>
      <div class="pp">NT$149<small>/月</small></div>
      <div class="pd">每天問到飽<br>隨時可取消</div>
      <button onclick="buyPlan('monthly')">訂閱</button></div>
  </div>`;
}
async function buyPlan(plan) {
  try {
    const r = await fetch(API_BASE + "/api/order", { method: "POST",
      credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }) });
    const d = await r.json();
    if (!r.ok) { alert(d.error === "login_required" ? "請先用 LINE 登入" : "目前無法建立訂單，請稍後再試"); return; }
    const f = document.createElement("form");
    f.method = "POST"; f.action = d.action;
    for (const k in d.params) {
      const i = document.createElement("input");
      i.type = "hidden"; i.name = k; i.value = d.params[k]; f.appendChild(i);
    }
    document.body.appendChild(f); f.submit();
  } catch (e) { alert("連線失敗，請稍後再試"); }
}
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
} // {ben, zhi, yaos:[{type,label,moving}], movingIdx:[], question, method}

const $ = id => document.getElementById(id);

async function load() {
const [g, s, b] = await Promise.all([
fetch("data/gua.json").then(r => r.json()),
fetch("data/gua_symbols.json").then(r => r.json()),
fetch("data/baihua.json").then(r => r.json()).catch(() => ({})),
]);
GUA = g; SYM = s; BH = b;
buildPick(); renderHist(); renderQuota(); renderDaily();
const yr = $("year"); if (yr) yr.textContent = new Date().getFullYear();
}
const byName = n => GUA.find(g => g.name === n);
const symOf = n => SYM[n] || "";
const bhOf = n => (BH[n]? BH[n].baihua: "");
const qsOf = n => (BH[n]? BH[n].qishi: "");

/* ---------- 起卦 ---------- */
const TRILBL = {乾:"乾 ☰",兌:"兌 ☱",離:"離 ☲",震:"震 ☳",巽:"巽 ☴",坎:"坎 ☵",艮:"艮 ☶",坤:"坤 ☷"};

// coin: 每爻擲三枚， 字=3 / 花=2 ； 6老陰(變) 7少陽 8少陰 9老陽(變)
function coinYao() {
let v = 0;
for (let i = 0; i < 3; i++) v += Math.random() < 0.5? 3: 2;
return v; // 6,7,8,9
}
function labelOf(yang, i) {
const p = ["初", "二", "三", "四", "五", "上"][i];
return p + (yang? "九": "六");
}
function findGua(yaos) {
// yaos: bottom-up [{yang}]
const bits = yaos.map(y => y.yang? "1": "0");
const tri = b => ({ "111": "乾", "110": "兌", "101": "離", "100": "震", "011": "巽", "010": "坎", "001": "艮", "000": "坤"})[b];
const lower = tri(bits.slice(0, 3).join(""));
const upper = tri(bits.slice(3, 6).join(""));
return GUA.find(g => g.lower_trigram === lower && g.upper_trigram === upper);
}
const TRIBITS = {乾:[1,1,1],兌:[1,1,0],離:[1,0,1],震:[1,0,0],巽:[0,1,1],坎:[0,1,0],艮:[0,0,1],坤:[0,0,0]};
function yaoBitsOf(name) {
const g = byName(name);
return [...TRIBITS[g.lower_trigram], ...TRIBITS[g.upper_trigram]];
}
function guaLinesHTML(name, movingIdx, mini) {
const bits = yaoBitsOf(name);
let h = `<div class="gua-lines${mini ? " mini" : ""}">`;
for (let p = 0; p < 6; p++) {
const bi = 5 - p;
const mv = movingIdx && movingIdx.indexOf(bi) >= 0;
h += `<i class="${bits[bi] ? "yang" : "yin"}"${mv ? ' style="background:var(--cinnabar);"' : ""}></i>`;
}
return h + "</div>";
}

let mode = "coin";
$("modes").addEventListener("click", e => {
const b = e.target.closest("button"); if (!b) return;
mode = b.dataset.m;
document.querySelectorAll("#modes button").forEach(x => x.classList.toggle("on", x === b));
renderModeExtra();
});
function renderModeExtra() {
const MODE_DESC = {
coin: "心裡有事，讓機率決定卦象——最傳統的問法。傳統以三枚錢幣擲六次成卦，此處以數位隨機模擬，誠心則靈。",
time: "用現在的時間起卦，適合隨手一問，不用錢幣。",
pick: "不問事，直接查卦：當易經辭典用，看某卦的卦辭、爻辭與白話。"
};
const ex = $("modeExtra");
let h = `<div class="hint" style="margin-bottom:10px;">${MODE_DESC[mode]}</div>`;
if (mode === "time") {
const d = new Date();
h += `<div class="hint">將以現在時間起卦：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}時</div>`;
} else if (mode === "pick") {
h += `<select id="pickSel">${GUA.map(g => `<option value="${g.name}">${g.n}. ${g.name}</option>`).join("")}</select>`;
}
ex.innerHTML = h;
$("goDivine").textContent = mode === "pick" ? "查 卦" : "起 卦";
$("q").placeholder = mode === "pick" ? "查卦不用寫問題，直接選卦即可（也可以寫下想了解的角度）" : "把你心裡的事寫下來，越具體越好。例如：我該不該接下這個新專案？";
}
function buildPick() { renderModeExtra();}

function doDivine() {
let q = $("q").value.trim();
if (!q) {
if (mode === "pick") { q = `我想了解「${$("pickSel").value}」卦`; }
else { alert("請先寫下你想問的事"); $("q").focus(); return;}
}
let yaos;
if (mode === "coin") {
yaos = []; for (let i = 0; i < 6; i++) { const v = coinYao(); const yg = (v === 7 || v === 9); yaos.push({yang: yg, moving: (v === 6 || v === 9), label: labelOf(yg, i)});}
} else if (mode === "time") {
const d = new Date();
const up = (d.getFullYear() + d.getMonth() + 1 + d.getDate()) % 8;
const lo = (d.getFullYear() + d.getMonth() + 1 + d.getDate() + d.getHours()) % 8;
const mv = (d.getFullYear() + d.getMonth() + 1 + d.getDate() + d.getHours()) % 6;
    const mvIdx = mv === 0 ? 5 : mv - 1; // 餘 0 為上爻
const triBits = { 乾: [1,1,1], 兌: [1,1,0], 離: [1,0,1], 震: [1,0,0], 巽: [0,1,1], 坎: [0,1,0], 艮: [0,0,1], 坤: [0,0,0]};
const names = ["坤", "乾", "兌", "離", "震", "巽", "坎", "艮"]; // 餘數對應
const upN = names[up], loN = names[lo];
const bits = [...triBits[loN],...triBits[upN]];
yaos = bits.map((b, i) => ({ yang:!!b, moving: i === mvIdx, label: labelOf(!!b, i)}));
} else {
const name = $("pickSel").value;
const g = byName(name);
const triBits = { 乾: [1,1,1], 兌: [1,1,0], 離: [1,0,1], 震: [1,0,0], 巽: [0,1,1], 坎: [0,1,0], 艮: [0,0,1], 坤: [0,0,0]};
const bits = [...triBits[g.lower_trigram],...triBits[g.upper_trigram]];
yaos = bits.map((b, i) => ({ yang:!!b, moving: false, label: labelOf(!!b, i)}));
}
const ben = findGua(yaos);
const zhiYaos = yaos.map(y => y.moving? {...y, yang:!y.yang, moving: false}: y);
const zhi = findGua(zhiYaos);
cur = { ben, zhi, yaos, zhiYaos, question: q, method: mode, at: Date.now()};
const btn = $("goDivine"); const btnTxt = btn.textContent;
btn.disabled = true; btn.textContent = "觀變中…";
showEl($("guaCard")); showEl($("aiCard"));
$("aiOut").innerHTML = `<div class="ai-guide">卦象已定，靜心觀卦。<br>想聽白話解讀，請按「白話解卦」。</div>`;
$("shareBtn").disabled = true;
$("askAgain").style.display = "none";
renderGuaHead();
$("yaoLines").innerHTML = "";
for (let gi = 0; gi < 6; gi++) {
$("yaoLines").insertAdjacentHTML("beforeend", `<div class="yao ghost"><div class="yao-top"><span class="lbl">　</span><div class="bar"><i></i></div></div></div>`);
}
saveHist();
$("guaCard").scrollIntoView({ behavior: "smooth"});
let _i = 0;
const tick = () => {
if (_i < 6) {
const gh = $("yaoLines").querySelector(".yao.ghost");
if (gh) gh.remove();
$("yaoLines").insertAdjacentHTML("beforeend", yaoHTML(cur.yaos[_i], _i));
_i++; setTimeout(tick, 450);
} else {
renderGuaRest();
btn.disabled = false; btn.textContent = btnTxt;
}
};
tick();
}

function showEl(el) {
el.style.display = "";
el.classList.remove("reveal"); void el.offsetWidth; el.classList.add("reveal");
}

function renderGuaHead() {
const { ben, yaos } = cur;
$("gSym").innerHTML = guaLinesHTML(ben.name, yaos.map((y, i) => y.moving ? i : -1).filter(i => i >= 0));
$("gName").textContent = "第" + ben.n + "卦・" + ben.name;
$("gTri").textContent = ben.lower_trigram + "下" + ben.upper_trigram + "上";
$("gGuaci").textContent = "";
$("gBaihua").textContent = "";
$("movingWrap").innerHTML = "";
$("zhiWrap").innerHTML = "";
}
function yaoHTML(y, i) {
const yy = cur.ben.yao[i];
return `<div class="yao in${y.yang? " yang": " yin"}${y.moving? " moving": ""}">
<div class="yao-top"><span class="lbl">${y.label}</span><span class="mvbadge">變</span>
<div class="bar">${y.yang? "<i></i>": '<i class="left"></i><i class="right"></i>'}</div></div>
<p class="yao-text">${yy? yy.text: ""}</p></div>`;
}
function renderGuaRest() {
const { ben, zhi, yaos } = cur;
$("gGuaci").textContent = "" + ben.guaci;
$("gBaihua").textContent = "" + (bhOf(ben.name) || qsOf(ben.name) || "（白話解讀整理中）");
const mv = yaos.map((y, i) => y.moving? i: -1).filter(i => i >= 0);
if (mv.length) {
$("movingWrap").innerHTML = `<h3 class="mh-title">變爻（${mv.length}）</h3><div class="moving-list">` +
mv.map(i => `<div class="mi"><b>${yaos[i].label}</b>：${ben.yao[i].text}<div class="zhi-link"><span class="zw">變為</span>　之卦「${zhi.name}」${zhi.yao[i].label}：${zhi.yao[i].text}</div></div>`).join("") + `</div>`;
showEl($("movingWrap"));
requestAnimationFrame(() => {
document.querySelectorAll("#yaoLines .yao.moving").forEach(e => e.classList.add("fresh"));
setTimeout(() => document.querySelectorAll("#yaoLines .yao.fresh").forEach(e => e.classList.remove("fresh")), 1400);
});
$("zhiWrap").innerHTML = `<div class="mh-title">之卦</div><div class="guaci zhi" style="margin-top:8px;"><b>${zhi.name}</b>（${zhi.lower_trigram}下${zhi.upper_trigram}上）<br>${zhi.guaci}<div class="baihua">${bhOf(zhi.name) || ""}</div></div>`;
showEl($("zhiWrap"));
} else {
$("movingWrap").innerHTML = `<div class="hint">無變爻。此卦氣專一，取卦辭斷之。</div>`;
$("zhiWrap").innerHTML = "";
}
}

/* ---------- AI 解卦 ---------- */
function quotaKey() { const d = new Date(); return `yiwen_quota_${d.getFullYear()}_${d.getMonth() + 1}`;}
function quotaLeft() {
let q; try { q = JSON.parse(localStorage.getItem(quotaKey()) || '{"n":0}');} catch { q = { n: 0};}
return Math.max(0, 3 - q.n);
}
function useQuota() {
let q; try { q = JSON.parse(localStorage.getItem(quotaKey()) || '{"n":0}');} catch { q = { n: 0};}
q.n++; localStorage.setItem(quotaKey(), JSON.stringify(q)); renderQuota();
}
function renderQuota() {
if (ME && ME.loggedIn) { renderQuotaMember(); return; }
const n = quotaLeft();
$("quotaBox").innerHTML = n > 0
? `這個月還能請 AI 解卦 <b style="font-size:1.5rem;">${n}</b> 次`
: `本月免費額度已用完。付費無限解卦即將開放，<b>留下 Email 可第一時間收到通知</b>。<div style="margin-top:10px;display:flex;gap:8px;"><input id="waitEmail" placeholder="your@email.com" style="flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:1rem;"><button id="waitBtn" class="btn" style="margin:0;width:auto;padding:10px 18px;letter-spacing:.1em;text-indent:0;">通知我</button></div>`;
function renderQuotaMember() {
  const box = $("quotaBox");
  if (ME.plan === "monthly") {
    box.innerHTML = `月訂會員・無限解卦 <span style="color:var(--ink2);font-size:.85rem;">有效期至 ${new Date(ME.expiresAt * 1000).toLocaleDateString("zh-TW")}</span>`;
    return;
  }
  const parts = [];
  if (ME.freeLeft > 0) parts.push(`本月免費 <b style="font-size:1.5rem;">${ME.freeLeft}</b> 次`);
  if (ME.credits > 0) parts.push(`單次包剩餘 <b style="font-size:1.5rem;color:var(--cinnabar);">${ME.credits}</b> 次`);
  if (!parts.length) {
    box.innerHTML = `免費額度用完了，升級繼續問：` + plansHTML();
    return;
  }
  box.innerHTML = parts.join("・");
}
const wb = $("waitBtn");
if (wb) wb.onclick = () => {
const em = $("waitEmail").value.trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { alert("Email 格式不對喔"); return;}
const l = JSON.parse(localStorage.getItem("yiwen_waitlist") || "[]"); l.push({ em, at: Date.now()});
localStorage.setItem("yiwen_waitlist", JSON.stringify(l));
$("quotaBox").innerHTML = "已收到！開放時第一時間通知你。";
};
}

async function goAI() {
if (!(ME && ME.loggedIn) && quotaLeft() <= 0) { alert("本月免費額度用完囉"); return;}
const btn = $("goAI"); const btnTxt = btn.textContent;
btn.disabled = true; btn.textContent = "解卦中…";
const AI_STAGES = ["正在觀本卦…", "正在參詳變爻…", "正在寫白話解卦…"];
let aiStageI = 0;
$("aiOut").innerHTML = `<div class="loading"><div style="font-size:.8rem;letter-spacing:.3em;color:var(--ink2);margin-bottom:12px;">觀卦中</div><div class="hexload"><i></i><i></i><i></i><i></i><i></i><i></i></div><div id="aiStageTxt">正在觀本卦…</div></div>`;
const aiTimer = setInterval(() => { aiStageI = (aiStageI + 1) % AI_STAGES.length; const el = $("aiStageTxt"); if (el) el.textContent = AI_STAGES[aiStageI]; }, 3000);
try {
const { ben, zhi, yaos, question} = cur;
const moving = yaos.map((y, i) => y.moving? { label: y.label, ben: ben.yao[i].text, zhi: zhi.yao[i].text, zhiLabel: zhi.yao[i].label}: null).filter(Boolean);
const r = await fetch(API_BASE + "/divine", {
method: "POST", credentials: "include", headers: { "Content-Type": "application/json"},
body: JSON.stringify({
question,
benGua: { name: ben.name, n: ben.n, guaci: ben.guaci, baihua: bhOf(ben.name)},
moving, zhiGua: { name: zhi.name, n: zhi.n, guaci: zhi.guaci, baihua: bhOf(zhi.name)}
})
});
if (r.status === 402) {
  clearInterval(aiTimer);
  $("aiOut").innerHTML = `<div class="loading">免費額度用完了，升級繼續問：</div>` + plansHTML();
  btn.disabled = false; btn.textContent = btnTxt; return;
}
if (!r.ok) throw new Error("服務暫時忙線中（" + r.status + "）");
const d = await r.json();
if (ME && ME.loggedIn) { loadMe(); } else { useQuota(); }
const blocks = [["現況", d.xiankuang], ["變數", d.bianhua], ["建議", d.jianyi], ["提醒", d.tixing]];
$("aiOut").innerHTML = `<div class="ai-sec">` + blocks.map((b, i) =>
`<div class="ai-block" style="animation-delay:${(i * 0.12).toFixed(2)}s"><h3>${b[0]}</h3><p>${esc(b[1])}</p></div>`).join("") + `<div class="closing">卦已觀畢，心中有數<br><span>決定，永遠在你手上。</span></div></div>`;
cur.ai = d; saveHist();
clearInterval(aiTimer);
$("shareBtn").disabled = false;
$("askAgain").style.display = "";
} catch (e) {
clearInterval(aiTimer);
$("aiOut").innerHTML = `<div class="loading">解卦失敗，請稍後再試（服務暫時忙線中）。</div>`;
}
btn.disabled = false; btn.textContent = btnTxt;
}
const esc = s => String(s == null? "": s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

/* ---------- 歷史 ---------- */
function saveHist() {
let h = []; try { h = JSON.parse(localStorage.getItem("yiwen_hist") || "[]");} catch {}
h.unshift({ q: cur.question, ben: cur.ben.name, zhi: cur.zhi.name, at: cur.at, ai: cur.ai || null});
localStorage.setItem("yiwen_hist", JSON.stringify(h.slice(0, 30)));
renderHist();
}
function renderHist() {
let h = []; try { h = JSON.parse(localStorage.getItem("yiwen_hist") || "[]");} catch {}
if (!h.length) return;
$("histCard").style.display = "";
$("histList").innerHTML = h.map((x) => `<div class="hist-item${x.ai ? " solved" : ""}"><span class="t">${new Date(x.at).toLocaleString("zh-TW")}</span><b>${guaLinesHTML(x.ben, null, true)} ${x.ben}</b> → ${x.zhi}<br><span style="color:var(--ink2);font-size:.88rem;">${esc(x.q.slice(0, 40))}</span></div>`).join("");
}

/* ---------- 分享圖卡 ---------- */
function shareCard() {
if (!cur) return;
const c = $("shareCanvas"), x = c.getContext("2d");
const W = 1080, H = 1350;
x.fillStyle = "#f6f2e8"; x.fillRect(0, 0, W, H);
x.strokeStyle = "#1e3a2f"; x.lineWidth = 6; x.strokeRect(36, 36, W - 72, H - 72);
x.fillStyle = "#b03a2e"; x.fillRect(W / 2 - 46, 110, 92, 92);
x.fillStyle = "#fff"; x.font = "52px serif"; x.textAlign = "center"; x.fillText("易", W / 2, 178);
x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 3; x.strokeRect(W / 2 - 46 + 7, 110 + 7, 92 - 14, 92 - 14);
x.fillStyle = "#22201b"; x.font = "64px serif";
x.fillText("易 問", W / 2, 300);
x.fillStyle = "#5c564a"; x.font = "30px serif"; x.fillText("問事・起卦・觀變", W / 2, 348);
// 手繪卦符爻線（不用系統字體卦符）
(function(){
const bits = yaoBitsOf(cur.ben.name);
const topY = 430, lh = 26, lw = 150, cx = W / 2;
x.fillStyle = "#22201b";
bits.forEach((b, i) => {
const y = topY + (5 - i) * lh;
if (b) { x.fillRect(cx - lw / 2, y, lw, 12); }
else { x.fillRect(cx - lw / 2, y, lw / 2 - 12, 12); x.fillRect(cx + 12, y, lw / 2 - 12, 12); }
});
})();
x.font = "54px serif"; x.fillText(`第${cur.ben.n}卦・${cur.ben.name}`, W / 2, 640);
x.fillStyle = "#5c564a"; x.font = "32px serif";
x.fillText(`${cur.ben.lower_trigram}下${cur.ben.upper_trigram}上`, W / 2, 690);
// 爻
cur.yaos.forEach((y, i) => {
const yy = H - 620 + (5 - i) * 62, cx = W / 2, hw = 200;
x.fillStyle = y.moving? "#b03a2e": "#22201b";
if (y.yang) x.fillRect(cx - hw, yy, hw * 2, 14);
else { x.fillRect(cx - hw, yy, hw - 24, 14); x.fillRect(cx + 24, yy, hw - 24, 14);}
});
// 雙線框：古風卷軸感
x.strokeStyle = "#1e3a2f"; x.lineWidth = 2; x.strokeRect(52, 52, W - 104, H - 104);
// 文字自動換行（中文逐字量測），絕不溢出
function wrapLines(text, maxW, maxLines) {
  const lines = []; let line = "";
  for (const ch of text) {
    if (x.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
    else line += ch;
    if (lines.length === maxLines) { line = ""; break; }
  }
  if (line) lines.push(line);
  const consumed = lines.join("").length;
  if (consumed < text.length && lines.length) lines[lines.length - 1] += "…";
  return lines.slice(0, maxLines);
}
x.textAlign = "center";
x.fillStyle = "#5c564a"; x.font = "30px serif";
wrapLines("問：" + cur.question, 880, 2).forEach((ln, i) => x.fillText(ln, W / 2, H - 250 + i * 44));
if (cur.ai && cur.ai.jianyi) {
  x.fillStyle = "#1e3a2f"; x.font = "28px serif";
  wrapLines(cur.ai.jianyi, 880, 3).forEach((ln, i) => x.fillText(ln, W / 2, H - 140 + i * 42));
}
x.fillStyle = "#8a8474"; x.font = "24px serif";
x.fillText("易問・觀變玩占", W / 2, H - 78);
const a = document.createElement("a");
a.download = `易問_${cur.ben.name}.png`;
a.href = c.toDataURL("image/png"); a.click();
}

/* ---------- v3：每日一卦 ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let DAILY = null;
function renderDaily() {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const rnd = mulberry32(seed);
  const g = GUA[Math.floor(rnd() * 64)];
  const yi = Math.floor(rnd() * 6);
  DAILY = { g, yi, date: now };
  const wd = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
  $("dailyDate").textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日・星期${wd}`;
  $("dailyHex").innerHTML = guaLinesHTML(g.name);
  $("dailyName").textContent = `第${g.n}卦・${g.name}`;
  $("dailyGuaci").textContent = g.guaci;
  $("dailyBaihua").textContent = bhOf(g.name);
  $("dailyQs").innerHTML = `<b>今日啟示</b><br>${esc(qsOf(g.name))}`;
  const yao = g.yao[yi];
  $("dailyYao").innerHTML = `今日之爻・<b>${yao.label}</b>「${esc(yao.text)}」`;
}
function wrapLinesC(x, text, maxW, maxLines) {
  const lines = []; let line = "";
  for (const ch of text) {
    if (x.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
    else line += ch;
    if (lines.length === maxLines) { line = ""; break; }
  }
  if (line) lines.push(line);
  const consumed = lines.join("").length;
  if (consumed < text.length && lines.length) lines[lines.length - 1] += "…";
  return lines.slice(0, maxLines);
}
function dailyCard() {
  if (!DAILY) return;
  const { g, yi, date } = DAILY;
  const c = $("shareCanvas"), x = c.getContext("2d");
  const W = 1080, H = 1350;
  x.fillStyle = "#f6f2e8"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#1e3a2f"; x.lineWidth = 6; x.strokeRect(36, 36, W - 72, H - 72);
  x.strokeStyle = "#1e3a2f"; x.lineWidth = 2; x.strokeRect(52, 52, W - 104, H - 104);
  x.fillStyle = "#b03a2e"; x.fillRect(W / 2 - 46, 96, 92, 92);
  x.fillStyle = "#fff"; x.font = "52px serif"; x.textAlign = "center"; x.fillText("易", W / 2, 164);
  x.fillStyle = "#22201b"; x.font = "60px serif";
  x.fillText("易 問", W / 2, 280);
  x.fillStyle = "#5c564a"; x.font = "30px serif"; x.fillText("每日一卦", W / 2, 328);
  const wd = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  x.fillStyle = "#8a8474"; x.font = "28px serif";
  x.fillText(`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日・星期${wd}`, W / 2, 372);
  const bits = yaoBitsOf(g.name);
  const topY = 430, lh = 30, lw = 170, cx = W / 2;
  x.fillStyle = "#22201b";
  bits.forEach((b, i) => {
    const y = topY + (5 - i) * lh;
    if (b) x.fillRect(cx - lw / 2, y, lw, 13);
    else { x.fillRect(cx - lw / 2, y, lw / 2 - 13, 13); x.fillRect(cx + 13, y, lw / 2 - 13, 13); }
  });
  let yy = 700;
  x.fillStyle = "#22201b"; x.font = "56px serif";
  x.fillText(`第${g.n}卦・${g.name}`, W / 2, yy); yy += 62;
  x.fillStyle = "#5c564a"; x.font = "30px serif";
  wrapLinesC(x, g.guaci, 880, 2).forEach(ln => { x.fillText(ln, W / 2, yy); yy += 46; });
  yy += 18;
  x.fillStyle = "#8a8474"; x.font = "28px serif";
  wrapLinesC(x, bhOf(g.name), 880, 2).forEach(ln => { x.fillText(ln, W / 2, yy); yy += 44; });
  yy += 24;
  x.fillStyle = "#b03a2e"; x.font = "34px serif";
  x.fillText("今日啟示", W / 2, yy); yy += 48;
  x.fillStyle = "#22201b"; x.font = "32px serif";
  wrapLinesC(x, qsOf(g.name), 880, 3).forEach(ln => { x.fillText(ln, W / 2, yy); yy += 48; });
  yy += 20;
  const yao = g.yao[yi];
  x.fillStyle = "#5c564a"; x.font = "28px serif";
  wrapLinesC(x, `今日之爻・${yao.label}「${yao.text}」`, 880, 2).forEach(ln => { x.fillText(ln, W / 2, yy); yy += 44; });
  x.fillStyle = "#b03a2e"; x.font = "26px serif";
  x.fillText("易問・觀變玩占", W / 2, H - 92);
  const a = document.createElement("a");
  a.download = `易問_每日一卦_${date.getMonth() + 1}${date.getDate()}.png`;
  a.href = c.toDataURL("image/png"); a.click();
}
$("dailyShare").addEventListener("click", dailyCard);

$("goDivine").addEventListener("click", doDivine);
$("goAI").addEventListener("click", goAI);
(function handleReturn() {
  const q = new URLSearchParams(location.search);
  if (q.get("login") === "ok") { toast("登入成功，歡迎回來"); history.replaceState(null, "", location.pathname); }
  if (q.get("login") === "fail") { toast("登入失敗，請再試一次"); history.replaceState(null, "", location.pathname); }
  if (q.get("paid") === "1") { toast("付款成功，額度已入帳"); history.replaceState(null, "", location.pathname); setTimeout(() => loadMe(), 1500); }
})();
$("shareBtn").addEventListener("click", shareCard);
$("askAgain").addEventListener("click", () => {
$("q").value = "";
window.scrollTo({ top: 0, behavior: "smooth" });
setTimeout(() => { try { $("q").focus({ preventScroll: true }); } catch (e) { $("q").focus(); } }, 650);
});
loadMe();
load();
