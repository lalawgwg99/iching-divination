// 每日一局・棋卦：棋盤 UI（依賴 window.QX 象棋規則引擎）
(function () {
const NAMES = { K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵', k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒' };
const isRedP = p => p && p === p.toUpperCase();
let PUZ = [];
let S = { board: null, puz: null, sel: null, dots: [], done: false, dayKey: '' };

function dayKey() { return new Date().toISOString().slice(0, 10); }
function dayIdx() { return Math.floor(Date.now() / 86400000) % PUZ.length; }

function boardSVG() {
  const L = [];
  L.push('<rect x="-55" y="-55" width="910" height="1010" fill="#f5efe0"/>');
  L.push('<rect x="0" y="0" width="800" height="900" fill="none" stroke="#2f4f3e" stroke-width="4"/>');
  for (let i = 0; i <= 9; i++) L.push(`<line x1="0" y1="${i * 100}" x2="800" y2="${i * 100}" stroke="#2f4f3e" stroke-width="1.6"/>`);
  for (let i = 1; i < 9; i++) L.push(`<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="900" stroke="#2f4f3e" stroke-width="1.6"/>`);
  // 九宮斜線
  L.push('<line x1="300" y1="0" x2="500" y2="200" stroke="#2f4f3e" stroke-width="1.6"/>');
  L.push('<line x1="500" y1="0" x2="300" y2="200" stroke="#2f4f3e" stroke-width="1.6"/>');
  L.push('<line x1="300" y1="700" x2="500" y2="900" stroke="#2f4f3e" stroke-width="1.6"/>');
  L.push('<line x1="500" y1="700" x2="300" y2="900" stroke="#2f4f3e" stroke-width="1.6"/>');
  // 星位角
  const pts = [[100,200],[700,200],[100,700],[700,700],[0,300],[200,300],[400,300],[600,300],[800,300],[0,600],[200,600],[400,600],[600,600],[800,600]];
  for (const [x, y] of pts) {
    for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      if ((x === 0 && sx < 0) || (x === 800 && sx > 0)) continue;
      const x1 = x + sx * 8, y1 = y + sy * 8, x2 = x + sx * 28;
      const y2 = y + sy * 8, x3 = x + sx * 8, y3 = y + sy * 28;
      L.push(`<path d="M${x1} ${y1} L${x2} ${y2} M${x1} ${y1} L${x3} ${y3}" stroke="#2f4f3e" stroke-width="1.6" fill="none"/>`);
    }
  }
  L.push('<text x="200" y="468" text-anchor="middle" font-size="46" fill="#8a7a5c" letter-spacing="12">楚河</text>');
  L.push('<text x="600" y="468" text-anchor="middle" font-size="46" fill="#8a7a5c" letter-spacing="12">漢界</text>');
  return `<svg class="qj-svg" viewBox="-55 -55 910 1010">${L.join('')}</svg>`;
}

function renderPieces() {
  const el = document.getElementById('qjPieces');
  el.innerHTML = '';
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    const p = S.board[y][x];
    if (!p) continue;
    const d = document.createElement('div');
    d.className = 'qj-p' + (isRedP(p) ? ' red' : ' blk') + (S.sel && S.sel.x === x && S.sel.y === y ? ' sel' : '');
    d.style.left = (x / 8 * 100) + '%';
    d.style.top = (y / 9 * 100) + '%';
    d.textContent = NAMES[p];
    d.dataset.x = x; d.dataset.y = y;
    el.appendChild(d);
  }
  for (const m of S.dots) {
    const d = document.createElement('div');
    d.className = 'qj-dot';
    d.style.left = (m.tx / 8 * 100) + '%';
    d.style.top = (m.ty / 9 * 100) + '%';
    d.dataset.tx = m.tx; d.dataset.ty = m.ty;
    el.appendChild(d);
  }
}

function msg(t) { document.getElementById('qjMsg').textContent = t || ''; }

function onTap(e) {
  if (S.done || !S.board) return;
  const t = e.target;
  if (t.classList.contains('qj-dot')) {
    doMove(+t.dataset.tx, +t.dataset.ty);
    return;
  }
  if (t.classList.contains('qj-p')) {
    const x = +t.dataset.x, y = +t.dataset.y, p = S.board[y][x];
    if (!isRedP(p)) { msg('這是黑子，輪到紅方走'); return; }
    if (S.sel && S.sel.x === x && S.sel.y === y) { S.sel = null; S.dots = []; renderPieces(); return; }
    S.sel = { x, y };
    if (S.hintOn && x === S.puz.sol.fx && y === S.puz.sol.fy) {
      S.hintOn = false;
      document.querySelectorAll('.qj-p.hintp').forEach(el => el.classList.remove('hintp'));
    }
    S.dots = QX.legalMoves(S.board, 'R').filter(m => m.fx === x && m.fy === y);
    if (typeof clink === 'function') clink();
    renderPieces();
    return;
  }
  S.sel = null; S.dots = []; renderPieces();
}

function doMove(tx, ty) {
  const s = S.puz.sol, sel = S.sel;
  const ok = sel.x === s.fx && sel.y === s.fy && tx === s.tx && ty === s.ty;
  if (ok) {
    S.board = QX.applyMove(S.board, { fx: sel.x, fy: sel.y, tx, ty, cap: S.board[ty][tx] });
    S.sel = null; S.dots = []; S.done = true;
    renderPieces();
    if (typeof clink === 'function') clink();
    setTimeout(() => win(true), 450);
  } else {
    msg('這步殺不死，再想想');
    const el = document.querySelector('.qj-p.sel');
    if (el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); }
  }
}

function win(fresh) {
  msg('');
  try { localStorage.setItem('yiwen_qiju_done', S.dayKey); } catch (e) {}
  const g = document.getElementById('qjGua');
  g.style.display = '';
  g.innerHTML = `<div class="qj-win">將死！第 ${S.puz.id} 局・已解</div>
    <div class="qj-gualine">本局配卦・第${S.puz.gua}卦「${S.puz.guaName}」</div>
    <p>${S.puz.line}</p>`;
  if (fresh) g.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function load() {
  S.dayKey = dayKey();
  S.puz = PUZ[dayIdx()];
  S.board = QX.parseFEN(S.puz.fen);
  S.sel = null; S.dots = []; S.hintOn = false;
  S.done = localStorage.getItem('yiwen_qiju_done') === S.dayKey;
  document.getElementById('qjHint').textContent = `第 ${S.puz.id} 局・紅先・一步殺將`;
  renderPieces();
  if (S.done) {
    // 已解過：直接擺將死局面＋顯示卦
    S.board = QX.applyMove(S.board, { fx: S.puz.sol.fx, fy: S.puz.sol.fy, tx: S.puz.sol.tx, ty: S.puz.sol.ty, cap: null });
    renderPieces(); win(false);
  } else {
    document.getElementById('qjGua').style.display = 'none';
    msg('');
  }
}

window.qijuInit = function () {
  if (!window.QX) return;
  document.getElementById('qjBoard').innerHTML = boardSVG() + '<div class="qj-pieces" id="qjPieces"></div>';
  document.getElementById('qjPieces').addEventListener('click', onTap);
  document.getElementById('qjHintBtn').onclick = () => {
    if (S.done || !S.puz) return;
    const s = S.puz.sol;
    document.querySelectorAll('.qj-p').forEach(el => {
      el.classList.toggle('hintp', +el.dataset.x === s.fx && +el.dataset.y === s.fy);
    });
    S.hintOn = true;
    msg('試試這顆發光的子');
  };
  document.getElementById('qjResetBtn').onclick = () => { if (!S.done) load(); };
  fetch('data/puzzles.json').then(r => r.json()).then(j => {
    PUZ = j; load();
  }).catch(() => { document.getElementById('qjHint').textContent = '棋局載入失敗'; });
};
})();
