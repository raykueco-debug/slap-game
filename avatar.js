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
  const SLOTS = ['glasses', 'hat', 'ear', 'neck', 'mark'];
  // 鬍子拆四個部位：唇上／唇下／鰓邊／頷下，各自定位，嘴巴永遠在唇上與唇下之間
  const BEARD_SLOTS = ['beardUp', 'beardLow', 'beardSide', 'beardUnder'];
  const DEF = { prop: null, gender: 'm', head: 'orig', hair: 'orig', face: 'orig', body: 'orig', skin: 'orig', hairColor: 'black',
                glasses: null, beardUp: null, beardLow: null, beardSide: null, beardUnder: null, hat: null, ear: null, neck: null, mark: null, faceW: 1 };
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

  // 頭的幾何（head 座標）：頭頂、下巴、頭殼寬、中心 x；頭髮與五官都依「目前這顆頭」定位
  let G = null, G0 = null, SH = 1, SF = 1;
  function geoOf(headId) {
    const topU = ORIG.head.ay * META.headH * U, g0 = META.headGeo;
    const e = headId !== 'orig' && LIB.head && LIB.head[headId];
    const g = e && e.geo ? e.geo : g0, k = e && e.geo ? e.scale * U : U;
    const X = px => (px - g.W / 2) * k, Y = py => -topU + py * k;
    return { top: Y(g.top), chin: Y(g.chin), sw: g.sw * k, cx: X(g.cx), prof: (g.prof || []).map(r => [Y(r[0]), X(r[1]), X(r[2])]) };
  }
  const mapY = y => G.top + (y - G0.top) * SH;          // 原頭上的高度 → 目前這顆頭
  // 臉在某高度的左右邊界（head 座標，不含耳朵）；y0~y1 之間取最窄
  function faceSpan(y0, y1) {
    const pr = G.prof; if (!pr.length) return [-1e3, 1e3];
    let L = -1e9, R = 1e9;
    for (let i = 0; i <= 6; i++) {
      const y = y0 + (y1 - y0) * i / 6;
      if (y < pr[0][0] || y > pr[pr.length - 1][0]) return [0, 0];
      let j = 0; while (j < pr.length - 2 && pr[j + 1][0] < y) j++;
      const t = (y - pr[j][0]) / Math.max(1e-6, pr[j + 1][0] - pr[j][0]);
      L = Math.max(L, pr[j][1] + (pr[j + 1][1] - pr[j][1]) * t); R = Math.min(R, pr[j][2] + (pr[j + 1][2] - pr[j][2]) * t);
    }
    return [L, R];
  }
  async function apply() {
    if (!ready) return;
    const my = ++version;
    G0 = geoOf('orig'); G = geoOf(cur.head); SH = G.sw / G0.sw; SF = Math.max(0.8, Math.min(1.2, SH));
    const faceY = G.top + (ORIG.face.y - G0.top) / (G0.chin - G0.top) * (G.chin - G.top);
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
      if (cur.hair === 'bald') return () => { P.hairFront.hidden = P.hairBack.hidden = true; P.hairFront.hairline = null; };
      if (!e) {
        const [f, b] = [ORIG.hairFront.im, ORIG.hairBack.im];
        return () => { restore('hairFront'); restore('hairBack'); P.hairFront.hidden = P.hairBack.hidden = false;
          if (cur.hairColor !== 'black') { P.hairFront.im = recolorHair(f, hc, false); P.hairBack.im = recolorHair(b, hc, false); }
          for (const k of ['hairFront', 'hairBack']) { const p = P[k]; p.w = ORIG[k].im.naturalWidth * U * SH; p.x = G.cx; p.y = mapY(ORIG[k].y); }
          P.hairFront.hairline = META.hairlineFront; };
      }
      const fi = e.front ? await loadImg(e.front.file) : null, bi = e.back ? await loadImg(e.back.file) : null;
      return () => {
        // 錨點＝頭殼弧圓心：原圖前髮放在 head (0,-232)、ay=0 → 圓心 head y＝-232 + refFront × 原前髮高
        const fy = -232 + META.refFront * 313 * U, by = -118 + (META.refBack - 0.5) * 366 * U;
        for (const [k, im, info, ay0] of [['hairFront', fi, e.front, fy], ['hairBack', bi, e.back, by]]) {
          const p = P[k]; p.hidden = !im;
          if (!im) continue;
          p.im = recolorHair(im, hc, true); p.w = info.w * info.scale * U * SH;
          p.ax = info.ax; p.ay = info.ay; p.x = G.cx + (info.dx || 0) * SH; p.y = mapY(ay0 + (info.dy || 0));
        }
        P.hairBack.long = !!e.long;
        P.hairFront.hairline = e.front ? e.front.hairline : null;
      };
    })());
    // 五官：一律拆成「眼睛眉毛」＋「嘴巴」；眼睛區對齊定稿的眼睛區（寬度、中心），嘴巴放定稿嘴位
    //       再套照片比例（prop：眼睛高低／眼距／眼睛大小／嘴高低／嘴大小）
    jobs.push((async () => {
      const e = cur.face !== 'orig' && LIB[faceCat()] && LIB[faceCat()][cur.face];
      const F = META.face, pr = Object.assign({ eyeDy: 0, eyeGap: 0, eyeScale: 1, mouthDy: 0, mouthScale: 1 }, cur.prop || {});
      const srcOf = layer => e ? { eyes: e[layer].eyes || e[layer].file, eb: e[layer].eyebox, mouth: e[layer].mouth }
                               : { eyes: F[layer].eyes, eb: F[layer].eyebox, mouth: Object.assign({ file: F[layer].mouth }, F[layer].m) };
      const S = { smug: srcOf('smug'), hurt: srcOf('hurt') };
      const ims = {};
      for (const l of ['smug', 'hurt']) {
        ims[l] = await loadImg(S[l].eyes);
        ims[l + 'M'] = S[l].mouth && S[l].mouth.file ? await loadImg(S[l].mouth.file) : null;
      }
      return () => {
        const HL = G.chin - G.top;                                  // 頭長（頭頂→下巴）
        // 髮際線（head 座標）：前髮中線最低處；光頭＝頭頂往下一點
        const hf = P.hairFront;
        let yH = G.top + 0.12 * HL;
        if (!hf.hidden && hf.hairline != null && hf.im) { const h = hf.w * hf.im.naturalHeight / hf.im.naturalWidth; yH = hf.y + (hf.hairline - hf.ay) * h; }
        const fore = pr.forehead == null ? 0.2 : pr.forehead;      // 額頭佔「髮際線→下巴」的比例（照片量的，沒有就用預設）
        for (const [k, l] of [['face', 'smug'], ['faceHurt', 'hurt']]) {
          const ref = F[l], s = S[l], eb = s.eb, im = ims[l], p = P[k];
          // 目標眼睛區（face 座標）
          // 定稿位置（face 座標）：眉頂、嘴中心
          const ebH = ref.eyebox.h * U * SF, ebTop0 = ref.eyebox.cy * U * SF - ebH / 2, my0 = ref.m.cy * U * SF;
          // 露額頭時：眉頂移到「髮際線＋額頭」，五官整組放大去填滿到嘴（最多 1.3 倍）；有瀏海就維持定稿
          const yHl = yH - faceY, chinL = G.chin - faceY;
          const ebTop = Math.min(ebTop0, yHl + fore * (chinL - yHl));
          const sv = Math.max(1, Math.min(1.3, (my0 - ebTop) / (my0 - ebTop0)));
          const Tw = ref.eyebox.w * U * SF * sv * pr.eyeScale, Tx = ref.eyebox.cx * U * SF;
          let Ty = ebTop + ebH * sv / 2 + pr.eyeDy * HL;
          let kk = Tw / eb.w;
          // ---- 邊界：眼睛區（含眼距）不能超出臉輪廓 ----
          let g = Math.round(pr.eyeGap * eb.w * 0.5);
          let Txx = Tx;
          for (let it = 0; it < 3; it++) {
            const hh = eb.h * kk, vw = (eb.w + 2 * g) * kk;
            const [L, R] = faceSpan(faceY + Ty - hh * 0.35, faceY + Ty + hh / 2);   // 眉毛上緣可以碰到頭髮，從眼睛那幾排開始算
            const allow = (R - L) * 0.9;
            if (vw > allow && allow > 0) { const f = allow / vw; kk *= f; if (g > 0) g = Math.round(g * f); }
            const half = (eb.w + 2 * g) * kk / 2, mid = (L + R) / 2 - G.cx;
            Txx = Math.max(mid - (R - L) * 0.45 + half, Math.min(mid + (R - L) * 0.45 - half, Tx));
          }
          // 眼距：以眼睛區中線把圖切兩半，左右各往外（或往內）移
          const W0 = im.naturalWidth, H0 = im.naturalHeight, off = Math.max(0, g);
          const c = document.createElement('canvas'); c.width = W0 + 2 * off; c.height = H0;
          const cx = c.getContext('2d'), xs = Math.round(W0 / 2 + eb.cx);
          cx.drawImage(im, 0, 0, xs, H0, off - g, 0, xs, H0);
          cx.drawImage(im, xs, 0, W0 - xs, H0, off + g + xs, 0, W0 - xs, H0);
          c.naturalWidth = c.width; c.naturalHeight = c.height;
          const pcx = off + W0 / 2 + eb.cx, pcy = H0 / 2 + eb.cy;
          p.im = c; p.w = c.width * kk; p.ax = (pcx * kk - Txx) / p.w; p.ay = (pcy * kk - Ty) / (H0 * kk);
          const eyeBottom = Ty + eb.h * kk / 2;                      // face 座標
          p.eyeBottom = eyeBottom; p.eyeMid = Ty + eb.h * kk * 0.22;   // 眼睛中線略下（眉毛在眼睛區上方）
          p.x = G.cx; p.y = faceY;
          // 嘴巴：定稿嘴位；大小＝定稿嘴寬 ×（此款嘴/眼睛區 比上 定稿嘴/眼睛區，限 0.85~1.15）× 照片嘴大小
          p.mouth = null;
          const mim = ims[l + 'M'];
          if (mim && s.mouth) {
            const rel = (s.mouth.w / eb.w) / (ref.m.w / ref.eyebox.w);
            let w = ref.m.w * U * SF * Math.max(0.85, Math.min(1.15, rel)) * pr.mouthScale * (1 + (sv - 1) * 0.5);
            const ar = mim.naturalHeight / mim.naturalWidth;
            let my = ref.m.cy * U * SF + pr.mouthDy * HL, mx = ref.m.cx * U * SF;
            // ---- 邊界：嘴巴不低於下巴、不壓到眼睛、不超出臉寬 ----
            const chinL = G.chin - faceY - HL * 0.04;
            for (let it = 0; it < 3; it++) {
              const h = w * ar;
              if (my + h / 2 > chinL) my = chinL - h / 2;
              if (my - h / 2 < eyeBottom + 2) my = Math.min(chinL - h / 2, eyeBottom + 2 + h / 2);
              const [L, R] = faceSpan(faceY + my - h / 2, faceY + my + h / 2);
              const allow = (R - L) * 0.75;
              if (w > allow && allow > 0) w = allow;
              const mid = (L + R) / 2 - G.cx;
              mx = Math.max(mid - (R - L) * 0.4 + w / 2, Math.min(mid + (R - L) * 0.4 - w / 2, mx));
            }
            p.mouth = { im: mim, w, h: w * ar, x: mx, y: my };
          }
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
    for (const slot of BEARD_SLOTS) {
      const id = cur[slot];
      if (id && LIB.beard && LIB.beard[id] && !accImgs[id]) jobs.push(loadImg(LIB.beard[id].file).then(im => () => { accImgs[id] = im; }));
    }
    const done = await Promise.all(jobs);
    if (my !== version) return;
    done.forEach(f => f && f());
    if (window.onAvatarChange) window.onAvatarChange();
    // 鬍子跟髮色
    for (const slot of BEARD_SLOTS) { const id = cur[slot]; if (id && accImgs[id]) accImgs[id + '_c'] = recolorHair(accImgs[id], hc, true); }
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
  // 鬍子：以嘴巴中心或下巴為基準（face 座標），寬度跟著五官縮放；畫在五官之下
  // 鬍子四部位（face 座標，畫在五官之下）：同一張表同比例（k＝每 px 幾單位），跟著五官縮放
  const BEARD_AY = { up_fumanchu: 0.22, up_horseshoe: 0.3 };      // 唇上：圖片哪個高度壓在嘴巴上緣（預設＝底部）
  function drawBeard(ctx, key) {
    if (!G) return;
    const m = P[key].mouth; if (!m) return;
    const B = id => { const im = accImgs[id + '_c'] || accImgs[id], e = LIB.beard && LIB.beard[id]; return im && e ? { im, k: e.k * SF, W: im.naturalWidth || im.width, H: im.naturalHeight || im.height } : null; };
    const mTop = m.y - m.h / 2, mBot = m.y + m.h / 2, chinL = G.chin - P[key].y;
    // 頷下：頂部塞進下巴下面
    let b = cur.beardUnder && B(cur.beardUnder);
    if (b) { const w = b.W * b.k, h = b.H * b.k; ctx.drawImage(b.im, -w / 2 + (m.x * 0.3), chinL - h * 0.12, w, h); }
    // 鰓邊：左右各半，外緣貼臉輪廓；從顴骨高度到下巴
    b = cur.beardSide && B(cur.beardSide);
    if (b) {
      const yTop = (cur.beardSide === 'side_sideburn' || cur.beardSide === 'side_mutton') ? mTop - (chinL - mTop) * 1.6 : mTop - (chinL - mTop) * 0.9;
      const yBot = chinL + 4 * SF, hh = yBot - yTop, half = b.W / 2;
      const ymid = yTop + hh * 0.45;
      const [L, R] = faceSpan(P[key].y + ymid, P[key].y + ymid);
      const sc = hh / b.H, w = half * sc;
      const xl = L - P[key].x, xr = R - P[key].x;
      ctx.drawImage(b.im, 0, 0, half, b.H, xl - w * 0.12, yTop, w, hh);
      ctx.drawImage(b.im, half, 0, half, b.H, xr - w * 0.88, yTop, w, hh);
    }
    // 唇下：頂部接嘴巴下緣
    b = cur.beardLow && B(cur.beardLow);
    if (b) { const w = b.W * b.k, h = b.H * b.k; ctx.drawImage(b.im, m.x - w / 2, mBot - h * 0.06, w, h); }
    // 唇上：底部壓嘴巴上緣
    b = cur.beardUp && B(cur.beardUp);
    if (b) {
      // 唇上空間＝眼睛下緣到嘴巴上緣；放不下先壓扁高度（最多到 60%），還不夠再整體縮小
      let w = b.W * b.k, h = b.H * b.k;
      const ay = BEARD_AY[cur.beardUp] == null ? 0.92 : BEARD_AY[cur.beardUp];
      // 八字鬍底部壓進嘴巴上緣 35%（嘴巴畫在鬍子上面）；頂部不超過眼睛中線略下
      const base = mTop + m.h * 0.35;
      const room = Math.max(6, base - (P[key].eyeMid == null ? base - 30 : P[key].eyeMid));
      if (ay * h > room) { const sq = Math.max(0.6, room / (ay * h)); h *= sq; if (ay * h > room) { const f = room / (ay * h); h *= f; w *= f; } }
      ctx.drawImage(b.im, m.x - w / 2, base - ay * h, w, h);
    }
  }
  function drawAcc(ctx, id, under) {
    const pos = ACC_POS[id], im = accImgs[id + '_c'] || accImgs[id];
    if (!pos || !im || !G || !!pos.under !== !!under) return;
    ctx.save();
    if (pos.space === 'face') ctx.scale(SF, SF);                                   // 跟著五官縮放
    if (pos.space === 'head') { ctx.translate(G.cx, G.top - G0.top * SH); ctx.scale(SH, SH); }  // 跟著頭縮放
    drawAccRaw(ctx, pos, im);
    ctx.restore();
  }
  function drawAccRaw(ctx, pos, im) {
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
    if (key === 'hairBack' && !p.long && G) {                    // 短髮：後髮截在下巴以上
      const clipY = G.chin - (G0.chin - CLIP_Y) * SH;
      ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 2000 + (clipY - p.y)); ctx.clip();
    }
    if (key === 'face' || key === 'faceHurt') { drawBeard(ctx, key); for (const id of accIn('face')) drawAcc(ctx, id, true); }
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
  function headTopOffset() { return G ? [G.cx - P.hairFront.x, mapY(-232) - P.hairFront.y] : [-P.hairFront.x, -232 - P.hairFront.y]; }

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
