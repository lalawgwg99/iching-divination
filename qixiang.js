// 象棋規則引擎（紅在下 y=9，黑在上 y=0）
// 棋盤：board[y][x]，字元：K帥 A仕 B相 N傌 R俥 C炮 P兵（大寫紅）/ k,a,b,n,r,c,p（小寫黑），null 空
const RED = 'R', BLACK = 'B';
const isRed = p => p && p === p.toUpperCase();
const colorOf = p => isRed(p) ? RED : BLACK;
const inPalace = (c, x, y) =>
  x >= 3 && x <= 5 && (c === RED ? (y >= 7 && y <= 9) : (y >= 0 && y <= 2));
const inBoard = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;

function parseFEN(fen) {
  const b = Array.from({ length: 10 }, () => Array(9).fill(null));
  const rows = fen.split(' ')[0].split('/');
  for (let y = 0; y < 10; y++) {
    let x = 0;
    for (const ch of rows[y]) {
      if (/\d/.test(ch)) x += +ch;
      else { b[y][x] = ch; x++; }
    }
  }
  return b;
}
function toFEN(b) {
  return b.map(row => {
    let s = '', e = 0;
    for (const c of row) {
      if (!c) e++;
      else { if (e) { s += e; e = 0; } s += c; }
    }
    if (e) s += e;
    return s;
  }).join('/');
}

// 偽合法走法（含送將、含被將軍），回傳 [{fx,fy,tx,ty,cap}]
function pseudoMoves(b, x, y) {
  const p = b[y][x];
  if (!p) return [];
  const red = isRed(p), me = colorOf(p), k = p.toUpperCase();
  const ms = [];
  const add = (tx, ty) => {
    if (!inBoard(tx, ty)) return;
    const t = b[ty][tx];
    if (!t || colorOf(t) !== me) ms.push({ fx: x, fy: y, tx, ty, cap: t || null });
  };
  const slide = (dirs, captureOnlyJump) => {
    for (const [dx, dy] of dirs) {
      let nx = x + dx, ny = y + dy, jumped = false;
      while (inBoard(nx, ny)) {
        const t = b[ny][nx];
        if (!captureOnlyJump) {
          if (!t) ms.push({ fx: x, fy: y, tx: nx, ty: ny, cap: null });
          else { if (colorOf(t) !== me) ms.push({ fx: x, fy: y, tx: nx, ty: ny, cap: t }); break; }
        } else {
          if (!jumped) { if (t) jumped = true; }
          else { if (t) { if (colorOf(t) !== me) ms.push({ fx: x, fy: y, tx: nx, ty: ny, cap: t }); break; } }
        }
        nx += dx; ny += dy;
      }
    }
  };
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (k === 'K') {
    for (const [dx, dy] of ORTH) { const tx = x + dx, ty = y + dy; if (inPalace(me, tx, ty)) add(tx, ty); }
    // 飛將：同列無子可吃對方將
    const dir = red ? -1 : 1;
    for (let ny = y + dir; ny >= 0 && ny < 10; ny += dir) {
      const t = b[ny][x];
      if (t) { if (t.toUpperCase() === 'K' && colorOf(t) !== me) ms.push({ fx: x, fy: y, tx: x, ty: ny, cap: t }); break; }
    }
  } else if (k === 'A') {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const tx = x + dx, ty = y + dy;
      if (inPalace(me, tx, ty)) add(tx, ty);
    }
  } else if (k === 'B') {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const tx = x + dx, ty = y + dy, ex = x + dx / 2, ey = y + dy / 2;
      if (!inBoard(tx, ty) || b[ey][ex]) continue;
      if (red ? ty < 5 : ty > 4) continue; // 不過河
      add(tx, ty);
    }
  } else if (k === 'N') {
    for (const [dx, dy, lx, ly] of [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]]) {
      const legx = x + lx, legy = y + ly;
      if (!inBoard(legx, legy) || b[legy][legx]) continue; // 蹩馬腿
      add(x + dx, y + dy);
    }
  } else if (k === 'R') {
    slide(ORTH, false);
  } else if (k === 'C') {
    slide(ORTH, false); // 不吃子走法
    // 吃子：跳 exactly 一子（上面 slide 已處理不吃；這裡只加吃子）
    for (const [dx, dy] of ORTH) {
      let nx = x + dx, ny = y + dy, jumped = false;
      while (inBoard(nx, ny)) {
        const t = b[ny][nx];
        if (!jumped) { if (t) jumped = true; }
        else if (t) { if (colorOf(t) !== me) ms.push({ fx: x, fy: y, tx: nx, ty: ny, cap: t }); break; }
        nx += dx; ny += dy;
      }
    }
  } else if (k === 'P') {
    const fwd = red ? -1 : 1;
    add(x, y + fwd);
    const crossed = red ? y <= 4 : y >= 5;
    if (crossed) { add(x - 1, y); add(x + 1, y); }
  }
  return ms;
}

function findKing(b, c) {
  const t = c === RED ? 'K' : 'k';
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) if (b[y][x] === t) return [x, y];
  return null;
}
function kingsFacing(b) {
  const rk = findKing(b, RED), bk = findKing(b, BLACK);
  if (!rk || !bk || rk[0] !== bk[0]) return false;
  for (let y = Math.min(rk[1], bk[1]) + 1; y < Math.max(rk[1], bk[1]); y++)
    if (b[y][rk[0]]) return false;
  return true;
}
function isAttacked(b, x, y, by) {
  for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 9; xx++) {
    const p = b[yy][xx];
    if (p && colorOf(p) === by) {
      if (pseudoMoves(b, xx, yy).some(m => m.tx === x && m.ty === y)) return true;
    }
  }
  return false;
}
function inCheck(b, c) {
  const k = findKing(b, c);
  if (!k) return true;
  const enemy = c === RED ? BLACK : RED;
  return isAttacked(b, k[0], k[1], enemy) || kingsFacing(b);
}
function applyMove(b, m) {
  const nb = b.map(r => r.slice());
  nb[m.ty][m.tx] = nb[m.fy][m.fx];
  nb[m.fy][m.fx] = null;
  return nb;
}
function legalMoves(b, c) {
  const out = [];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
    const p = b[y][x];
    if (p && colorOf(p) === c) {
      for (const m of pseudoMoves(b, x, y)) {
        const nb = applyMove(b, m);
        if (!findKing(nb, c)) continue;
        if (!inCheck(nb, c)) out.push(m);
      }
    }
  }
  return out;
}
const isCheckmate = (b, c) => inCheck(b, c) && legalMoves(b, c).length === 0;

// 紅一步殺：回傳所有能將死黑方的紅方走法
function mateInOne(b) {
  if (inCheck(b, BLACK) || inCheck(b, RED)) return [];
  if (legalMoves(b, BLACK).length === 0) return []; // 開局已無棋可下
  return legalMoves(b, RED).filter(m => isCheckmate(applyMove(b, m), BLACK));
}

window.QX = { parseFEN, toFEN, pseudoMoves, legalMoves, inCheck, isCheckmate, mateInOne, applyMove, findKing, RED, BLACK };
