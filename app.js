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
    box.innerHTML = `<div class="auth-menu">
      <button class="auth-btn" id="authToggle">登入</button>
      <div class="auth-panel" id="authPanel">
        <div class="hint">登入後額度跨裝置同步，<br>也可購買單次包或月訂。</div>
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
$("followWrap").style.display = "none";
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
question, topic: curTopic,
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
resetFollow();
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
setHist(h);
renderHist();
}
/* ---------- 覆盤回顧 ---------- */
const RV_DUE = 30 * 86400 * 1000;
const RV_LABEL = { hit: "應驗了", part: "部分應驗", miss: "沒發生", pending: "還在發展中" };
function getHist() { try { return JSON.parse(localStorage.getItem("yiwen_hist") || "[]");} catch { return []; } }
function setHist(h) { localStorage.setItem("yiwen_hist", JSON.stringify(h.slice(0, 30))); }
function renderHist() {
const h = getHist();
if (!h.length) return;
$("histCard").style.display = "";
const now = Date.now();
const reviewed = h.filter(x => x.rv);
const hit = reviewed.filter(x => x.rv.r === "hit").length;
const stat = reviewed.length ? `<div class="rv-stat">已覆盤 ${reviewed.length} 卦・${hit} 卦應驗</div>` : "";
$("histList").innerHTML = stat + h.map((x, i) => {
let act;
if (x.rv) act = `<span class="rv-badge ${x.rv.r}">${RV_LABEL[x.rv.r]}</span>`;
else if (now - x.at >= RV_DUE) act = `<button class="rv-btn" onclick="openReview(${i})">寫覆盤</button>`;
else act = `<span class="rv-wait">${Math.ceil((RV_DUE - (now - x.at)) / 86400000)}天後可覆盤</span>`;
return `<div class="hist-item${x.ai ? " solved" : ""}"><span class="t">${new Date(x.at).toLocaleString("zh-TW")}</span><b>${guaLinesHTML(x.ben, null, true)} ${x.ben}</b> → ${x.zhi}<br><span style="color:var(--ink2);font-size:.88rem;">${esc(x.q.slice(0, 40))}</span><div style="margin-top:6px;">${act}</div></div>`;
}).join("");
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
let followHist = [], followLeft = 3;
function resetFollow() {
followHist = []; followLeft = 3;
$("followList").innerHTML = ""; $("followQ").value = "";
$("followWrap").style.display = "";
renderFollowHint();
}
function renderFollowHint() {
$("followHint").textContent = followLeft > 0 ? `還能追問 ${followLeft} 次（每次消耗 1 次額度）` : "這卦追問到這裡囉，再問一卦吧";
}
async function sendFollow() {
const q = $("followQ").value.trim();
if (!q || !cur || !cur.ai) return;
if (followLeft <= 0) { alert("這卦追問到這裡囉"); return; }
const logged = ME && ME.loggedIn;
if (!logged && quotaLeft() <= 0) { alert("本月免費額度用完囉"); return; }
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
followLeft--;
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
  showCardPreview(c.toDataURL("image/png"), `易問_每日一卦_${date.getMonth() + 1}${date.getDate()}.png`);
}
$("dailyShare").addEventListener("click", dailyCard);



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
  // 淡網格
  x.strokeStyle = "#ece4cf"; x.lineWidth = 1;
  [25, 50, 75].forEach(v => { x.beginPath(); x.moveTo(padL, py(v)); x.lineTo(W - padR, py(v)); x.stroke(); });
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
  $("lifeMing").innerHTML = `<div style="color:var(--ink2);font-size:.85rem;letter-spacing:.2em;">你的命卦</div><div style="font-size:1.35rem;letter-spacing:.12em;margin:6px 0;"><b>第${mg.n}卦・${mg.name}</b></div>${guaLinesHTML(mg.name)}<div style="color:var(--ink2);font-size:.9rem;margin-top:6px;">${esc(mg.guaci)}</div>`;
  ["lifeSwitch", "lifeCanvas", "lifePick", "lifeInfo"].forEach(id => $(id).style.display = "");
  $("lifeBack").style.display = "none";
  document.querySelectorAll("#lifeSwitch button").forEach(x => x.classList.toggle("on", x.dataset.v === "curve"));
  buildLifeSel();
  selectLife(lifeNowAge());
}
$("lifeGo").addEventListener("click", lifeGo);
const lifeNowAge = () => Math.max(0, Math.min(90, new Date().getFullYear() - LIFE.y));
const lifeDecHint = () => { $("lifeInfo").innerHTML = `<div style="color:var(--ink2);font-size:.9rem;">點選一根十年 K 線，鑽進去看那十年的年 K。</div>`; };
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
  if (q.get("login") === "ok") { toast("登入成功，歡迎回來"); history.replaceState(null, "", location.pathname); }
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
