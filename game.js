(() => {
'use strict';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const EDIT = /[?&]edit/.test(location.search);
const P = window.PARTS, ORDER = window.DRAW_ORDER;
const L = window.LAYOUT || { top: -340, feet: 135, headY: -230, neckY: -125 };
let W, H, DPR, S, RX, RY;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  const panelH = window.AV_PANEL_OPEN ? innerHeight * 0.46 : 0;   // 造型面板打開時，角色縮到面板上方
  cv.width = W * DPR; cv.height = H * DPR;
  const d = window.AVATAR ? AVATAR.dims() : { top: 0, bottom: 0 };
  const top = L.top - d.top, feet = L.feet + d.bottom;
  const span = feet - top + 60;
  const avail = H - panelH;
  S = Math.min(W / 430, avail / span);
  RX = W / 2; RY = avail / 2 - ((top + feet) / 2) * S + 12 + (panelH ? 20 : 0);
}
addEventListener('resize', resize); resize();
window.onAvatarChange = resize;

// ---------- 圖片載入 ----------
let IMG_SCALE = 1;
for (const k in P) {
  const p = P[k]; p.ok = false;
  if (!p.img) continue;
  p.im = new Image();
  p.im.onload = () => { p.ok = true; if (k === 'head') IMG_SCALE = window.HEAD_UNIT_W / p.im.naturalWidth; };
  p.im.src = p.img;
}
// 整身姿勢圖（可選）：parts.js 的 window.SPRITES，載不到就用部件程式模擬
const SP_IMG = {};
for (const k in (window.SPRITES || {})) {
  const d = window.SPRITES[k]; const im = new Image();
  SP_IMG[k] = Object.assign({}, d, { im: im, ok: false }); im.onload = () => { SP_IMG[k].ok = true; }; im.src = d.img;
}
function armLength() { const p = P.armL; return p.ok ? partW(p) * p.im.naturalHeight / p.im.naturalWidth * 0.86 : 90; }
if (window.AVATAR) AVATAR.attach(P);
function partW(p) { return p.w != null ? p.w : p.im.naturalWidth * IMG_SCALE; }

// ---------- 動態狀態 ----------
const A = {}; for (const k in P) A[k] = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
const spring = (k, d) => ({ x: 0, v: 0, k, d });
const sp = {
  headRot: spring(120, 8), headX: spring(110, 9), bodyRot: spring(60, 6), bodyX: spring(70, 7),
  knock: spring(160, 11), squash: spring(240, 12), arm: spring(80, 5), hair: spring(200, 6),
  lift: spring(70, 6), headY: spring(220, 10),
};
function stepSpring(s, dt) { s.v += (-s.k * s.x - s.d * s.v) * dt; s.x += s.v * dt; }

let dizzyT = 0, bumpT = 0;
// 打身體：手摀住被打的地方（torso 座標）
let cover = null;
// 傷勢：第一次被打後不再囂張；巴掌印、腫包、熊貓眼一直留到 KO 回血
let beenHit = false, faceM = null;
const bumps = [];                 // 臉上腫包 { x, y, r }（face 座標）
const eyeDmg = { L: 0, R: 0 };
const cheek = { L: 0, R: 0 };    // 臉頰紅腫等級 0~4（巴掌）    // 熊貓眼等級 0~3
const EYE = { L: [-48, -12], R: [48, -12] };
const HURT_TAUNTS = ['還、還沒完呢…', '你給我記住…', '才、才不痛咧！', '嗚…哼！', '有種再來啊…（發抖）'];
function resetDamage() { beenHit = false; bumps.length = 0; marks.length = 0; eyeDmg.L = eyeDmg.R = 0; cheek.L = cheek.R = 0; } // { x, y, t, max, arms: ['armL','armR'] }
// HP 與 KO 流程：fly（被揍飛）→ twinkle（飛到天邊閃一下）→ fall（掉回地上）→ beg（哭著磕頭認錯）→ rise（站起來回滿血）
const MAX_HP = 100;
let hp = MAX_HP, hpShow = MAX_HP;
let ko = null;
const BEG = ['對不起！！', '我錯了嗚嗚嗚', '大哥饒命～', '再也不敢了！', '嗚哇啊啊啊'];
let t = 0, hurtT = 0, idleT = 0, shakeT = 0, shakeA = 0;
let combo = 0, comboT = 0, best = 0, nSlap = 0, nPunch = 0;
let bubble = null, nextTaunt = 1.0;
const marks = [], fx = [], texts = [], trails = new Map();

const TAUNTS = ['來啊～打我啊', '就這？', '不痛不癢～', '你手很軟欸', '哼～', '再用力點啊', '我才不怕咧'];
const OUCH = ['嗚！', '哎唷！', '你敢打我？！', '痛痛痛', '等、等一下！'];
const pick = a => a[(Math.random() * a.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);

function update(dt) {
  t += dt;
  for (const k in sp) { stepSpring(sp[k], dt / 2); stepSpring(sp[k], dt / 2); }
  hurtT = Math.max(0, hurtT - dt); dizzyT = Math.max(0, dizzyT - dt); bumpT = Math.max(0, bumpT - dt);
  idleT += dt; comboT -= dt; if (comboT <= 0) combo = 0;
  shakeT = Math.max(0, shakeT - dt);

  const b = Math.sin(t * 2.4);            // 呼吸
  const bLag = Math.sin(t * 2.4 - 0.7);   // 延遲一點的跟隨
  // 胸口起伏（以腰為樞紐縮放），子部件反向縮放避免變形
  A.torso.sy = 1 + 0.03 * b; A.torso.sx = 1 - 0.012 * b;
  A.torso.rot = sp.bodyRot.x * 0.4;
  for (const k of ['head', 'armL', 'armR']) { A[k].sx = 1 / A.torso.sx; A[k].sy = 1 / A.torso.sy; }
  // 頭：囂張的晃頭＋受擊彈簧
  if (window.AVATAR) A.head.sx *= AVATAR.headW();
  A.head.rot = Math.sin(t * 1.1) * 0.035 + sp.headRot.x;
  A.head.dx = sp.headX.x;
  A.head.dy = bLag * 1.5 + sp.headY.x;
  // 手臂：跟著呼吸擺＋受擊甩動
  A.armL.rot = 0.06 + 0.05 * bLag + sp.arm.x;
  A.armR.rot = -0.06 - 0.05 * bLag - sp.arm.x * 0.8;
  if (cover) {
    cover.t += dt;
    const T = cover.t, M = cover.max;
    const w = T < 0.08 ? T / 0.08 : T > M - 0.3 ? Math.max(0, (M - T) / 0.3) : 1;
    const e = w * w * (3 - 2 * w);
    const armLen = armLength();
    for (const k of cover.arms) {
      const dx = cover.x - P[k].x, dy = cover.y - P[k].y;
      const th = Math.atan2(-dx, dy), dist = Math.hypot(dx, dy);
      A[k].rot = A[k].rot * (1 - e) + th * e;
      A[k].sy *= 1 - e + e * Math.max(0.55, Math.min(1, dist / armLen));
    }
    if (T >= M) cover = null;
  }
  // 頭髮：延遲彈跳
  const hb = Math.sin(t * 2.4 - 1.2) * 1.2;
  A.hairFront.dy = hb + sp.hair.x * 6; A.hairFront.rot = -sp.hair.x * 0.03;
  A.hairBack.dy = hb * 0.7 + sp.hair.x * 4;

  // 台詞
  if (bubble) { bubble.life -= dt; if (bubble.life <= 0) bubble = null; }
  if (!ko && !bubble && hurtT <= 0 && idleT > nextTaunt) {
    bubble = { txt: pick(beenHit ? HURT_TAUNTS : TAUNTS), life: 2.0, max: 2.0, kind: beenHit ? 'hurt' : 'taunt' };
    nextTaunt = idleT + rand(4, 7);
  }
  if (ko) updateKO(dt);
  hpShow += (hp - hpShow) * Math.min(1, dt * 6);
  for (const m of marks) m.life -= dt;
  while (marks.length && marks[0].life <= 0) marks.shift();
  for (const f of fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
  for (const x of texts) { x.life -= dt; x.y -= 60 * dt; }
  for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life <= 0) texts.splice(i, 1);
  for (const [, tr] of trails) for (const pt of tr) pt.life -= dt;
}

// ---------- 繪製 ----------
const C = { skin: '#ffd9b8', line: '#3a2a22', hair: '#2b2420', navy: '#1f2f5c', blue: '#5b8fe0', white: '#f7f7f2', cheek: '#ff9a9a' };
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function fs(fill, lw = 5) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.lineJoin = 'round'; ctx.stroke(); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

function drawArm() {
  rr(-20, 26, 26, 56, 13); fs(C.skin);
  circ(-7, 86, 16); fs(C.skin);
  rr(-32, -14, 48, 48, 16); fs(C.navy);
}
const FALLBACK = {
  legs() {
    rr(-46, 50, 30, 62, 10); fs(C.skin); rr(16, 50, 30, 62, 10); fs(C.skin);
    rr(-54, 104, 44, 26, 12); fs(C.white); rr(10, 104, 44, 26, 12); fs(C.white);
    rr(-70, -4, 140, 66, 20); fs(C.navy);
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, 60); ctx.stroke();
  },
  torso() {
    rr(-72, -130, 144, 132, 34);
    ctx.save(); ctx.clip();
    ctx.fillStyle = C.navy; ctx.fillRect(-80, -140, 160, 88);
    ctx.fillStyle = C.white; ctx.fillRect(-80, -52, 160, 60);
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-72, -52); ctx.lineTo(72, -52); ctx.lineWidth = 3; ctx.stroke();
  },
  armL() { drawArm(); },
  armR() { ctx.scale(-1, 1); drawArm(); },
  head() {
    rr(-16, -28, 32, 32, 6); fs(C.skin);
    circ(-100, -92, 20); fs(C.skin); circ(100, -92, 20); fs(C.skin);
    circ(0, -105, 106); fs(C.skin);
  },
  hairBack() { circ(0, -6, 114); fs(C.hair); },
  face() {
    // 囂張：一邊眉挑高、半垂眼、歪嘴笑
    ctx.lineCap = 'round'; ctx.strokeStyle = C.line; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-60, -30); ctx.lineTo(-24, -40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, -28); ctx.lineTo(60, -24); ctx.stroke();
    for (const ex of [-42, 42]) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, 2, 14, 18, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a1d18'; ctx.fill();
      ctx.fillStyle = '#fff'; circ(ex + 5, 4, 4); ctx.fill();
      ctx.fillStyle = C.skin; ctx.fillRect(ex - 18, -20, 36, 16);
      ctx.beginPath(); ctx.moveTo(ex - 18, -4); ctx.lineTo(ex + 18, -5); ctx.lineWidth = 6; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(-20, 42); ctx.quadraticCurveTo(4, 50, 26, 30); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 34); ctx.lineTo(28, 28); ctx.stroke();
  },
  faceHurt() {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = C.line; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-58, -22); ctx.lineTo(-28, -32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(58, -22); ctx.lineTo(28, -32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-56, -8); ctx.lineTo(-32, 2); ctx.lineTo(-56, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(56, -8); ctx.lineTo(32, 2); ctx.lineTo(56, 12); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 40, 16, 12, 0, 0, Math.PI * 2); ctx.fillStyle = '#7a2a2a'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#7fc8ff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 46, 26 + (t * 60 % 20), 6, 10, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 0.5; ctx.fillStyle = C.cheek;
    ctx.beginPath(); ctx.ellipse(-62, 22, 16, 9, 0, 0, Math.PI * 2); ctx.ellipse(62, 22, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  },
  hairFront() {
    ctx.beginPath();
    ctx.moveTo(-114, 34); ctx.lineTo(-114, -4);
    ctx.arc(0, -4, 114, Math.PI, 0, false);
    ctx.lineTo(114, 34); ctx.lineTo(94, 34); ctx.lineTo(92, 4);
    for (let x = 92, i = 0; x >= -92; x -= 23, i++) ctx.lineTo(x, i % 2 ? 4 : 12);   // 齊眉瀏海
    ctx.lineTo(-92, 4); ctx.lineTo(-94, 34); ctx.closePath();
    fs(C.hair);
    ctx.beginPath(); ctx.arc(-10, -40, 70, Math.PI * 1.15, Math.PI * 1.45); ctx.lineWidth = 7; ctx.strokeStyle = '#5a4a40'; ctx.lineCap = 'round'; ctx.stroke();
  },
};

function applyChain(k) {
  const chain = []; let c = k;
  while (c && c !== 'root') { chain.unshift(c); c = P[c].parent; }
  for (const n of chain) { const p = P[n], a = A[n]; ctx.translate(p.x + a.dx, p.y + a.dy); ctx.rotate(a.rot); ctx.scale(a.sx, a.sy); }
}
function drawPart(k) {
  const p = P[k];
  if (p.ok) {
    const w = partW(p), h = w * p.im.naturalHeight / p.im.naturalWidth;
    const cut = (k === 'face' || k === 'faceHurt') && (eyeDmg.L || eyeDmg.R);
    if (cut) { // 被打腫的眼睛從臉圖挖掉，之後整顆換畫
      ctx.save(); ctx.beginPath(); ctx.rect(-w, -h, w * 2, h * 2);
      for (const sd of ['L', 'R']) if (eyeDmg[sd]) { ctx.moveTo(EYE[sd][0] + EYE_CUT.rx, EYE[sd][1]); ctx.ellipse(EYE[sd][0], EYE[sd][1], EYE_CUT.rx, EYE_CUT.ry, 0, 0, Math.PI * 2); }
      ctx.clip('evenodd');
    }
    ctx.drawImage(p.im, -p.ax * w, -p.ay * h, w, h);
    if (cut) { ctx.restore(); for (const sd of ['L', 'R']) if (eyeDmg[sd]) drawSwollenEye(sd, eyeDmg[sd], p.im, w, h); }
  }
  else if (FALLBACK[k]) FALLBACK[k]();
}
// 腫包＆暈眩星星：畫在前髮座標裡（pivot＝頭髮頂端），跟著頭一起動
function drawBumpDizzy() {
  if (window.AVATAR) { const o = AVATAR.headTopOffset(); ctx.translate(o[0], o[1]); }
  if (bumpT > 0) {
    const r = 30 * Math.min(1, (3 - bumpT) * 6) * (bumpT < 0.4 ? bumpT / 0.4 : 1);
    ctx.save(); ctx.translate(22, 14);
    ctx.fillStyle = '#ff6b6b'; ctx.strokeStyle = C.line; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.9, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.55, r * 0.22, r * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (dizzyT > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, dizzyT * 2); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * Math.PI * 2 / 3;
      ctx.save(); ctx.translate(Math.cos(a) * 125, -14 + Math.sin(a) * 26); star(18); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
}
// 臉頰紅腫：只在臉頰範圍內，越打越紅越鼓
function drawCheeks() {
  for (const side of ['L', 'R']) {
    const n = cheek[side]; if (!n) continue;
    const sx = side === 'L' ? -1 : 1, cx = sx * (56 + n), cy = 26, rx = 18 + 2.5 * n, ry = 13 + 2 * n;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
    g.addColorStop(0, `rgba(235,60,60,${0.35 + 0.1 * n})`); g.addColorStop(0.7, `rgba(240,90,90,${0.25 + 0.08 * n})`); g.addColorStop(1, 'rgba(240,90,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    if (n >= 2) { // 鼓起來的輪廓
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(150,50,40,.7)';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, sx > 0 ? -0.9 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.9); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(cx - sx * 4, cy - ry * 0.45, rx * 0.25, ry * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function addBump(x, y, r) {
  const b = bumps.find(b => Math.hypot(b.x - x, b.y - y) < 22);
  if (b) b.r = Math.min(30, b.r + 5); else { bumps.push({ x, y, r }); if (bumps.length > 8) bumps.shift(); }
}
// 腫眼：原本的眼睛已在 drawPart 挖掉，這裡整顆換畫成「熊貓眼＋上下眼皮腫起、只剩一條縫」
const EYE_CUT = { rx: 30, ry: 24 };
function drawSwollenEye(side, n, im, w, h) {
  const [ex, ey] = EYE[side];
  // 紫眼框
  const R = 31 + 2 * n, Ry = 25 + 1.5 * n;
  const g = ctx.createRadialGradient(ex, ey, 4, ex, ey, R);
  g.addColorStop(0, `rgba(105,45,130,${0.45 + 0.08 * n})`); g.addColorStop(0.7, `rgba(120,55,140,${0.35 + 0.08 * n})`); g.addColorStop(1, 'rgba(120,55,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, ey, R, Ry, 0, 0, Math.PI * 2); ctx.fill();
  // 原本的眼睛縮小放回原位（越腫越小）
  if (!im) return;
  const sc = w / im.naturalWidth, k = Math.max(0.45, 0.78 - 0.11 * n);
  const hw = 42, hh = 32; // 來源半寬高（圖片像素）
  const px = im.naturalWidth / 2 + ex / sc, py = im.naturalHeight / 2 + ey / sc;
  ctx.drawImage(im, px - hw, py - hh, hw * 2, hh * 2, ex - hw * sc * k, ey - hh * sc * k, hw * 2 * sc * k, hh * 2 * sc * k);
}
// 臉上腫包（face 座標）
function drawInjury() {
  for (const b of bumps) {
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 1, b.x, b.y, b.r);
    g.addColorStop(0, '#ff9a8a'); g.addColorStop(1, '#e0584a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8a3428'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.25, b.r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
  }
}
function drawMarks() {
  for (const m of marks) {
    const a = Math.min(1, m.life / 1.5) * 0.55;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot); ctx.globalAlpha = a; ctx.fillStyle = '#ff3b3b';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-15 + i * 10, -4 + Math.abs(i - 1.5) * 4, 4, 20, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, 20, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#fff6e2'); g.addColorStop(1, '#ffcf96');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (shakeT > 0) { const s = shakeA * shakeT / 0.25; ctx.translate(rand(-s, s), rand(-s, s)); }

  const hurt = hurtT > 0 || beenHit;
  // 地面影子
  ctx.save(); ctx.fillStyle = 'rgba(120,70,30,.18)';
  ctx.beginPath(); ctx.ellipse(RX + sp.bodyX.x * S * 0.5, RY + (L.feet - 3) * S, 110 * S * (1 + sp.knock.x), 18 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  ctx.save();
  ctx.translate(RX + sp.bodyX.x * S, RY + sp.lift.x * S);
  ctx.scale(S, S);
  // 以腳底為樞紐：被打退（縮小）＋壓扁＋傾斜
  ctx.translate(0, L.feet);
  ctx.rotate(sp.bodyRot.x * 0.25);
  const k = 1 + sp.knock.x;
  ctx.scale(k * (1 + sp.squash.x), k * (1 - sp.squash.x));
  ctx.translate(0, -L.feet);
  let spr = null;
  if (ko) {
    ctx.translate(ko.x, ko.y);
    ctx.translate(0, -200); ctx.rotate(ko.rot); ctx.scale(ko.sc || 1, ko.sc || 1); ctx.translate(0, 200);
    spr = koSprite();
  }
  if (spr) {
    const s2 = SP_IMG[spr], h = s2.h, w = h * s2.im.naturalWidth / s2.im.naturalHeight;
    ctx.save(); if (s2.flip) ctx.scale(-1, 1); ctx.drawImage(s2.im, -w / 2, L.feet - h + (s2.dy || 0), w, h); ctx.restore();
  }
  const order = ko && (ko.phase === 'beg' || ko.phase === 'land')
    ? ORDER.filter(k => !['hairBack', 'head', 'face', 'faceHurt', 'hairFront'].includes(k)).concat(['hairBack', 'head', 'hairFront', 'face', 'faceHurt'])
    : ORDER;
  if (!spr) for (const key of order) {
    if (key === 'face' && hurt) continue;
    if (key === 'faceHurt' && !hurt) continue;
    ctx.save(); applyChain(key);
    if (!window.AVATAR || AVATAR.beforePart(key, ctx)) { drawPart(key); if (window.AVATAR) AVATAR.afterPart(key, ctx); }
    if (key === 'face' || key === 'faceHurt') { faceM = ctx.getTransform(); drawCheeks(); drawInjury(); }
    if (key === 'hairFront') drawBumpDizzy();
    if (EDIT) { ctx.fillStyle = key === sel ? '#f00' : '#0a0'; circ(0, 0, key === sel ? 7 : 4); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();

  // 滑動軌跡
  for (const [, tr] of trails) {
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i], b = tr[i - 1]; if (a.life <= 0) continue;
      ctx.strokeStyle = `rgba(255,255,255,${a.life * 3})`; ctx.lineWidth = 16 * a.life * 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
    }
  }
  // 特效
  for (const f of fx) {
    const a = Math.max(0, f.life / f.max);
    ctx.globalAlpha = a;
    if (f.type === 'emoji') {
      const sc = 1 + (1 - a) * 0.6; ctx.font = `${f.size * sc}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.ch, f.x, f.y);
    } else if (f.type === 'ring') {
      ctx.strokeStyle = f.col; ctx.lineWidth = 6 * a; circ(f.x, f.y, f.size * (1.4 - a)); ctx.stroke();
    } else {
      ctx.fillStyle = f.col; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(t * 8 + f.size);
      star(f.size); ctx.fill(); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  for (const x of texts) {
    const a = Math.min(1, x.life / 0.3), sc = 1 + Math.max(0, x.life - x.max + 0.15) * 4;
    ctx.globalAlpha = a; ctx.font = `900 ${x.size * sc}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.strokeStyle = '#fff'; ctx.strokeText(x.txt, x.x, x.y); ctx.fillStyle = x.col; ctx.fillText(x.txt, x.x, x.y);
  }
  ctx.globalAlpha = 1;
  // 對話框
  if (bubble) {
    const bx = RX + sp.headX.x * S + 140 * S, by = RY + (L.top + 80) * S;
    ctx.font = `800 ${Math.max(15, 20 * S)}px system-ui,sans-serif`;
    const tw = ctx.measureText(bubble.txt).width, pw = tw + 28, ph = 22 * S + 22;
    const x0 = Math.min(W - pw - 8, bx - pw / 2);
    ctx.globalAlpha = Math.min(1, bubble.life * 4, (bubble.max - bubble.life) * 8);
    rr(x0, by - ph / 2, pw, ph, ph / 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.fillStyle = C.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bubble.txt, x0 + pw / 2, by + 1);
    ctx.globalAlpha = 1;
  }
  // HP 條
  {
    const bw = Math.min(W * 0.7, 420), bh = 16, bx = (W - bw) / 2, by = 46;
    rr(bx - 3, by - 3, bw + 6, bh + 6, 10); ctx.fillStyle = '#3a2a22'; ctx.fill();
    rr(bx, by, bw, bh, 7); ctx.fillStyle = '#6b4a3a'; ctx.fill();
    const r = Math.max(0, hpShow / MAX_HP), r2 = Math.max(0, hp / MAX_HP);
    if (r > r2) { rr(bx, by, bw * r, bh, 7); ctx.fillStyle = '#ffd23f'; ctx.fill(); }
    if (r2 > 0) { rr(bx, by, bw * r2, bh, 7); ctx.fillStyle = r2 > 0.5 ? '#4cd964' : r2 > 0.25 ? '#ff9f1a' : '#ff3b30'; ctx.fill(); }
    ctx.font = '900 13px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#3a2a22'; ctx.strokeText('囂張值', bx + 6, by + bh / 2 + 1); ctx.fillStyle = '#fff'; ctx.fillText('囂張值', bx + 6, by + bh / 2 + 1);
  }
  // 連擊
  if (combo >= 3) {
    ctx.font = `900 ${30 + Math.min(combo, 30)}px system-ui,sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText(`${combo} 連擊！`, W / 2, H * 0.14);
    ctx.fillStyle = '#e74c3c'; ctx.fillText(`${combo} 連擊！`, W / 2, H * 0.14);
  }
}
function star(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.45 : r, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  ctx.closePath();
}

// ---------- 音效 ----------
let AC = null;
function initAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  loadPunch();
}
function noise(dur) {
  const n = (AC.sampleRate * dur) | 0, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const s = AC.createBufferSource(); s.buffer = b; return s;
}
function sfxSlap(f) {
  if (!AC) return; const t0 = AC.currentTime;
  const n = noise(0.16), bp = AC.createBiquadFilter(), g = AC.createGain();
  bp.type = 'bandpass'; bp.frequency.value = rand(1600, 2400); bp.Q.value = 0.7;
  g.gain.value = Math.min(1, 0.5 + f * 0.3);
  n.connect(bp).connect(g).connect(AC.destination); n.start(t0);
}
// 出拳音效：TIVOT 的 se_punch（載入失敗時退回合成音）
let punchBuf = null, punchLoading = false;
function loadPunch() {
  if (!AC || punchBuf || punchLoading) return; punchLoading = true;
  fetch('sfx/se_punch.m4a').then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b))
    .then(buf => { punchBuf = buf; }).catch(() => {});
}
function sfxPunch(rate = 1) {
  if (!AC) return;
  if (punchBuf) { const s = AC.createBufferSource(); s.buffer = punchBuf; s.playbackRate.value = rate * rand(0.95, 1.06); s.connect(AC.destination); s.start(); return; }
  const t0 = AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(170, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
  g.gain.setValueAtTime(0.9, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
  o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.25);
  const n = noise(0.08), lp = AC.createBiquadFilter(), g2 = AC.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 900; g2.gain.value = 0.7;
  n.connect(lp).connect(g2).connect(AC.destination); n.start(t0);
}

// ---------- 打擊 ----------
function onHit(isPunch, dmg = 6) {
  hp = Math.max(0, hp - dmg); beenHit = true;
  hurtT = Math.max(hurtT, isPunch ? 0.7 : 0.9); idleT = 0; nextTaunt = rand(1.4, 2.2);
  combo++; comboT = 1.0; if (combo > best) best = combo;
  if (isPunch) nPunch++; else nSlap++;
  document.getElementById('nSlap').textContent = nSlap;
  document.getElementById('nPunch').textContent = nPunch;
  document.getElementById('nBest').textContent = best;
  // 被打當下，囂張台詞立刻換掉（不會一邊被打一邊說不痛不癢）
  if (!bubble || bubble.kind === 'taunt' || Math.random() < 0.45) bubble = { txt: pick(OUCH), life: 0.9, max: 0.9 };
  if (navigator.vibrate) navigator.vibrate(isPunch ? 35 : 20);
  const hint = document.getElementById('hint'); if (hint) hint.style.opacity = 0;
  if (hp <= 0 && !ko) startKO();
}
function shake(a) { shakeA = a; shakeT = 0.25; }
function headScreen() { return { x: RX + sp.bodyX.x * S + sp.headX.x * S, y: RY + L.headY * S }; }

function slap(dir, v) {
  const f = Math.min(2.2, 0.7 + v * 0.7);
  sp.headRot.v += dir * 6 * f; sp.headX.v += dir * 150 * f;
  sp.bodyRot.v += dir * 1.8 * f; sp.bodyX.v += dir * 110 * f;
  sp.arm.v += 2.5 * f; sp.hair.v += 3 * f;
  const cs = dir > 0 ? 'L' : 'R'; cheek[cs] = Math.min(4, cheek[cs] + 1);
  if (marks.length > 8) marks.shift();
  onHit(false, 4 + f * 2); shake(8 * f); sfxSlap(f);
  const h = headScreen();
  texts.push({ txt: '啪！', x: h.x - dir * 90 * S, y: h.y - 40 * S, size: 46, col: '#e74c3c', life: 0.7, max: 0.7 });
  for (let i = 0; i < 6; i++) fx.push({ type: 'star', col: '#7fd3ff', x: h.x - dir * 80 * S, y: h.y, vx: dir * rand(150, 400), vy: rand(-300, -80), g: 900, size: rand(5, 9), life: 0.6, max: 0.6 });
}
function punch(x, y) {
  const h = headScreen();
  const onHead = y < RY + L.neckY * S;
  const off = Math.max(-1, Math.min(1, (x - h.x) / (110 * S)));
  sp.knock.v -= 2.4; sp.squash.v += 2.8; sp.hair.v += 4;
  if (onHead) {
    sp.headRot.v += -off * 5 + rand(-1, 1); sp.headX.v += -off * 80;
    if (faceM) {
      const p = faceM.inverse().transformPoint(new DOMPoint(x * DPR, y * DPR));
      if (Math.abs(p.x) < 115 && p.y > -75 && p.y < 75) {
        const side = ['L', 'R'].find(k => Math.hypot(p.x - EYE[k][0], p.y - EYE[k][1]) < 34);
        if (side) eyeDmg[side] = Math.min(3, eyeDmg[side] + 1); else addBump(p.x, p.y, 13);
      }
    }
  }
  else {
    sp.bodyRot.v += -off * 2; sp.headRot.v += rand(-2, 2);
    const lx = (x - (RX + sp.bodyX.x * S)) / S, ly = (y - RY) / S - P.torso.y;
    const arms = Math.abs(lx) < 35 ? ['armL', 'armR'] : lx < 0 ? ['armL'] : ['armR'];
    cover = { x: lx, y: ly, t: 0, max: 1.1, arms };
  }
  onHit(true, 7); shake(6); sfxPunch();
  fx.push({ type: 'emoji', ch: '👊', x, y, size: 64, life: 0.35, max: 0.35, vx: 0, vy: 0 });
  fx.push({ type: 'ring', col: '#ffcc33', x, y, size: 60, life: 0.3, max: 0.3, vx: 0, vy: 0 });
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, s = rand(200, 450); fx.push({ type: 'star', col: i % 2 ? '#ffd23f' : '#ff8a3d', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 300, size: rand(6, 11), life: 0.5, max: 0.5 }); }
  texts.push({ txt: '砰！', x: x + rand(-30, 30), y: y - 50, size: 42, col: '#ff8a00', life: 0.6, max: 0.6 });
}

// 上勾拳（往上滑）：下巴被打、整個人被打飛起來、頭往後仰
function uppercut(v) {
  const f = Math.min(2, 0.8 + v * 0.6);
  sp.lift.v -= 900 * f; sp.squash.v -= 3.5 * f; sp.headY.v -= 140 * f;
  sp.headRot.v += rand(-3, 3); sp.arm.v += 6 * f; sp.hair.v -= 8 * f;
  onHit(true, 12); shake(9 * f); sfxPunch(1.12);
  const h = headScreen();
  texts.push({ txt: '喝啊！', x: h.x, y: h.y + 40 * S, size: 46, col: '#e67e22', life: 0.7, max: 0.7 });
  for (let i = 0; i < 9; i++) fx.push({ type: 'star', col: i % 2 ? '#ffd23f' : '#ff8a3d', x: h.x + rand(-40, 40) * S, y: h.y + 90 * S, vx: rand(-200, 200), vy: rand(-650, -300), g: 900, size: rand(6, 11), life: 0.6, max: 0.6 });
}
// 槌頭（往下滑）：從上面槌下去、整個人被壓扁、頭陷進身體、腫包＋暈眩
function hammer(v) {
  const f = Math.min(2, 0.8 + v * 0.6);
  sp.squash.v += 6 * f; sp.headY.v += 260 * f; sp.lift.v += 200 * f; sp.hair.v += 10 * f; sp.arm.v += 5 * f;
  bumpT = 3; dizzyT = 2.2;
  onHit(true, 12); shake(11 * f); sfxPunch(0.8);
  const h = headScreen();
  texts.push({ txt: '咚！', x: h.x, y: h.y - 150 * S, size: 54, col: '#c0392b', life: 0.7, max: 0.7 });
  fx.push({ type: 'emoji', ch: '👊', x: h.x, y: h.y - 140 * S, size: 70, life: 0.35, max: 0.35, vx: 0, vy: 0 });
  for (let i = 0; i < 8; i++) { const a = Math.PI + Math.random() * Math.PI; fx.push({ type: 'star', col: '#ffd23f', x: h.x, y: h.y - 120 * S, vx: Math.cos(a) * 350, vy: Math.sin(a) * 250, g: 600, size: rand(6, 10), life: 0.5, max: 0.5 }); }
}

// ---------- KO 流程 ----------
function startKO() {
  ko = { phase: 'fly', t: 0, x: 0, y: 0, rot: 0, sc: 1, dir: Math.random() < 0.5 ? -1 : 1 };
  bubble = { txt: '哇啊啊啊啊——！', life: 1.2, max: 1.2 };
  texts.push({ txt: 'K.O.!!', x: W / 2, y: H * 0.3, size: 72, col: '#e74c3c', life: 1.2, max: 1.2 });
  shake(16); combo = 0;
}
function koSprite() {
  const has = k => SP_IMG[k] && SP_IMG[k].ok;
  if (!ko) return null;
  if (ko.phase === 'fly' || ko.phase === 'fall') return has('fly') ? 'fly' : null;
  if (ko.phase === 'land') return has('land') ? 'land' : null;
  if (ko.phase === 'beg') { const k = Math.sin(ko.t * 7) > 0 ? 'bow' : 'kneel'; return has(k) ? k : null; }
  return null;
}
function updateKO(dt) {
  ko.t += dt;
  const T = ko.t;
  hurtT = Math.max(hurtT, 0.2); dizzyT = 0;
  if (ko.phase === 'fly') {           // 往天邊飛走、邊轉邊變小
    ko.y = -2600 * T + 300 * T * T; ko.x = ko.dir * 500 * T; ko.rot += ko.dir * 16 * dt; ko.sc = Math.max(0.25, 1 - T * 0.7);
    if (T > 0.9) { ko.phase = 'twinkle'; ko.t = 0; fx.push({ type: 'star', col: '#fff6a0', x: W / 2 + ko.dir * W * 0.3, y: H * 0.1, vx: 0, vy: 0, g: 0, size: 26, life: 0.6, max: 0.6 }); sfxPing(); }
  } else if (ko.phase === 'twinkle') {
    ko.y = -5000;
    if (T > 0.9) { ko.phase = 'fall'; ko.t = 0; bubble = { txt: '啊啊啊啊——', life: 0.8, max: 0.8 }; }
  } else if (ko.phase === 'fall') {   // 從上面掉回原地
    const D = 0.6, k = Math.min(1, T / D);
    ko.x = 0; ko.sc = 1; ko.y = -1500 * (1 - k * k); ko.rot = (1 - k) * ko.dir * 6;
    if (T >= D) {
      ko.phase = 'land'; ko.t = 0; ko.y = 0; ko.rot = 0;
      sp.squash.v += 9; shake(18); sfxPunch(0.6);
      texts.push({ txt: '碰！！', x: RX, y: RY + (L.feet - 40) * S, size: 56, col: '#8e44ad', life: 0.8, max: 0.8 });
      for (let i = 0; i < 14; i++) fx.push({ type: 'star', col: '#d9c3a5', x: RX + rand(-120, 120) * S, y: RY + L.feet * S, vx: rand(-260, 260), vy: rand(-260, -60), g: 500, size: rand(6, 12), life: 0.7, max: 0.7 });
    }
  } else if (ko.phase === 'land') {
    if (T > 0.7) { ko.phase = 'beg'; ko.t = 0; }
  } else if (ko.phase === 'beg') {    // 跪著哭、一直磕頭
    if (!bubble || bubble.life < 0.1) bubble = { txt: pick(BEG), life: 1.2, max: 1.2 };
    if (Math.random() < dt * 8) { const h = headScreen(); fx.push({ type: 'star', col: '#7fc8ff', x: h.x + rand(-60, 60) * S, y: h.y + 80 * S, vx: rand(-80, 80), vy: rand(-200, -80), g: 700, size: 5, life: 0.6, max: 0.6 }); }
    const sn = Math.sin(T * 7);
    if (sn > 0.95 && !ko.bonk) { ko.bonk = true; sfxBonk(); } else if (sn < 0) ko.bonk = false;
    if (T > 5) { ko.phase = 'rise'; ko.t = 0; bubble = { txt: '……哼，剛剛只是讓你的', life: 2.2, max: 2.2 }; }
  } else if (ko.phase === 'rise') {
    hp = Math.min(MAX_HP, hp + MAX_HP * dt * 1.5);
    if (T > 0.8) { resetDamage(); hp = MAX_HP; ko = null; hurtT = 0; idleT = 0; nextTaunt = 3; sp.squash.v -= 4; return; }
  }
  if (!koSprite()) koPuppetPose();
}
// 沒有姿勢圖時，用部件模擬：跪下（腿壓扁）＋磕頭（上身縮、頭往下點）
function koPuppetPose() {
  if (ko.phase === 'land' || ko.phase === 'beg') {
    const kneel = Math.min(1, ko.phase === 'land' ? ko.t / 0.3 : 1);
    A.legs.sy = 1 - 0.6 * kneel;
    ko.y = L.feet * 0.6 * kneel;
    const bow = ko.phase === 'beg' ? Math.max(0, Math.sin(ko.t * 7)) : 0;
    A.torso.sy *= 1 - 0.18 * bow; A.head.dy += 55 * bow; A.head.rot = 0;
    A.armL.rot = -0.9 * kneel + 0.5 * bow; A.armR.rot = 0.9 * kneel - 0.5 * bow;
  } else {
    A.legs.sy = 1;
  }
}
function sfxPing() {
  if (!AC) return; const t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(1800, t0); o.frequency.exponentialRampToValueAtTime(2600, t0 + 0.1);
  g.gain.setValueAtTime(0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
  o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.45);
}
function sfxBonk() {
  if (!AC) return; const t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(320, t0); o.frequency.exponentialRampToValueAtTime(140, t0 + 0.08);
  g.gain.setValueAtTime(0.35, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.15);
}

// ---------- 命中判定：只有碰到人才算 ----------
function hitChar(x, y) {
  const cx = RX + sp.bodyX.x * S, h = headScreen();
  const hr = 130 * S;
  if ((x - h.x) ** 2 + (y - h.y) ** 2 < hr * hr) return true;                         // 頭
  return Math.abs(x - cx) < 115 * S && y > RY + L.neckY * S && y < RY + L.feet * S;   // 身體
}

// ---------- 輸入（多指） ----------
const gest = new Map();
cv.addEventListener('pointerdown', e => {
  initAudio();
  gest.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now(), slapped: false, lx: e.clientX, ly: e.clientY, touched: hitChar(e.clientX, e.clientY) });
  trails.set(e.pointerId, [{ x: e.clientX, y: e.clientY, life: 0.25 }]);
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  const g = gest.get(e.pointerId); if (!g) return;
  const tr = trails.get(e.pointerId); if (tr) { tr.push({ x: e.clientX, y: e.clientY, life: 0.25 }); if (tr.length > 20) tr.shift(); }
  if (EDIT) { editDrag(e.clientX - g.lx, e.clientY - g.ly); g.lx = e.clientX; g.ly = e.clientY; return; }
  if (ko) return;
  if (!g.touched) { g.touched = hitChar(e.clientX, e.clientY); if (g.touched) { g.x0 = e.clientX; g.y0 = e.clientY; g.t0 = performance.now() - 60; } }
  if (!g.touched) return;
  if (g.slapped && !g.dir) return;
  if (g.slapped) {  // 同一筆畫反向再甩一次
    const dx = e.clientX - g.x0, dt = performance.now() - g.t0;
    if (Math.sign(dx) === -g.dir && Math.abs(dx) > 60 && dt < 450) { g.dir = Math.sign(dx); g.x0 = e.clientX; g.t0 = performance.now(); slap(g.dir, Math.abs(dx) / Math.max(dt, 16)); }
    else if (Math.sign(dx) === g.dir) { g.x0 = e.clientX; g.t0 = performance.now(); }
    return;
  }
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0, dt = performance.now() - g.t0;
  if (Math.abs(dy) > 70 && Math.abs(dy) > Math.abs(dx) * 1.3 && dt < 450) {
    g.slapped = true; g.dir = 0;
    const v = Math.abs(dy) / Math.max(dt, 16);
    if (dy < 0) uppercut(v); else hammer(v);
    return;
  }
  if (Math.abs(dx) > 60 && Math.abs(dx) >= Math.abs(dy) && dt < 450) {
    g.slapped = true; g.dir = Math.sign(dx); g.x0 = e.clientX; g.t0 = performance.now();
    slap(g.dir, Math.abs(dx) / Math.max(dt, 16));
  }
});
function endPointer(e) {
  const g = gest.get(e.pointerId); if (!g) return;
  gest.delete(e.pointerId);
  setTimeout(() => trails.delete(e.pointerId), 300);
  if (EDIT || g.slapped || ko) return;
  const d = Math.hypot(e.clientX - g.x0, e.clientY - g.y0);
  if (d < 25 && performance.now() - g.t0 < 500 && hitChar(e.clientX, e.clientY)) punch(e.clientX, e.clientY);
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', e => { gest.delete(e.pointerId); trails.delete(e.pointerId); });
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- 編輯模式（?edit）：選部件、拖曳對位、輸出設定 ----------
let sel = 'head';
function editDrag(dx, dy) { P[sel].x += dx / S; P[sel].y += dy / S; out(); }
function out() {
  const o = {};
  for (const k in P) { const p = P[k]; o[k] = { parent: p.parent, img: p.img, x: Math.round(p.x), y: Math.round(p.y), ax: p.ax, ay: p.ay, w: p.w == null ? null : Math.round(p.w) }; }
  const ta = document.getElementById('cfg'); if (ta) ta.value = 'window.PARTS = ' + JSON.stringify(o, null, 1).replace(/\n\s*/g, ' ') + ';';
}
if (EDIT) {
  const d = document.createElement('div'); d.id = 'edit';
  d.innerHTML = `<b>編輯模式</b>：選部件後在畫面拖曳<br>
    <select id="sel">${Object.keys(P).map(k => `<option ${k === sel ? 'selected' : ''}>${k}</option>`).join('')}</select>
    <button data-w="-5">縮小</button><button data-w="5">放大</button><br>
    樞紐 ax <input id="ax" type="number" step="0.02" style="width:56px"> ay <input id="ay" type="number" step="0.02" style="width:56px">
    <button id="copy">複製設定</button><textarea id="cfg"></textarea>`;
  document.body.appendChild(d);
  ['pointerdown', 'pointermove', 'pointerup'].forEach(ev => d.addEventListener(ev, e => e.stopPropagation()));
  const $ = id => document.getElementById(id);
  const sync = () => { $('ax').value = P[sel].ax; $('ay').value = P[sel].ay; };
  $('sel').onchange = e => { sel = e.target.value; sync(); };
  d.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const p = P[sel]; p.w = Math.max(5, (p.w != null ? p.w : (p.ok ? partW(p) : 100)) + +b.dataset.w); out(); });
  $('ax').oninput = e => { P[sel].ax = +e.target.value; out(); };
  $('ay').oninput = e => { P[sel].ay = +e.target.value; out(); };
  $('copy').onclick = () => { $('cfg').select(); try { navigator.clipboard.writeText($('cfg').value); } catch (_) { document.execCommand('copy'); } };
  addEventListener('keydown', e => {
    const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (m && document.activeElement.tagName !== 'INPUT') { P[sel].x += m[0]; P[sel].y += m[1]; out(); e.preventDefault(); }
  });
  sync(); out();
}

// ---------- 主迴圈 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__game = { slap, punch, uppercut, hammer, sp, startKO, get hp() { return hp; }, set hp(v) { hp = v; }, get ko() { return ko; } };
})();
