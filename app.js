/* 易問 app.js */
const API_BASE = "https://yiwen-api.taicalc.com";
const TESTING_UNLIMITED = true; // 測試期：AI 解卦＋追問不限次數，不需登入
let GUA = [], SYM = {}, BH = {};
let cur = null;
let ME = null;
async function loadMe() {
  try {
    const r = await fetch(API_BASE + "/api/me", { credentials: "include" });
    ME = await r.json();
  } catch (e) { ME = { loggedIn: false }; }
  renderAuth(); renderQuota();
  if (ME && ME.loggedIn) { syncHistory(); }
}
function renderAuth() {
  const box = $("authBox");
  if (!ME || !ME.loggedIn) {
    box.innerHTML = `<div class="auth-menu">
      <button class="auth-btn" id="authToggle">登入</button>
      <div class="auth-panel" id="authPanel">
        <div class="hint">登入後占問記錄跨裝置同步。<br>測試期間不用登入也能無限使用。</div>
        <button class="line-btn" onclick="location.href=API_BASE+'/auth/line'">用 LINE 登入</button>
        <button class="google-btn" onclick="location.href=API_BASE+'/auth/google'">用 Google 登入</button>
      </div></div>`;
  } else {
    const planLbl = ME.plan === "monthly" ? "月訂會員" : "免費會員";
    let quota;
    if (ME.plan === "monthly") {
      quota = `月訂有效期至 ${new Date(ME.expiresAt * 1000).toLocaleDateString("zh-TW")}`;
    } else {
      const p = [];
      if (ME.freeLeft > 0) p.push(`本月免費剩 ${ME.freeLeft} 次`);
      if (ME.credits > 0) p.push(`單次包剩 ${ME.credits} 次`);
      quota = p.join("<br>") || "免費額度已用完，可購買方案";
    }
    box.innerHTML = `<div class="auth-menu">
      <button class="auth-btn" id="authToggle">${ME.picture ? `<img src="${ME.picture}" alt="">` : ""}<span>${esc(ME.name || "會員")}</span></button>
      <div class="auth-panel" id="authPanel">
        <div class="me-name">${esc(ME.name || "會員")}<span class="plan ${ME.plan}">${planLbl}</span></div>
        <div class="me-quota">${quota}</div>
        <a class="logout" href="${API_BASE}/auth/logout">登出</a>
      </div></div>`;
  }
  $("authToggle").onclick = e => { e.stopPropagation(); $("authPanel").classList.toggle("open"); };
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
const _due = getHist().filter(x => !x.rv && Date.now() - x.at >= RV_DUE).length;
if (_due > 0) setTimeout(() => toast(`有 ${_due} 卦可以寫覆盤了`), 2600);
const yr = $("year"); if (yr) yr.textContent = new Date().getFullYear();
}
const byName = n => GUA.find(g => g.name === n);
const symOf = n => SYM[n] || "";
const bhOf = n => (BH[n]? BH[n].baihua: "");
const qsOf = n => (BH[n]? BH[n].qishi: "");

/* ---------- 起卦 ---------- */
const TRILBL = {乾:"乾 ☰",兌:"兌 ☱",離:"離 ☲",震:"震 ☳",巽:"巽 ☴",坎:"坎 ☵",艮:"艮 ☶",坤:"坤 ☷"};

// coin: 每爻擲三枚， 字=3 / 花=2 ； 6老陰(變) 7少陽 8少陰 9老陽(變)
function coinToss() {
const faces = [0, 0, 0].map(() => Math.random() < 0.5 ? 3 : 2);
return { v: faces[0] + faces[1] + faces[2], faces }; // 6,7,8,9
}
/* 銅錢音效（WebAudio 合成，無需音檔） */
let _AC = null;
function clink(delay) {
try {
_AC = _AC || new (window.AudioContext || window.webkitAudioContext)();
if (_AC.state === "suspended") _AC.resume();
const t = _AC.currentTime + (delay || 0);
const o = _AC.createOscillator(), g = _AC.createGain();
o.type = "triangle"; o.frequency.value = 2600 + Math.random() * 900;
g.gain.setValueAtTime(0.0001, t);
g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
o.connect(g); g.connect(_AC.destination);
o.start(t); o.stop(t + 0.25);
} catch (e) {}
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
pickUpper = null; pickLower = null;
h += `<div id="pickGrids"></div>`;
}
ex.innerHTML = h;
if (mode === "pick") renderPickGrids();
$("goDivine").textContent = mode === "pick" ? "查 卦" : "起 卦";
$("q").placeholder = mode === "pick" ? "查卦不用寫問題，直接選卦即可（也可以寫下想了解的角度）" : "把你心裡的事寫下來，越具體越好。例如：我該不該接下這個新專案？";
}
function buildPick() { renderModeExtra();}
const TRI_SYM = {乾:"☰",兌:"☱",離:"☲",震:"☳",巽:"☴",坎:"☵",艮:"☶",坤:"☷"};
const TRIS = ["乾","兌","離","震","巽","坎","艮","坤"];
let pickUpper = null, pickLower = null;
function triGridHTML(sel, step) {
return `<div class="tri-grid">` + TRIS.map(t =>
`<button class="tri-cell${sel === t ? " on" : ""}" data-tri="${t}" data-step="${step}"><span class="ts">${TRI_SYM[t]}</span><span class="tn">${t}</span></button>`).join("") + `</div>`;
}
function renderPickGrids() {
const w = $("pickGrids"); if (!w) return;
let h = `<div class="hint" style="margin-bottom:6px;">第一步・選上卦</div>` + triGridHTML(pickUpper, "up");
if (pickUpper) {
h += `<div class="hint" style="margin:10px 0 6px;">上卦已定：${pickUpper}${TRI_SYM[pickUpper]}・<a href="#" id="pickReset" style="color:var(--cinnabar);">重選</a></div>`;
h += `<div class="reveal"><div class="hint" style="margin-bottom:6px;">第二步・選下卦</div>` + triGridHTML(pickLower, "lo") + `</div>`;
}
w.innerHTML = h;
w.querySelectorAll(".tri-cell").forEach(b => b.onclick = () => {
if (b.dataset.step === "up") { pickUpper = b.dataset.tri; pickLower = null; }
else pickLower = b.dataset.tri;
renderPickGrids();
});
const rs = $("pickReset");
if (rs) rs.onclick = e => { e.preventDefault(); pickUpper = null; pickLower = null; renderPickGrids(); };
}
function pickedGua() {
if (!pickUpper || !pickLower) return null;
return GUA.find(g => g.upper_trigram === pickUpper && g.lower_trigram === pickLower) || null;
}

function doDivine() {
$("followWrap").style.display = "none";
let q = $("q").value.trim();
if (!q) {
if (mode === "pick") { const pg = pickedGua(); if (!pg) { alert("請先選上卦、下卦"); return; } q = `我想了解「${pg.name}」卦`; }
else { alert("請先寫下你想問的事"); $("q").focus(); return;}
}
let yaos;
if (mode === "coin") {
yaos = []; for (let i = 0; i < 6; i++) { const { v, faces } = coinToss(); const yg = (v === 7 || v === 9); yaos.push({yang: yg, moving: (v === 6 || v === 9), label: labelOf(yg, i), faces});}
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
const g = pickedGua();
if (!g) { alert("請先選上卦、下卦"); return; }
const name = g.name;
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
/* 擲錢幣儀式：每爻三枚銅錢翻落，逐爻成卦 */
const NUM = ["一", "二", "三", "四", "五", "六"];
function ritualTick(i) {
if (i >= 6) { renderGuaRest(); btn.disabled = false; btn.textContent = btnTxt; return; }
const y = cur.yaos[i];
const st = $("coinStage");
st.style.display = "";
st.innerHTML = `<div class="round-lbl">第${NUM[i]}爻・靜心擲</div><div class="coins">` +
y.faces.map(f => `<div class="coin ${f === 3 ? "toss-zi" : "toss-hua"}"><div class="face front">字</div><div class="face back">花</div></div>`).join("") + `</div>`;
clink(0); clink(0.13); clink(0.26);
setTimeout(() => {
const gh = $("yaoLines").querySelector(".yao.ghost");
if (gh) gh.remove();
$("yaoLines").insertAdjacentHTML("beforeend", yaoHTML(y, i));
st.style.display = "none"; st.innerHTML = "";
setTimeout(() => ritualTick(i + 1), 200);
}, 1000);
}
if (mode === "coin") { $("coinStage").style.display = ""; ritualTick(0); }
else { $("coinStage").style.display = "none"; tick(); }
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
if (TESTING_UNLIMITED) { $("quotaBox").innerHTML = `測試期間・AI 解卦<b style="font-size:1.2rem;">無限</b>使用，不用登入，盡量問`; return; }
const n = quotaLeft();
$("quotaBox").innerHTML = n > 0
? `這個月還能請 AI 解卦 <b style="font-size:1.5rem;">${n}</b> 次`
: `本月免費額度已用完。付費無限解卦即將開放，<b>留下 Email 可第一時間收到通知</b>。<div style="margin-top:10px;display:flex;gap:8px;"><input id="waitEmail" placeholder="your@email.com" style="flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:1rem;"><button id="waitBtn" class="btn" style="margin:0;width:auto;padding:10px 18px;letter-spacing:.1em;text-indent:0;">通知我</button></div>`;
function renderQuotaMember() {
  const box = $("quotaBox");
  if (typeof TESTING_UNLIMITED !== "undefined" && TESTING_UNLIMITED) { box.innerHTML = `測試期間・AI 解卦<b style="font-size:1.2rem;">無限</b>使用，盡量問`; return; }
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
const btn = $("goAI"); const btnTxt = btn.textContent;
btn.disabled = true; btn.textContent = "解卦中…";
/* 先請 AI 判斷是否需要釐清 */
$("aiOut").innerHTML = `<div class="loading"><div class="hexload"><i></i><i></i><i></i><i></i><i></i><i></i></div><div>解卦師正在看你的問題…</div></div>`;
try {
  const { ben, zhi, question } = cur;
  const cr = await fetch(API_BASE + "/divine/clarify", {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, topic: curTopic, benGua: { name: ben.name, n: ben.n }, zhiGua: { name: zhi.name, n: zhi.n } })
  });
  const cj = await cr.json();
  const qs = (cj.questions || []).filter(q => q && q.trim());
  if (qs.length) { showClarify(qs, btn, btnTxt); return; }
} catch (e) { /* 釐清失敗就直接解 */ }
runDivine([], btn, btnTxt);
}
function showClarify(qs, btn, btnTxt) {
  $("aiOut").innerHTML = `<div class="clarify-box"><div class="cq-title">解卦前，師父想先問${qs.length === 1 ? "一句" : "兩句"}</div>` +
    qs.map((q, i) => `<div class="cq-item"><div class="cq-q">${esc(q)}</div><input class="cq-a" data-i="${i}" placeholder="簡單回一句，或直接跳過"></div>`).join("") +
    `<div class="cq-btns"><button id="cqSkip" class="btn ghost" style="margin:0;">直接解卦</button><button id="cqGo" class="btn cinnabar" style="margin:0;">這樣解</button></div></div>`;
  const collect = () => qs.map((q, i) => {
    const inp = document.querySelector(`.cq-a[data-i="${i}"]`);
    return { q, a: inp ? inp.value.trim() : "" };
  });
  $("cqSkip").onclick = () => runDivine([], btn, btnTxt);
  $("cqGo").onclick = () => runDivine(collect(), btn, btnTxt);
}
async function runDivine(clarify, btn, btnTxt) {
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
question, topic: curTopic, clarify,
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
if (ME && ME.loggedIn) { loadMe(); }
resetFollow();
const blocks = [["現況", d.xiankuang, "xiankuang"], ["變數", d.bianhua, "bianhua"], ["建議", d.jianyi, "jianyi"], ["提醒", d.tixing, "tixing"]];
const zyHTML = d.zhiyin ? `<div class="zhiyin-box"><b>問事指引</b><p>${esc(d.zhiyin)}</p></div>` : "";
$("aiOut").innerHTML = `<div class="ai-sec">` + blocks.map((b, i) =>
`<div class="ai-block k-${b[2]}" style="animation-delay:${(i * 0.12).toFixed(2)}s"><h3>${b[0]}</h3><p>${esc(b[1])}</p>${b[2] === "jianyi" ? zyHTML : ""}</div>`).join("") + `<div class="closing">卦已觀畢，心中有數<br><span>決定，永遠在你手上。</span></div></div>`;
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
const entry = { q: cur.question, topic: curTopic || "", ben: cur.ben.name, zhi: cur.zhi.name, at: cur.at, ai: cur.ai || null};
h.unshift(entry);
setHist(h);
renderHist();
if (ME && ME.loggedIn) {
fetch(API_BASE + "/api/history/add", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: entry }) }).catch(() => {});
}
}
/* 登入後把本地歷史同步上雲（每頁載入一次） */
let _synced = false;
async function syncHistory() {
if (_synced || !(ME && ME.loggedIn)) return;
_synced = true;
try {
const h = getHist();
if (!h.length) return;
await fetch(API_BASE + "/api/history/sync", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: h }) });
} catch (e) {}
}
/* ---------- 覆盤回顧 ---------- */
const RV_DUE = 30 * 86400 * 1000;
const RV_LABEL = { hit: "應驗了", part: "部分應驗", miss: "沒發生", pending: "還在發展中" };
function getHist() { try { return JSON.parse(localStorage.getItem("yiwen_hist") || "[]");} catch { return []; } }
function setHist(h) { localStorage.setItem("yiwen_hist", JSON.stringify(h.slice(0, 30))); }
let _statsCache = null;
async function renderStats() {
const el = $("cloudStat");
if (!el || !(ME && ME.loggedIn)) { if (el) el.innerHTML = ""; return; }
try {
if (!_statsCache) {
const r = await fetch(API_BASE + "/api/stats", { credentials: "include" });
_statsCache = await r.json();
}
const s = _statsCache;
if (!s || !s.total) { el.innerHTML = ""; return; }
const gua = (s.topGua || []).map(g => `${g.name}×${g.c}`).join("、");
const tp = (s.topics || []).map(g => `${g.name}×${g.c}`).join("、");
el.innerHTML = `<div class="rv-stat">☁️ 雲端同步中・累計占卦 ${s.total} 次` +
(gua ? `<br>最常得：${gua}` : "") + (tp ? `<br>常問主題：${tp}` : "") + `</div>`;
} catch (e) {}
}
function renderHist() {
const h = getHist();
if (!h.length) return;
$("histCard").dataset.shown = "1";
if (typeof curTab === "undefined" || curTab === "hist") $("histCard").style.display = "";
const now = Date.now();
const reviewed = h.filter(x => x.rv);
const hit = reviewed.filter(x => x.rv.r === "hit").length;
const stat = reviewed.length ? `<div class="rv-stat">已覆盤 ${reviewed.length} 卦・${hit} 卦應驗</div>` : "";
$("histList").innerHTML = `<div id="cloudStat"></div>` + stat + h.map((x, i) => {
let act;
if (x.rv) act = `<span class="rv-badge ${x.rv.r}">${RV_LABEL[x.rv.r]}</span>`;
else if (now - x.at >= RV_DUE) act = `<button class="rv-btn" onclick="openReview(${i})">寫覆盤</button>`;
else act = `<span class="rv-wait">${Math.ceil((RV_DUE - (now - x.at)) / 86400000)}天後可覆盤</span>`;
return `<div class="hist-item${x.ai ? " solved" : ""}"><span class="t">${new Date(x.at).toLocaleString("zh-TW")}</span><b>${guaLinesHTML(x.ben, null, true)} ${x.ben}</b> → ${x.zhi}<br><span style="color:var(--ink2);font-size:.88rem;">${esc(x.q.slice(0, 40))}</span><div style="margin-top:6px;">${act}</div></div>`;
}).join("");
renderStats();
}
let _rvIdx = null;
function openReview(i) {
_rvIdx = i;
let m = $("rvModal");
if (!m) {
m = document.createElement("div");
m.id = "rvModal";
m.innerHTML = `<div class="cardmodal-bg"></div><div class="cardmodal-box" style="text-align:left;">
<div style="font-size:1.05rem;letter-spacing:.12em;margin-bottom:4px;">覆盤這一卦</div>
<div class="hint">後來事情怎麼發展？誠實面對，卦才會越看越準。</div>
<div class="rv-opts">${Object.keys(RV_LABEL).map(k => `<button data-r="${k}">${RV_LABEL[k]}</button>`).join("")}</div>
<input id="rvNote" placeholder="一句話心得（可不填）" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:.95rem;font-family:inherit;margin-top:10px;background:#fffdf8;">
<div class="cardmodal-actions"><button id="rvSubmit" class="btn">送出覆盤</button><button id="rvClose" class="btn ghost">取消</button></div>
</div>`;
document.body.appendChild(m);
m.querySelector(".cardmodal-bg").onclick = closeReview;
m.querySelector("#rvClose").onclick = closeReview;
m.querySelector("#rvOpts") || m.querySelector(".rv-opts").addEventListener("click", e => {
const b = e.target.closest("button"); if (!b) return;
m.querySelectorAll(".rv-opts button").forEach(x => x.classList.toggle("on", x === b));
});
m.querySelector("#rvSubmit").onclick = submitReview;
}
m.querySelectorAll(".rv-opts button").forEach(x => x.classList.remove("on"));
m.querySelector("#rvNote").value = "";
m.classList.add("open");
}
function closeReview() { const m = $("rvModal"); if (m) m.classList.remove("open"); }
function submitReview() {
const m = $("rvModal");
const sel = m.querySelector(".rv-opts button.on");
if (!sel) { toast("先選一個結果"); return; }
const h = getHist();
if (!h[_rvIdx]) return;
h[_rvIdx].rv = { at: Date.now(), r: sel.dataset.r, note: m.querySelector("#rvNote").value.trim().slice(0, 100) };
setHist(h); closeReview(); renderHist();
toast("覆盤完成");
}

/* ---------- 追問 ---------- */
let followHist = [];
function resetFollow() {
followHist = [];
$("followList").innerHTML = ""; $("followQ").value = "";
$("followWrap").style.display = "";
renderFollowHint();
}
function renderFollowHint() {
const logged = ME && ME.loggedIn;
$("followHint").textContent = "想到什麼就繼續問，不用客氣";
}
async function sendFollow() {
const q = $("followQ").value.trim();
if (!q || !cur || !cur.ai) return;
const logged = ME && ME.loggedIn;

const btn = $("followBtn");
btn.disabled = true;
$("followList").innerHTML += `<div class="f-q">追問：${esc(q)}</div><div class="f-a">參詳中…</div>`;
$("followQ").value = "";
try {
const r = await fetch(API_BASE + "/divine/follow", {
method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
body: JSON.stringify({
question: cur.question, topic: curTopic,
benGua: { name: cur.ben.name, n: cur.ben.n }, zhiGua: { name: cur.zhi.name, n: cur.zhi.n },
prev: cur.ai.jianyi || "", history: followHist, follow: q
})
});
if (r.status === 402) {
$("followList").innerHTML += `<div class="f-a">免費額度用完了，升級繼續問：</div>` + plansHTML();
btn.disabled = false; return;
}
if (!r.ok) throw new Error("busy");
const d = await r.json();
followHist.push({ role: "user", text: q }, { role: "ai", text: d.answer });
if (logged) loadMe(); else useQuota();
renderFollow();
} catch (e) {
$("followList").innerHTML += `<div class="f-a">服務暫時忙線中，請稍後再試。</div>`;
}
btn.disabled = false;
}
function renderFollow() {
let h = "";
for (let i = 0; i < followHist.length; i += 2)
h += `<div class="f-q">追問：${esc(followHist[i].text)}</div><div class="f-a">${esc(followHist[i + 1].text)}</div>`;
$("followList").innerHTML = h;
renderFollowHint();
}
$("followBtn").addEventListener("click", sendFollow);
$("followQ").addEventListener("keydown", e => { if (e.key === "Enter") sendFollow(); });

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
showCardPreview(c.toDataURL("image/png"), `易問_${cur.ben.name}.png`);
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
const REFLECT_Q = {"乾":"今天我主動創造了什麼價值？","坤":"我是否包容接納了不同的聲音？","屯":"面對混亂，我先整理了哪一項？","蒙":"今天我主動請教過什麼問題？","需":"我是否在等待中做好準備工作？","訟":"爭執時我有沒有先冷靜思考？","師":"帶領團隊時我是否以身作則？","比":"我有主動關心身邊夥伴嗎？","小畜":"小進展我有沒有記錄下來？","履":"行動前我是否評估過風險？","泰":"順遂時我有保持謙遜嗎？","否":"困境中我是否守住底線？","同人":"今天我與誰建立了真誠連結？","大有":"資源豐富時我有分享給他人嗎？","謙":"成果出來時我沒有居功嗎？","豫":"快樂氛圍中我有把握分寸嗎？","隨":"跟隨趨勢時我守住初心了嗎？","蠱":"發現問題我是否從自身改起？","臨":"臨近目標我有檢視細節嗎？","觀":"今天我透過觀察學到了什麼？","噬嗑":"處理糾結我是否果斷切入？","賁":"修飾外表時我保留真實嗎？","剝":"局勢走低我怎麼保護核心？","復":"偏離軌道後我多久回頭？","无妄":"今天我做了多少不計較的事？","大畜":"積累能量時我有規劃方向嗎？","頤":"我今天養養了身心靈哪一項？","大過":"壓力過大時我有尋求支撐嗎？","坎":"陷入重複困境我嘗試新法了嗎？","離":"專注當下我是否依附正確事物？","咸":"互動中我有真誠感應對方嗎？","恒":"今天我堅持完成了什麼小事？","遯":"該退場時我有體面離開嗎？","大壯":"力量強盛時我有克制衝動嗎？","晉":"進步明顯時我有回饋支持者嗎？","明夷":"處於低調期我如何保存火種？","家人":"今天家裡溝通有溫度嗎？","睽":"意見不合時我找到共同點嗎？","蹇":"遇阻礙我是否尋求長輩建議？","解":"鬆綁後我有立即整理善後嗎？","損":"主動犧牲小利換來大安穩嗎？","益":"今天我給誰帶來實質幫助？","夬":"果斷決定後我有溝通說明嗎？","姤":"意外相遇我是否把握邊界？","萃":"群體聚會我有貢獻凝聚力嗎？","升":"循序漸進中我穩住每一步嗎？","困":"受困境中我守住誠信沒抱怨嗎？","井":"資源共享時我有維護公共設施嗎？","革":"變革時機成熟我果斷行動了嗎？","鼎":"新架構建立我有重新定位嗎？","震":"突發狀況我保持鎮定應對了嗎？","艮":"該停下時我有適時止步嗎？","漸":"長期目標今天前進一小步嗎？","歸妹":"合作關係我是否平等尊重？","豐":"成果豐碩時我有防微杜漸嗎？","旅":"在外漂泊我有安頓好自己嗎？","巽":"柔和滲透中我有堅持方向嗎？","兌":"今天我帶給誰愉悅心情？","渙":"僵局化解我是否主動破冰？","節":"制定規範我有留彈性空間嗎？","中孚":"言行一致讓誰感受到可信？","小過":"小事超前部署我有避免大錯嗎？","既濟":"大功告成我有防備尾聲亂象嗎？","未濟":"接近成功我是否更謹慎收尾？"};
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
  $("dailyReflect").innerHTML = `<span class="rq-tag">一問</span>${esc(REFLECT_Q[g.name] || "")}`;
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
  const SERIF = '"Noto Serif TC", "Songti TC", serif';
  const ls = v => { try { x.letterSpacing = v; } catch (e) {} };
  // 紙色＋雙線框
  x.fillStyle = "#f6f2e8"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#1e3a2f"; x.lineWidth = 6; x.strokeRect(36, 36, W - 72, H - 72);
  x.lineWidth = 2; x.strokeRect(54, 54, W - 108, H - 108);
  x.textAlign = "center";
  // 頂：每日一卦＋日期
  const wd = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  ls("10px");
  x.fillStyle = "#8a8474"; x.font = `30px ${SERIF}`;
  x.fillText("每日一卦", W / 2, 150);
  ls("4px");
  x.font = `26px ${SERIF}`;
  x.fillText(`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日・星期${wd}`, W / 2, 198);
  // 卦爻小圖
  const bits = yaoBitsOf(g.name);
  const topY = 258, lh = 26, lw = 150, cx = W / 2;
  x.fillStyle = "#22201b";
  bits.forEach((b, i) => {
    const y = topY + (5 - i) * lh;
    if (b) x.fillRect(cx - lw / 2, y, lw, 11);
    else { x.fillRect(cx - lw / 2, y, lw / 2 - 11, 11); x.fillRect(cx + 11, y, lw / 2 - 11, 11); }
  });
  // 卦名小字
  ls("8px");
  x.fillStyle = "#5c564a"; x.font = `34px ${SERIF}`;
  x.fillText(`第${g.n}卦・${g.name}`, W / 2, 500);
  // 主角：籤語大字
  ls("10px");
  x.fillStyle = "#22201b"; x.font = `64px ${SERIF}`;
  let yy = 650;
  wrapLinesC(x, qsOf(g.name), 860, 4).forEach(ln => { x.fillText(ln, W / 2, yy); yy += 98; });
  // 反思一問（小字點綴）
  const rq = (typeof REFLECT_Q !== "undefined" && REFLECT_Q[g.name]) || "";
  if (rq) {
    ls("4px");
    x.fillStyle = "#8a8474"; x.font = `28px ${SERIF}`;
    wrapLinesC(x, "一問：" + rq, 860, 2).forEach(ln => { x.fillText(ln, W / 2, yy + 44); yy += 50; });
  }
  // 右下角朱紅印章落款
  const ss = 120, sx = W - 162 - ss, sy = H - 200 - ss;
  x.fillStyle = "#b03a2e";
  if (x.roundRect) { x.beginPath(); x.roundRect(sx, sy, ss, ss, 12); x.fill(); }
  else x.fillRect(sx, sy, ss, ss);
  ls("0px");
  x.fillStyle = "#fff"; x.font = `54px ${SERIF}`;
  x.fillText("易", sx + ss / 2, sy + 56);
  x.fillText("問", sx + ss / 2, sy + 108);
  ls("0px");
  showCardPreview(c.toDataURL("image/png"), `易問_每日一卦_${date.getMonth() + 1}${date.getDate()}.png`);
}
$("dailyShare").addEventListener("click", dailyCard);

/* ---------- 每日推播 ---------- */
const VAPID_PUB = "BBAhtLkok76TNAkf4jHKlC3oGjwqRneEIc4iybyMWfJdIf34Mlckhi3E6AdWlm6AeFUvq4Z7OHdtOQFTliX3MIQ";
function b64ToU8(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
function renderPushBtn(on) {
  const b = $("pushBtn"); if (!b) return;
  b.textContent = on ? "已開啟每日推播（點按關閉）" : "開啟每日推播";
}
async function initPush() {
  const btn = $("pushBtn"); if (!btn) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) { btn.style.display = "none"; return; }
  let reg;
  try { reg = await navigator.serviceWorker.register("/sw.js"); }
  catch (e) { btn.style.display = "none"; return; }
  let sub = null;
  try { sub = await reg.pushManager.getSubscription(); } catch (e) {}
  renderPushBtn(!!sub);
  btn.onclick = async () => {
    try {
      const cur = await reg.pushManager.getSubscription();
      if (cur) {
        await fetch(API_BASE + "/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: cur.endpoint }) });
        await cur.unsubscribe();
        renderPushBtn(false); toast("已關閉每日推播"); return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast("需要允許通知才能推播喔"); return; }
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID_PUB) });
      const j = s.toJSON();
      const r = await fetch(API_BASE + "/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }) });
      if (!r.ok) throw new Error("srv");
      renderPushBtn(true); toast("已開啟！每天早上 7 點推播今日一卦");
    } catch (e) { toast("推播設定失敗，請再試一次"); }
  };
}
initPush();

/* ---------- 底部分類導航 ---------- */
const TABMAP = {
  ask: ["askCard", "lifeTeaser", "guaCard", "aiCard"],
  qian: ["qianCard"],
  daily: ["dailyCardSec"],
  hist: ["histCard"],
  more: ["theoryCard", "lifeCard"],
};
let curTab = "ask";
function switchTab(name) {
  curTab = name;
  const allIds = [...new Set(Object.values(TABMAP).flat())];
  allIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
  (TABMAP[name] || []).forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    // 卦卡/AI卡/記錄卡：只在曾經顯示過時才顯示
    if ((id === "guaCard" || id === "aiCard" || id === "histCard") && el.dataset.shown !== "1") return;
    el.style.display = "";
  });
  document.querySelectorAll("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("#tabbar button").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
// showEl 記住顯示狀態，供分頁判斷
const _showEl = showEl;
showEl = function (el) { el.dataset.shown = "1"; _showEl(el); };
switchTab("ask");
$("lifeTeaser").style.display = "";
$("lifeTeaser").onclick = () => { switchTab("more"); setTimeout(() => document.getElementById("lifeCard").scrollIntoView({ behavior: "smooth" }), 80); };

/* ---------- 求籤（單爻占筮） ---------- */
$("qianBtn").addEventListener("click", async () => {
  const btn = $("qianBtn"); btn.disabled = true;
  $("qianResult").style.display = "none";
  const st = $("qianStage"); st.style.display = "";
  st.classList.remove("rising"); st.classList.add("shaking");
  clink(0); clink(0.2);
  const g = GUA[Math.floor(Math.random() * 64)];
  const yi = Math.floor(Math.random() * 6);
  const yao = g.yao[yi];
  const num = (g.n - 1) * 6 + yi + 1;
  await new Promise(r => setTimeout(r, 1000));
  st.classList.remove("shaking"); st.classList.add("rising");
  await new Promise(r => setTimeout(r, 950));
  st.style.display = "none"; st.classList.remove("rising");
  const rs = $("qianResult"); rs.style.display = ""; showEl(rs);
  $("qianSeal").textContent = `第${num}籤`;
  $("qianMeta").textContent = `第${g.n}卦・${g.name}・${yao.label}`;
  $("qianYao").textContent = yao.text;
  $("qianAi").innerHTML = `<div class="loading">解籤中…</div>`;
  rs.scrollIntoView({ behavior: "smooth", block: "nearest" });
  try {
    const r = await fetch(API_BASE + "/divine/yao", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guaN: g.n, guaName: g.name, yaoLabel: yao.label, yaoText: yao.text }) });
    const d = await r.json();
    $("qianAi").textContent = d.answer || "籤語整理中，請稍後再試";
  } catch (e) { $("qianAi").textContent = "解籤失敗，請稍後再試"; }
  btn.disabled = false; btn.textContent = "再求一籤";
});



/* ---------- 命卦人物小傳 ---------- */
const MING_TXT = {
"乾": "天行健，你是停不下來的開創者，注定走在前面。",
"坤": "厚德載物，你是眾人最安心的後盾，柔順中有大力量。",
"屯": "萬事起頭難，你的人生是開荒者的劇本，越難越見本事。",
"蒙": "永遠的好學生，你靠虛心求教，把未知走成地圖。",
"需": "等待的藝術家，時機未到不出手，一出手就到位。",
"訟": "條理分明，天生會爭對的事，但記得見好就收。",
"師": "天生的統帥，眾人願意跟你走，因為你扛得起責任。",
"比": "人和的磁場，你走到哪裡，哪裡就有人願意親近你。",
"小畜": "以小博大，擅長用有限資源，養出超出預期的成果。",
"履": "如履薄冰卻步步為營，謹慎是你最大的護身符。",
"泰": "通達順遂，人生基調是和諧，貴人總在需要時出現。",
"否": "先閉塞後通達，熬過的低谷都會變成後來的養分。",
"同人": "志同道合，一生貴在朋友，得眾人之力成大事。",
"大有": "豐盛之命，擁有得多也大方，福氣會流動回來。",
"謙": "滿招損、謙受益，你越低調，站得越高。",
"豫": "樂觀的行動派，你讓身邊的人都想跟著動起來。",
"隨": "隨緣而有主見，懂得順勢，是極好的合作者。",
"蠱": "撥亂反正的人，專治各種爛攤子，越整越有味。",
"臨": "親臨現場的領導者，你的出現本身就能安定人心。",
"觀": "洞察人心的觀察者，看懂局，才出手。",
"噬嗑": "快刀斬亂麻，遇到卡住的事，找你就對了。",
"賁": "美學家，把日子過成作品，細節裡見品味。",
"剝": "懂得斷捨離，剝去多餘，反而留下最精華的。",
"復": "跌倒再起的體質，低谷永遠是下一波高峰的前奏。",
"无妄": "真誠無偽，不耍心機，這份乾淨就是你的運氣。",
"大畜": "厚積薄發，存的不只是實力，還有時機。",
"頤": "懂得養生養心，照顧好自己，也照顧好身邊的人。",
"大過": "非常之人行非常之事，扛得起超乎常人的擔子。",
"坎": "越險越勇，逆境裡反而最清醒，天生的危機處理者。",
"離": "自帶光芒，熱情會感染人，但記得別燒光自己。",
"咸": "心有靈犀，靠感覺走路，感應往往比分析更準。",
"恆": "細水長流，堅持比爆發力更可怕，時間是你的朋友。",
"遯": "懂得急流勇退，退一步，是為了走更遠的路。",
"大壯": "氣勢如虹，適合大場面，越大越見格局。",
"晉": "旭日東升，路是往上走的，貴人運特別強。",
"明夷": "在黑暗中守光的人，受過的委屈都煉成了智慧。",
"家人": "以家為重，經營的不只是事業，更是一個安穩的窩。",
"睽": "特立獨行，跟別人不一樣，而這正是你的價值。",
"蹇": "知難而進，路越難走得越穩，終會柳暗花明。",
"解": "化解高手，再糾結的結，到你手上都能解開。",
"損": "懂得捨才有得，減去慾望，留下真正重要的。",
"益": "利人利己，越幫人，自己得到的越多。",
"夬": "果決明快，該斷就斷，決斷力是稀有資產。",
"姤": "機緣特別多，總在對的時間遇到對的人，記得把握。",
"萃": "聚沙成塔，把人聚起來、把資源聚起來，成大事。",
"升": "步步高升，人生曲線是緩坡向上，穩紮穩打。",
"困": "越困越強，在谷底練出的本事，是別人學不來的。",
"井": "甘泉之命，默默滋養身邊的人，是大家的活水源頭。",
"革": "變革者，不怕推翻重來，總能開出新局。",
"鼎": "鼎新持重，扛得起大任，是能定鼎江山的人。",
"震": "一鳴驚人，爆發力強，適合關鍵時刻挺身而出。",
"艮": "如山之穩，不動如山，是眾人眼中的定海神針。",
"漸": "循序漸進，不求快，但每一步都算數，終至高處。",
"歸妹": "重情重義，為在乎的人付出很多，記得留點給自己。",
"豐": "豐盛飽滿，人生多采多姿，適合熱鬧的大舞台。",
"旅": "行者之命，在路上找到自己，漂泊中自有安定。",
"巽": "如風入境，柔軟而無孔不入，影響力在無形中擴散。",
"兌": "開心果，讓人如沐春風，人緣是最大的資產。",
"渙": "化解渙散，能把一盤散沙重新聚攏，化危機為轉機。",
"節": "有節有度，懂得節制，人生走得長遠而優雅。",
"中孚": "誠信立身，信用就是名片，眾人願託付於你。",
"小過": "細節控，在小事上用心，大事自然水到渠成。",
"既濟": "功成之象，擅長把事情做到位，記得居安思危。",
"未濟": "永遠在路上，精彩在後頭，好戲還沒上場。"
};

/* ---------- v4：人生運勢圖（曲線主視覺＋K線鑽取） ---------- */
let LIFE = null;
function buildLife(y, m, d) {
  const seed = y * 10000 + m * 100 + d;
  const ming = GUA[Math.floor(mulberry32(seed)() * 64)];
  const years = [];
  let prevC = null;
  for (let ag = 0; ag <= 90; ag++) {
    const r = mulberry32(seed * 131 + ag);
    const g = GUA[Math.floor(r() * 64)];
    const moving = Math.floor(r() * 4);
    const yang = yaoBitsOf(g.name).reduce((s, b) => s + b, 0);
    const c = Math.round(yang / 6 * 100);
    const o = prevC === null ? c : prevC;
    const vol = moving * 5;
    years.push({ age: ag, year: y + ag, g, moving,
      o, c, h: Math.min(100, Math.max(o, c) + vol), l: Math.max(0, Math.min(o, c) - vol) });
    prevC = c;
  }
  years.forEach((yr, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - 4); k <= i; k++) { s += years[k].c; n++; }
    yr.ma = Math.round(s / n);
  });
  const decades = [];
  for (let dd = 0; dd < 9; dd++) {
    const seg = years.slice(dd * 10, dd * 10 + 10);
    decades.push({ age0: dd * 10, label: `${dd * 10}–${dd * 10 + 9}歲`,
      o: seg[0].o, c: seg[9].c,
      h: Math.max(...seg.map(s => s.h)), l: Math.min(...seg.map(s => s.l)),
      g: seg[5].g, moving: Math.round(seg.reduce((s, x) => s + x.moving, 0) / 10) });
  }
  // 平滑運勢（三角核寬 9，畫曲線用；c 保留原始值供明細）
  const KW = [1, 2, 3, 4, 5, 4, 3, 2, 1], KS = 25;
  years.forEach((yr, i) => {
    let s = 0;
    for (let k = -4; k <= 4; k++) s += years[Math.max(0, Math.min(90, i + k))].c * KW[k + 4];
    yr.sc = Math.round(s / KS);
  });
  // 高峰（標在曲線上，用平滑值）
  const cands = [];
  for (let i = 4; i < 87; i++) {
    const c = years[i].sc;
    if (c >= 58 && c >= years[i-1].sc && c >= years[i+1].sc) cands.push(i);
  }
  cands.sort((a, b) => years[b].sc - years[a].sc);
  const peaks = [];
  for (const p of cands) { if (peaks.every(q => Math.abs(q - p) > 12)) peaks.push(p); if (peaks.length >= 3) break; }
  return { y, m, d, seed, ming, years, decades, peaks, view: "curve", decSel: null, sel: null };
}
function smoothLine(x, pts) {
  x.beginPath();
  x.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    x.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y);
  }
}
function drawLife() {
  if (!LIFE) return;
  const cv = $("lifeCanvas");
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = 360;
  if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (LIFE.view === "curve") drawCurve(x, W, H);
  else if (LIFE.view === "dec") drawDec(x, W, H);
  else drawYears(x, W, H);
}
function drawCurve(x, W, H) {
  const padL = 12, padR = 12, padT = 34, padB = 36;
  const py = v => padT + (100 - v) / 100 * (H - padT - padB);
  const px = i => padL + i / 90 * (W - padL - padR);
  const pts = LIFE.years.map((d, i) => ({ x: px(i), y: py(d.sc) }));
  // 遠山兩層（淡墨）
  [[0.42, 20, "rgba(30,58,47,.07)"], [0.62, 10, "rgba(30,58,47,.10)"]].forEach(([k, off, col]) => {
    const rp = LIFE.years.map((d, i) => ({ x: px(i), y: py(d.sc * k + off) }));
    smoothLine(x, rp);
    x.lineTo(rp[90].x, H - padB); x.lineTo(rp[0].x, H - padB); x.closePath();
    x.fillStyle = col; x.fill();
  });
  // 雲霧
  [[0.22, 0.40, 0.30], [0.58, 0.28, 0.34], [0.82, 0.48, 0.26]].forEach(([fx, fy, fw]) => {
    const fg = x.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, W * fw / 2);
    fg.addColorStop(0, "rgba(250,247,238,.6)"); fg.addColorStop(1, "rgba(250,247,238,0)");
    x.fillStyle = fg; x.fillRect(0, 0, W, H);
  });
  // 山水填色
  const gr = x.createLinearGradient(0, padT, 0, H - padB);
  gr.addColorStop(0, "rgba(176,58,46,.16)"); gr.addColorStop(1, "rgba(176,58,46,0)");
  smoothLine(x, pts);
  x.lineTo(pts[90].x, H - padB); x.lineTo(pts[0].x, H - padB); x.closePath();
  x.fillStyle = gr; x.fill();
  // 曲線
  smoothLine(x, pts);
  x.strokeStyle = "#b03a2e"; x.lineWidth = 2.6; x.lineJoin = "round"; x.stroke();
  // 高峰標註
  x.textAlign = "center"; x.font = "12px serif";
  LIFE.peaks.forEach(p => {
    const d = LIFE.years[p];
    x.fillStyle = "#b03a2e";
    x.beginPath(); x.arc(px(p), py(d.sc), 4.5, 0, 7); x.fill();
    x.fillStyle = "#8a8474";
    x.fillText(`${p}歲・${d.g.name}`, px(p), py(d.sc) - 12);
  });
  // 「今」標記
  const nowA = Math.max(0, Math.min(90, new Date().getFullYear() - LIFE.y));
  x.strokeStyle = "#b03a2e"; x.setLineDash([5, 4]); x.lineWidth = 1.2;
  x.beginPath(); x.moveTo(px(nowA), padT - 6); x.lineTo(px(nowA), H - padB); x.stroke(); x.setLineDash([]);
  x.fillStyle = "#b03a2e";
  const tw = 30;
  const bx = Math.min(Math.max(px(nowA) - tw / 2, padL), W - padR - tw);
  x.beginPath(); x.roundRect(bx, 2, tw, 22, 5); x.fill();
  x.fillStyle = "#fff"; x.font = "13px serif";
  x.fillText("今", bx + tw / 2, 18);
  // 選中年
  if (LIFE.sel != null) {
    const d = LIFE.years[LIFE.sel];
    x.fillStyle = "#1e3a2f";
    x.beginPath(); x.arc(px(LIFE.sel), py(d.sc), 5.5, 0, 7); x.fill();
    x.fillStyle = "#fff";
    x.beginPath(); x.arc(px(LIFE.sel), py(d.sc), 2.2, 0, 7); x.fill();
  }
  // X 軸
  x.fillStyle = "#8a8474"; x.font = "11px serif";
  for (let a = 0; a <= 90; a += 10) x.fillText(a + "歲", px(a), H - 12);
  LIFE._geom = { kind: "curve", padL, padR, W };
}
function drawKBase(x, W, H, data, labels) {
  const padL = 8, padR = 8, padT = 16, padB = 34, volH = 46;
  const priceH = H - padT - padB - volH - 8;
  const py = v => padT + (100 - v) / 100 * priceH;
  const n = data.length, step = (W - padL - padR) / n, cw = Math.max(4, step * 0.55);
  x.strokeStyle = "#ece4cf"; x.lineWidth = 1;
  [0, 50, 100].forEach(v => { x.beginPath(); x.moveTo(padL, py(v)); x.lineTo(W - padR, py(v)); x.stroke(); });
  const vmax = Math.max(...data.map(d => d.moving), 1);
  data.forEach((d, i) => {
    const cx = padL + step * (i + 0.5);
    const col = d.c >= d.o ? "#b03a2e" : "#2f5d43";
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = Math.max(1.2, cw * 0.3);
    x.beginPath(); x.moveTo(cx, py(d.h)); x.lineTo(cx, py(d.l)); x.stroke();
    const yO = py(d.o), yC = py(d.c);
    x.fillRect(cx - cw / 2, Math.min(yO, yC), cw, Math.max(2, Math.abs(yC - yO)));
    x.globalAlpha = 0.28;
    x.fillRect(cx - cw / 2, H - padB - d.moving / vmax * volH, cw, d.moving / vmax * volH);
    x.globalAlpha = 1;
  });
  x.fillStyle = "#8a8474"; x.font = "11px serif"; x.textAlign = "center";
  labels.forEach((lbl, i) => { if (lbl) x.fillText(lbl, padL + step * (i + 0.5), H - 12); });
  return { padL, step, n };
}
function drawDec(x, W, H) {
  LIFE._geom = { kind: "dec", ...drawKBase(x, W, H, LIFE.decades, LIFE.decades.map((d, i) => i % 2 === 0 ? d.label : null)) };
}
function drawYears(x, W, H) {
  const seg = LIFE.years.slice(LIFE.decSel * 10, LIFE.decSel * 10 + 10);
  const g = drawKBase(x, W, H, seg, seg.map((d, i) => i % 2 === 0 ? d.age + "歲" : null));
  // MA5
  const padT = 16, priceH = H - padT - 34 - 46 - 8;
  const py = v => padT + (100 - v) / 100 * priceH;
  x.strokeStyle = "#b98a2f"; x.lineWidth = 1.6; x.beginPath();
  seg.forEach((d, i) => { const cx = g.padL + g.step * (i + 0.5); i ? x.lineTo(cx, py(d.ma)) : x.moveTo(cx, py(d.ma)); });
  x.stroke();
  LIFE._geom = { kind: "years", ...g };
}
function buildLifeSel() {
  const sel = $("lifeYearSel");
  let opts;
  if (LIFE.view === "dec") {
    opts = LIFE.decades.map((d, j) => `<option value="d${j}">${d.label}（${LIFE.y + d.age0}年起）</option>`);
  } else {
    const list = LIFE.view === "curve" ? LIFE.years : LIFE.years.slice(LIFE.decSel * 10, LIFE.decSel * 10 + 10);
    opts = list.map(d => `<option value="${d.age}">${d.age}歲・${d.year}年</option>`);
  }
  sel.innerHTML = opts.join("");
  sel.onchange = () => {
    const v = sel.value;
    if (v[0] === "d") drillDec(Number(v.slice(1)));
    else selectLife(Number(v));
  };
}
function drillDec(j) {
  LIFE.view = "years"; LIFE.decSel = j;
  document.querySelectorAll("#lifeSwitch button").forEach(x => x.classList.toggle("on", x.dataset.v === "dec"));
  $("lifeBack").style.display = "";
  buildLifeSel();
  selectLife(j * 10 + 5);
}
function selectLife(i) {
  LIFE.sel = i;
  const d = LIFE.years[i];
  if (!d) return;
  if (LIFE.view !== "dec") $("lifeYearSel").value = String(i);
  const g = d.g;
  $("lifeInfo").innerHTML = `<div class="yr">${d.age}歲・${d.year}年</div>
    <div class="gname">第${g.n}卦・${g.name}</div>
    <div>${esc(g.guaci)}</div>
    <div style="color:var(--ink2);font-size:.85rem;">${d.moving > 0 ? "動盪 " + d.moving + " 爻" : "平穩無動爻"}・運勢 ${d.c}</div>`;
  drawLife();
}
function lifeGo() {
  const v = $("birthDate").value;
  if (!v) { toast("請先選擇出生日期"); return; }
  const [yy, mm, dd] = v.split("-").map(Number);
  localStorage.setItem("yiwen_birth", v);
  LIFE = buildLife(yy, mm, dd);
  const mg = LIFE.ming;
  const mingTxt = MING_TXT[mg.name] || "";
  $("lifeMing").innerHTML = `<div style="color:var(--ink2);font-size:.85rem;letter-spacing:.2em;">你的命卦</div><div style="font-size:1.35rem;letter-spacing:.12em;margin:6px 0;"><b>第${mg.n}卦・${mg.name}</b></div>${guaLinesHTML(mg.name)}<div class="ming-txt">${esc(mingTxt)}</div><div style="color:var(--ink2);font-size:.9rem;margin-top:6px;">${esc(mg.guaci)}</div>`;
  ["lifeSwitch", "lifeCanvas", "lifePick", "lifeInfo", "lifeShare"].forEach(id => $(id).style.display = "");
  $("lifeBack").style.display = "none";
  document.querySelectorAll("#lifeSwitch button").forEach(x => x.classList.toggle("on", x.dataset.v === "curve"));
  buildLifeSel();
  selectLife(lifeNowAge());
}
$("lifeGo").addEventListener("click", lifeGo);
const lifeNowAge = () => Math.max(0, Math.min(90, new Date().getFullYear() - LIFE.y));
const lifeDecHint = () => { $("lifeInfo").innerHTML = `<div style="color:var(--ink2);font-size:.9rem;">點一根柱子，看那十年每一年的運勢。</div>`; };
document.querySelectorAll("#lifeSwitch button").forEach(b => b.onclick = () => {
  if (!LIFE) return;
  LIFE.view = b.dataset.v;
  document.querySelectorAll("#lifeSwitch button").forEach(x => x.classList.toggle("on", x === b));
  $("lifeBack").style.display = "none";
  buildLifeSel();
  if (LIFE.view === "curve") { LIFE.sel = null; selectLife(lifeNowAge()); }
  else { LIFE.sel = null; lifeDecHint(); drawLife(); }
});
$("lifeBack").addEventListener("click", () => {
  if (!LIFE) return;
  LIFE.view = "dec"; LIFE.sel = null;
  document.querySelectorAll("#lifeSwitch button").forEach(x => x.classList.toggle("on", x.dataset.v === "dec"));
  $("lifeBack").style.display = "none";
  buildLifeSel();
  lifeDecHint(); drawLife();
});
/* ---------- 命運山水圖卡分享 ---------- */
function wrapText(x, text, maxW) {
  const lines = []; let line = "";
  for (const ch of text) {
    if (x.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}
$("lifeShare").addEventListener("click", () => {
  if (!LIFE) return;
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.fillStyle = "#f6f2e8"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#1e3a2f"; x.lineWidth = 3; x.strokeRect(28, 28, W - 56, H - 56);
  x.lineWidth = 1; x.strokeRect(44, 44, W - 88, H - 88);
  x.textAlign = "center"; x.fillStyle = "#1e3a2f";
  x.font = "44px serif"; x.fillText("易問・人生命運山水", W / 2, 150);
  const mg = LIFE.ming;
  x.fillStyle = "#b03a2e"; x.font = "bold 64px serif";
  x.fillText(`第${mg.n}卦・${mg.name}`, W / 2, 250);
  x.fillStyle = "#3a352c"; x.font = "36px serif";
  wrapText(x, MING_TXT[mg.name] || "", 880).forEach((ln, i) => x.fillText(ln, W / 2, 320 + i * 52));
  const sc = document.createElement("canvas"); sc.width = 960; sc.height = 400;
  const sx = sc.getContext("2d");
  sx.fillStyle = "#f6f2e8"; sx.fillRect(0, 0, 960, 400);
  const keepGeom = LIFE._geom;
  drawCurve(sx, 960, 400);
  LIFE._geom = keepGeom;
  x.drawImage(sc, 60, 420, 960, 400);
  x.fillStyle = "#3a352c"; x.font = "34px serif";
  x.fillText("人生高峰", W / 2, 900);
  x.fillStyle = "#b03a2e"; x.font = "32px serif";
  LIFE.peaks.forEach((p, i) => {
    const d = LIFE.years[p];
    x.fillText(`${p}歲・${d.g.name}`, W / 2, 955 + i * 50);
  });
  x.save(); x.translate(W - 170, H - 170); x.rotate(-0.08);
  x.fillStyle = "#b03a2e"; x.fillRect(-62, -62, 124, 124);
  x.fillStyle = "#f6f2e8"; x.font = "bold 52px serif";
  x.fillText("易問", 0, 18); x.restore();
  x.fillStyle = "#8a8474"; x.font = "28px serif";
  const dt = new Date();
  x.fillText(`${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`, W / 2, H - 90);
  const link = document.createElement("a");
  link.download = "易問-命運山水.png";
  link.href = cv.toDataURL("image/png");
  link.click();
  toast("命運圖已存成圖片，可以分享了");
});
$("lifeCanvas").addEventListener("click", e => {
  if (!LIFE || !LIFE._geom) return;
  const r = $("lifeCanvas").getBoundingClientRect();
  const gm = LIFE._geom;
  const x = e.clientX - r.left;
  if (gm.kind === "curve") {
    const i = Math.round((x - gm.padL) / (gm.W - gm.padL - gm.padR) * 90);
    if (i >= 0 && i <= 90) selectLife(i);
  } else if (gm.kind === "dec") {
    const j = Math.floor((x - gm.padL) / gm.step);
    if (j >= 0 && j < 9) drillDec(j);
  } else {
    const k = Math.floor((x - gm.padL) / gm.step);
    if (k >= 0 && k < 10) selectLife(LIFE.decSel * 10 + k);
  }
});
let _lrzT = null;
window.addEventListener("resize", () => { clearTimeout(_lrzT); _lrzT = setTimeout(drawLife, 200); });
(function lifeInit() {
  const v = localStorage.getItem("yiwen_birth");
  if (v && $("birthDate")) { $("birthDate").value = v; }
})();

/* ---------- 專題模板 ---------- */
const TOPIC_TPL = {
"求職": "我該不該接受＿＿公司的 offer？職位是＿＿，年薪＿＿萬，我最猶豫的是＿＿。",
"感情": "我跟＿＿目前的狀態是＿＿，讓我在意的是＿＿，該繼續還是放手？",
"創業": "我想做＿＿（項目），預計投入＿＿萬，現在最大的不確定是＿＿，時機對嗎？",
"考試": "＿＿考試在＿＿月登場，我目前的準備程度是＿＿，該把力氣放在哪裡？",
"人際": "我跟＿＿（同事／朋友／家人）最近＿＿，我想＿＿，怎麼做比較好？",
"抉擇": "我在「＿＿」和「＿＿」之間猶豫，考量的是＿＿，該怎麼選？"
};
let curTopic = "";
document.querySelectorAll("#topics button").forEach(b => b.onclick = () => {
document.querySelectorAll("#topics button").forEach(x => x.classList.toggle("on", x === b));
curTopic = b.dataset.t;
$("q").value = TOPIC_TPL[curTopic];
});
$("q").addEventListener("input", () => {
curTopic = "";
document.querySelectorAll("#topics button").forEach(x => x.classList.remove("on"));
});
$("goDivine").addEventListener("click", doDivine);
$("goAI").addEventListener("click", goAI);
(function handleReturn() {
  const q = new URLSearchParams(location.search);
  if (q.get("login") === "ok") { toast("登入成功，歡迎回來"); history.replaceState(null, "", location.pathname); loadMe(); }
  if (q.get("login") === "fail") { toast("登入失敗，請再試一次"); history.replaceState(null, "", location.pathname); }
  if (q.get("paid") === "1") { toast("付款成功，額度已入帳"); history.replaceState(null, "", location.pathname); setTimeout(() => loadMe(), 1500); }
})();
/* ---------- 圖卡預覽 ---------- */
function showCardPreview(dataURL, filename) {
  let m = $("cardModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "cardModal";
    m.innerHTML = `<div class="cardmodal-bg"></div><div class="cardmodal-box">
      <img id="cardModalImg" alt="圖卡預覽">
      <div class="cardmodal-actions">
        <a id="cardModalDl" class="btn" target="_blank" rel="noopener">下載圖片</a>
        <button id="cardModalClose" class="btn ghost">關閉</button>
      </div>
      <div class="hint">長按圖片也可直接儲存到相簿</div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector(".cardmodal-bg").onclick = closeCardModal;
    m.querySelector("#cardModalClose").onclick = closeCardModal;
  }
  $("cardModalImg").src = dataURL;
  const dl = $("cardModalDl");
  dl.href = dataURL; dl.download = filename;
  m.classList.add("open");
}
function closeCardModal() { const m = $("cardModal"); if (m) m.classList.remove("open"); }
$("shareBtn").addEventListener("click", shareCard);
document.addEventListener("click", e => {
  const p = $("authPanel");
  if (p && p.classList.contains("open") && !e.target.closest(".auth-menu")) p.classList.remove("open");
});
$("askAgain").addEventListener("click", () => {
$("q").value = "";
window.scrollTo({ top: 0, behavior: "smooth" });
setTimeout(() => { try { $("q").focus({ preventScroll: true }); } catch (e) { $("q").focus(); } }, 650);
});
loadMe();
load();
