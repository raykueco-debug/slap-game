// 造型系統：把 parts 換成造型庫（lib/manifest.js → window.STYLE_LIB）的素材
// 預設全部 'orig'＝原本那套原畫；設定只存在手機本機（localStorage），不存照片
window.AVATAR = (() => {
  'use strict';
  const LIB = window.STYLE_LIB || {};
  const META = window.STYLE_META || { refFront: 0.5617, refBack: 0.4678 };
  const U = 230 / 377;                 // 原圖 px → 角色座標（以原頭寬 377px＝230 為準）
  const CLIP_Y = -45;                  // 短髮後髮只保留 head 座標此線以上
  const SKIN = [
    { id: 'orig',  name: '原色', c: null },
    { id: 'fair',  name: '白皙', c: '#ffe6d6' },
    { id: 'light', name: '自然', c: '#fbd2b6' },
    { id: 'tan',   name: '小麥', c: '#e9b58f' },
    { id: 'brown', name: '健康', c: '#c88e64' },
    { id: 'dark',  name: '黝黑', c: '#8f5c3e' },
  ];
  const HAIRC = [
    { id: 'black',  name: '黑',   c: '#2e2826' },
    { id: 'dbrown', name: '深棕', c: '#4b3226' },
    { id: 'brown',  name: '棕',   c: '#80522f' },
    { id: 'blond',  name: '金',   c: '#d8b15c' },
    { id: 'gray',   name: '灰白', c: '#bdbab6' },
    { id: 'red',    name: '紅',   c: '#a3412e' },
    { id: 'blue',   name: '藍',   c: '#3b5fa8' },
    { id: 'pink',   name: '粉',   c: '#e48aa8' },
  ];
  // 配件位置（space：face＝臉座標、head＝頭座標、torso＝身體座標；w＝畫出寬度，單位角色座標）
  const ACC_POS = {
    g_round: { slot: 'glasses', space: 'face', y: -8, w: 190 }, g_square: { slot: 'glasses', space: 'face', y: -8, w: 190 },
    g_half: { slot: 'glasses', space: 'face', y: -8, w: 190 }, g_thick: { slot: 'glasses', space: 'face', y: -8, w: 195 },
    g_cat: { slot: 'glasses', space: 'face', y: -10, w: 195 }, g_sun: { slot: 'glasses', space: 'face', y: -8, w: 195 },
    g_aviator: { slot: 'glasses', space: 'face', y: -6, w: 195 }, g_monocle: { slot: 'glasses', space: 'face', x: 48, y: 4, w: 60, ay: 0.3 },
    b_stubble: { slot: 'beard', space: 'face', y: 42, w: 170, under: true }, b_mustache: { slot: 'beard', space: 'face', y: 20, w: 80, under: true },
    b_handlebar: { slot: 'beard', space: 'face', y: 20, w: 100, under: true }, b_goatee: { slot: 'beard', space: 'face', y: 62, w: 44, under: true },
    b_full: { slot: 'beard', space: 'face', y: 40, w: 190, under: true }, b_boxed: { slot: 'beard', space: 'face', y: 46, w: 150, under: true },
    b_chinstrap: { slot: 'beard', space: 'face', y: 42, w: 190, under: true }, b_soul: { slot: 'beard', space: 'face', y: 58, w: 18, under: true },
    h_cap: { slot: 'hat', space: 'head', y: -160, w: 250, ay: 0.75 }, h_capback: { slot: 'hat', space: 'head', y: -165, w: 245, ay: 0.75 },
    h_beanie: { slot: 'hat', space: 'head', y: -150, w: 240, ay: 0.8 }, h_bucket: { slot: 'hat', space: 'head', y: -150, w: 270, ay: 0.8 },
    h_sweatband: { slot: 'hat', space: 'head', y: -170, w: 225 }, h_hairband: { slot: 'hat', space: 'head', y: -200, w: 230, ay: 0.4 },
    h_bow: { slot: 'hat', space: 'head', x: 60, y: -205, w: 90 }, h_clip: { slot: 'hat', space: 'head', x: 62, y: -175, w: 44 },
    h_headphones: { slot: 'hat', space: 'head', y: -140, w: 280 },
    e_hoop: { slot: 'ear', space: 'head', pair: 116, y: -40, w: 34, ay: 0.15 }, e_pearl: { slot: 'ear', space: 'head', pair: 116, y: -52, w: 16 },
    n_chain: { slot: 'neck', space: 'torso', y: -150, w: 100 },
    f_mole: { slot: 'mark', space: 'face', x: 38, y: 36, w: 10 }, f_freckles: { slot: 'mark', space: 'face', pair: 58, y: 22, w: 46 },
    f_scar: { slot: 'mark', space: 'face', x: -44, y: 20, w: 50 }, f_bandage: { slot: 'mark', space: 'face', x: 52, y: 26, w: 48 },
  };
  const SLOTS = ['glasses', 'beard', 'hat', 'ear', 'neck', 'mark'];
  const DEF = { gender: 'm', head: 'orig', hair: 'orig', face: 'orig', body: 'orig', skin: 'orig', hairColor: 'black',
                glasses: null, beard: null, hat: null, ear: null, neck: null, mark: null, faceW: 1 };
  const KEY = 'slap_avatar_v2';
  let cur = Object.assign({}, DEF);
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(cur, s); } catch (_) {}

  // ---------- 小工具 ----------
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  const imgCache = {};
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = src; });
    return imgCache[src];
  }
  function toCanvas(im) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0); c.naturalWidth = c.width; c.naturalHeight = c.height; return c;
  }
  // 皮膚換色：只動膚色像素，保留明暗
  function recolorSkin(im, target, refL) {
    const c = toCanvas(im); if (!target) return c;
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), a = d.data, T = hex(target);
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 10) continue;
      const [h, s, l] = rgb2hsl(a[i], a[i + 1], a[i + 2]);
      if (!(h >= 5 && h <= 45 && s > 0.15 && l > 0.4)) continue;
      const k = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / refL;
      a[i] = Math.min(255, T[0] * k); a[i + 1] = Math.min(255, T[1] * k); a[i + 2] = Math.min(255, T[2] * k);
    }
    x.putImageData(d, 0, 0); return c;
  }
  // 頭髮換色：灰階明暗 → 指定髮色的暗→亮色階；描邊保留
  function recolorHair(im, color, srcIsGray) {
    const c = toCanvas(im);
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    const base = hex(color), dark = mix(base, [0, 0, 0], 0.65), hi = mix(base, [255, 255, 255], 0.4);
    const lo = srcIsGray ? 0.16 : 0.07, span = srcIsGray ? 0.62 : 0.5;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 10) continue;
      const l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
      if (l < lo) continue;
      const t = Math.min(1, (l - lo) / span);
      const col = t < 0.5 ? mix(dark, base, t / 0.5) : mix(base, hi, (t - 0.5) / 0.5);
      a[i] = col[0]; a[i + 1] = col[1]; a[i + 2] = col[2];
    }
    x.putImageData(d, 0, 0); return c;
  }

  // ---------- 套用到 parts ----------
  let P = null, ORIG = null, ready = false, refL = 200, version = 0;
  const DIM = { top: 0, bottom: 0 };   // 體型比原本高出多少（版面縮放用）
  const accImgs = {};
  function snapshot() {
    ORIG = {};
    for (const k in P) ORIG[k] = { im: P[k].im, x: P[k].x, y: P[k].y, ax: P[k].ax, ay: P[k].ay, w: P[k].w, img: P[k].img };
    const c = toCanvas(P.head.im), d = c.getContext('2d').getImageData(c.width >> 1, (c.height * 0.45) | 0, 1, 1).data;
    refL = d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11;
  }
  function restore(k) { Object.assign(P[k], { im: ORIG[k].im, x: ORIG[k].x, y: ORIG[k].y, ax: ORIG[k].ax, ay: ORIG[k].ay, w: ORIG[k].w }); P[k].long = true; }
  const skinColor = () => (SKIN.find(s => s.id === cur.skin) || {}).c || null;
  const hairColor = () => (HAIRC.find(s => s.id === cur.hairColor) || HAIRC[0]).c;
  const hairCat = () => 'hair_' + cur.gender, faceCat = () => 'face_' + cur.gender, bodyCat = () => 'body_' + cur.gender;

  async function apply() {
    if (!ready) return;
    const my = ++version;
    const sk = skinColor(), hc = hairColor();
    const jobs = [];
    // 頭
    jobs.push((async () => {
      const e = cur.head !== 'orig' && LIB.head && LIB.head[cur.head];
      const im = e ? await loadImg(e.file) : ORIG.head.im;
      return () => {
        const c = recolorSkin(im, sk, refL); P.head.im = c;
        if (!e) { restore('head'); P.head.im = c; return; }
        // 整張表同一比例；頭頂對齊原頭頭頂（支點仍在脖子）
        const w = c.width * e.scale * U, h = w * c.height / c.width;
        const top = ORIG.head.ay * META.headH * U;            // 原頭：支點到頭頂的距離
        P.head.w = w; P.head.ax = 0.5; P.head.ay = top / h;
      };
    })());
    // 髮型（原圖 or 造型庫）
    jobs.push((async () => {
      const e = cur.hair !== 'orig' && cur.hair !== 'bald' && LIB[hairCat()] && LIB[hairCat()][cur.hair];
      if (cur.hair === 'bald') return () => { P.hairFront.hidden = P.hairBack.hidden = true; };
      if (!e) {
        const [f, b] = [ORIG.hairFront.im, ORIG.hairBack.im];
        return () => { restore('hairFront'); restore('hairBack'); P.hairFront.hidden = P.hairBack.hidden = false;
          if (cur.hairColor !== 'black') { P.hairFront.im = recolorHair(f, hc, false); P.hairBack.im = recolorHair(b, hc, false); } };
      }
      const fi = e.front ? await loadImg(e.front.file) : null, bi = e.back ? await loadImg(e.back.file) : null;
      return () => {
        // 錨點＝頭殼弧圓心：原圖前髮放在 head (0,-232)、ay=0 → 圓心 head y＝-232 + refFront × 原前髮高
        const fy = -232 + META.refFront * 313 * U, by = -118 + (META.refBack - 0.5) * 366 * U;
        for (const [k, im, info, ay0] of [['hairFront', fi, e.front, fy], ['hairBack', bi, e.back, by]]) {
          const p = P[k]; p.hidden = !im;
          if (!im) continue;
          p.im = recolorHair(im, hc, true); p.w = info.w * info.scale * U;
          p.ax = info.ax; p.ay = info.ay; p.x = info.dx || 0; p.y = ay0 + (info.dy || 0);
        }
        P.hairBack.long = !!e.long;
      };
    })());
    // 五官
    jobs.push((async () => {
      const e = cur.face !== 'orig' && LIB[faceCat()] && LIB[faceCat()][cur.face];
      if (!e) return () => { restore('face'); restore('faceHurt'); P.face.mouth = P.faceHurt.mouth = null; };
      // 眼睛眉毛與嘴巴分開：眼睛照原本頂端對齊；嘴巴放到原臉嘴巴的位置、寬度貼近原臉
      const L = l => l.eyes || l.file;
      const [si, hi, sm, hm] = await Promise.all([loadImg(L(e.smug)), loadImg(L(e.hurt)),
        e.smug.mouth ? loadImg(e.smug.mouth.file) : null, e.hurt.mouth ? loadImg(e.hurt.mouth.file) : null]);
      return () => {
        for (const [k, im, info, mim, ref] of [['face', si, e.smug, sm, META.mouth && META.mouth.smug], ['faceHurt', hi, e.hurt, hm, META.mouth && META.mouth.hurt]]) {
          P[k].mouth = null;
          if (mim && ref) {
            const ow = ref.w * U, w0 = info.mouth.w * info.scale * U;
            const w = ow * Math.max(0.85, Math.min(1.15, w0 / ow));
            P[k].mouth = { im: mim, w, h: w * mim.naturalHeight / mim.naturalWidth, x: ref.cx * U, y: ref.cy * U };
          }
          // 眉毛（圖頂）對齊原臉的眉毛：原臉圖頂在支點上方 原高/2
          const p = P[k]; p.im = toCanvas(im); p.w = info.w * info.scale * U; p.ax = 0.5;
          const h = p.w * im.naturalHeight / im.naturalWidth, oTop = ORIG[k].ay * ORIG[k].im.naturalHeight * (230 / 377);
          p.ay = oTop / h;
        }
      };
    })());
    // 身體：上衣＋前領＋手＋腿（膚色換色也在這）；肩膀與脖子位置依上衣大小換算
    jobs.push((async () => {
      const e = cur.body !== 'orig' && LIB[bodyCat()] && LIB[bodyCat()][cur.body];
      const keys = ['torso', 'torsoCollar', 'armL', 'armR', 'legs'];
      const src = { torso: e && e.torso, torsoCollar: e && e.collar, armL: e && e.armL, armR: e && e.armR, legs: e && e.legs };
      const ims = {};
      for (const k of keys) ims[k] = e && src[k] ? await loadImg(src[k].file) : ORIG[k].im;
      return () => {
        for (const k of keys) {
          restore(k);
          const skin = k === 'armL' || k === 'armR' || k === 'legs';
          P[k].im = skin ? recolorSkin(ims[k], sk, refL) : ims[k];
          if (e && src[k]) P[k].w = ims[k].naturalWidth * (e.torso.scale || 1.32) * U;
        }
        if (!e) { P.torsoCollar.hidden = false; P.head.y = ORIG.head.y; DIM.top = DIM.bottom = 0; return; }
        P.torsoCollar.hidden = !e.collar;
        // 原上衣：寬 235px→143 單位、高 299px；肩 x=±68、y=-150；脖子 y=-166
        const tw = P.torso.w, th = tw * ims.torso.naturalHeight / ims.torso.naturalWidth;
        const ow = ORIG.torso.im.naturalWidth * U, oh = ORIG.torso.im.naturalHeight * U;
        const kx = tw / ow, ky = th / oh;
        P.armL.x = ORIG.armL.x * kx; P.armR.x = ORIG.armR.x * kx;
        P.armL.y = P.armR.y = -th + (ORIG.armL.y + oh) * ky;
        P.head.y = -th + (ORIG.head.y + oh) * ky;
        const lh = P.legs.w * ims.legs.naturalHeight / ims.legs.naturalWidth, olh = ORIG.legs.im.naturalHeight * U;
        DIM.top = th - oh; DIM.bottom = lh - olh;
      };
    })());
    // 配件圖
    for (const slot of SLOTS) {
      const id = cur[slot];
      if (id && LIB.acc && LIB.acc[id] && !accImgs[id]) jobs.push(loadImg(LIB.acc[id].file).then(im => () => { accImgs[id] = im; }));
    }
    const done = await Promise.all(jobs);
    if (my !== version) return;
    done.forEach(f => f && f());
    if (window.onAvatarChange) window.onAvatarChange();
    // 鬍子跟髮色
    for (const slot of ['beard']) { const id = cur[slot]; if (id && accImgs[id]) accImgs[id + '_c'] = recolorHair(accImgs[id], hc, true); }
  }
  function attach(parts) {
    P = parts;
    const wait = () => { if (Object.keys(P).every(k => !P[k].img || P[k].ok)) { snapshot(); ready = true; apply(); } else setTimeout(wait, 80); };
    wait();
  }
  function set(patch, save = true) {
    Object.assign(cur, patch);
    if (save) { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (_) {} }
    return apply();
  }

  // ---------- 繪製掛勾（game.js 每個部件畫之前／之後呼叫） ----------
  function drawAcc(ctx, id, under) {
    const pos = ACC_POS[id], im = accImgs[id + '_c'] || accImgs[id];
    if (!pos || !im || !!pos.under !== !!under) return;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, ay = pos.ay == null ? 0.5 : pos.ay;
    if (pos.pair) { // 成對的（耳環、雀斑）：圖切左右兩半，各放一邊
      const hw = iw / 2, w = pos.w, h = w * ih / hw;
      ctx.drawImage(im, 0, 0, hw, ih, -pos.pair - w / 2, pos.y - ay * h, w, h);
      ctx.drawImage(im, hw, 0, hw, ih, pos.pair - w / 2, pos.y - ay * h, w, h);
      return;
    }
    const w = pos.w, h = w * ih / iw;
    ctx.drawImage(im, (pos.x || 0) - w / 2, pos.y - ay * h, w, h);
  }
  function accIn(space) { return SLOTS.map(s => cur[s]).filter(id => id && ACC_POS[id] && ACC_POS[id].space === space); }
  function beforePart(key, ctx) {
    const p = P[key];
    if (p && p.hidden) return false;                        // 不畫
    if (key === 'hairBack' && !p.long) {                    // 短髮：後髮截在下巴以上
      ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 2000 + (CLIP_Y - p.y)); ctx.clip();
    }
    if (key === 'face' || key === 'faceHurt') for (const id of accIn('face')) drawAcc(ctx, id, true);
    return true;
  }
  function afterPart(key, ctx) {
    if ((key === 'face' || key === 'faceHurt') && P[key].mouth) {
      const m = P[key].mouth; ctx.drawImage(m.im, m.x - m.w / 2, m.y - m.h / 2, m.w, m.h);
    }
    if (key === 'face' || key === 'faceHurt') for (const id of accIn('face')) drawAcc(ctx, id, false);
    if (key === 'hairFront' || (key === 'hairBack' && P.hairFront.hidden)) {
      ctx.save(); ctx.translate(-P.hairFront.x, -P.hairFront.y); for (const id of accIn('head')) drawAcc(ctx, id, false); ctx.restore();
    }
    if (key === 'torsoCollar') for (const id of accIn('torso')) drawAcc(ctx, id, false);
  }
  // 腫包／暈眩星星要畫在「頭頂」：回傳 hairFront 座標到原頭頂的位移
  function headTopOffset() { return [-P.hairFront.x, -232 - P.hairFront.y]; }

  return {
    LIB, SKIN, HAIRC, ACC_POS, SLOTS, DEF,
    get: () => Object.assign({}, cur), set, attach, apply,
    beforePart, afterPart, headTopOffset,
    headW: () => cur.faceW || 1,
    dims: () => Object.assign({}, DIM),
    reset: () => set(Object.assign({}, DEF)),
    hairCat, faceCat, bodyCat,
  };
})();
