/* 易問 app.js */
const API_BASE = "https://iching-api.laladoo99.workers.dev"; // 上線後依實際 subdomain 調整
let GUA = [], SYM = {}, BH = {};
let cur = null; // {ben, zhi, yaos:[{type,label,moving}], movingIdx:[], question, method}

const $ = id => document.getElementById(id);

async function load() {
const [g, s, b] = await Promise.all([
fetch("data/gua.json").then(r => r.json()),
fetch("data/gua_symbols.json").then(r => r.json()),
fetch("data/baihua.json").then(r => r.json()).catch(() => ({})),
]);
GUA = g; SYM = s; BH = b;
buildPick(); renderHist(); renderQuota();
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

let mode = "coin";
$("modes").addEventListener("click", e => {
const b = e.target.closest("button"); if (!b) return;
mode = b.dataset.m;
document.querySelectorAll("#modes button").forEach(x => x.classList.toggle("on", x === b));
renderModeExtra();
});
function renderModeExtra() {
const ex = $("modeExtra");
if (mode === "time") {
const d = new Date();
ex.innerHTML = `<div class="hint">將以現在時間起卦：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}時</div>`;
} else if (mode === "pick") {
ex.innerHTML = `<select id="pickSel">${GUA.map(g => `<option value="${g.name}">${g.n}. ${g.name}</option>`).join("")}</select>`;
} else ex.innerHTML = "";
}
function buildPick() { renderModeExtra();}

function doDivine() {
const q = $("q").value.trim();
if (!q) { alert("請先寫下你想問的事"); $("q").focus(); return;}
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
renderGua();
$("guaCard").style.display = "";
$("aiCard").style.display = "";
$("aiOut").innerHTML = "";
saveHist();
$("guaCard").scrollIntoView({ behavior: "smooth"});
}

function renderGua() {
const { ben, zhi, yaos} = cur;
$("gSym").textContent = symOf(ben.name);
$("gName").textContent = "第" + ben.n + "卦・" + ben.name;
$("gTri").textContent = ben.lower_trigram + "下" + ben.upper_trigram + "上";
$("gGuaci").textContent = "" + ben.guaci;
$("gBaihua").textContent = "" + (bhOf(ben.name) || qsOf(ben.name) || "（白話解讀整理中）");
$("yaoLines").innerHTML = yaos.map((y, i) => {
const yy = ben.yao[i];
return `<div class="yao ${y.yang? "yang": "yin"} ${y.moving? "moving": ""}">
<span class="lbl">${y.label}</span>
<div class="bar">${y.yang? "<i></i>": '<i class="left"></i><i class="right"></i>'}</div>
<span class="lbl" style="width:auto;flex:0 0 auto;">${yy? yy.text: ""}</span></div>`;
}).join("");
const mv = yaos.map((y, i) => y.moving? i: -1).filter(i => i >= 0);
let mh = "";
if (mv.length) {
mh = `<h3 style="font-size:1rem;color:var(--brand);letter-spacing:.15em;">變爻（${mv.length}）</h3><div class="moving-list">` +
mv.map(i => `<div class="mi"><b>${yaos[i].label}</b>：${ben.yao[i].text}<br><span style="color:var(--ink2);font-size:.88rem;">→ 之卦「${zhi.name}」${zhi.yao[i].label}：${zhi.yao[i].text}</span></div>`).join("") + `</div>`;
} else {
mh = `<div class="hint">無變爻。此卦氣專一，取卦辭斷之。</div>`;
}
$("movingWrap").innerHTML = mh;
$("zhiWrap").innerHTML = `<div class="guaci" style="margin-top:12px;"><b>之卦：${symOf(zhi.name)} ${zhi.name}</b>（${zhi.lower_trigram}下${zhi.upper_trigram}上）<br>${zhi.guaci}<div class="baihua">${bhOf(zhi.name) || ""}</div></div>`;
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
const n = quotaLeft();
$("quotaBox").innerHTML = n > 0
? `本月免費 AI 解卦剩餘 <b style="color:var(--cinnabar);font-size:1.2rem;">${n}</b> 次`
: `本月免費額度已用完。付費無限解卦即將開放，<b>留下 Email 可第一時間收到通知</b>。<div style="margin-top:10px;display:flex;gap:8px;"><input id="waitEmail" placeholder="your@email.com" style="flex:1;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:.95rem;"><button id="waitBtn" class="btn" style="margin:0;width:auto;padding:10px 18px;letter-spacing:.1em;text-indent:0;">通知我</button></div>`;
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
if (quotaLeft() <= 0) { alert("本月免費額度用完囉"); return;}
const btn = $("goAI"); btn.disabled = true;
$("aiOut").innerHTML = `<div class="loading"><span class="spin"></span>正在觀變玩占…</div>`;
try {
const { ben, zhi, yaos, question} = cur;
const moving = yaos.map((y, i) => y.moving? { label: y.label, ben: ben.yao[i].text, zhi: zhi.yao[i].text, zhiLabel: zhi.yao[i].label}: null).filter(Boolean);
const r = await fetch(API_BASE + "/divine", {
method: "POST", headers: { "Content-Type": "application/json"},
body: JSON.stringify({
question,
benGua: { name: ben.name, n: ben.n, guaci: ben.guaci, baihua: bhOf(ben.name)},
moving, zhiGua: { name: zhi.name, n: zhi.n, guaci: zhi.guaci, baihua: bhOf(zhi.name)}
})
});
if (!r.ok) throw new Error("服務暫時忙線中（" + r.status + "）");
const d = await r.json();
useQuota();
$("aiOut").innerHTML = `<div class="ai-sec">
<h3>現況</h3><p>${esc(d.xiankuang)}</p>
<h3>變數</h3><p>${esc(d.bianhua)}</p>
<h3>建議</h3><p>${esc(d.jianyi)}</p>
<h3>提醒</h3><p>${esc(d.tixing)}</p></div>`;
cur.ai = d; saveHist();
} catch (e) {
$("aiOut").innerHTML = `<div class="loading">解卦失敗：${esc(e.message)}，請稍後再試。</div>`;
}
btn.disabled = false;
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
$("histList").innerHTML = h.map((x, i) => `<div class="hist-item" data-i="${i}"><b>${symOf(x.ben)} ${x.ben}</b> → ${x.zhi}　<span class="t">${new Date(x.at).toLocaleString("zh-TW")}</span><br>${esc(x.q.slice(0, 40))}</div>`).join("");
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
x.fillStyle = "#22201b"; x.font = "64px serif";
x.fillText("易 問", W / 2, 300);
x.fillStyle = "#5c564a"; x.font = "30px serif"; x.fillText("問事・起卦・觀變", W / 2, 348);
x.fillStyle = "#22201b"; x.font = "150px serif"; x.fillText(symOf(cur.ben.name), W / 2, 540);
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
x.fillStyle = "#5c564a"; x.font = "30px serif";
const ql = cur.question.length > 26? cur.question.slice(0, 26) + "…": cur.question;
x.fillText("問：" + ql, W / 2, H - 220);
if (cur.ai && cur.ai.jianyi) {
x.fillStyle = "#1e3a2f"; x.font = "32px serif";
const s = cur.ai.jianyi.length > 40? cur.ai.jianyi.slice(0, 40) + "…": cur.ai.jianyi;
x.fillText(s, W / 2, H - 160);
}
const a = document.createElement("a");
a.download = `易問_${cur.ben.name}.png`;
a.href = c.toDataURL("image/png"); a.click();
}

$("goDivine").addEventListener("click", doDivine);
$("goAI").addEventListener("click", goAI);
$("shareBtn").addEventListener("click", shareCard);
load();
