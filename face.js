// 臉部辨識＋自動配對：照片只在手機瀏覽器裡分析（MediaPipe），不上傳、不保存
// 只回傳「選哪些造型」，照片分析完就丟掉
window.FACEMATCH = (() => {
  'use strict';
  const VER = '0.10.14';
  const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const M_FACE = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const M_SEG = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
  let tasks = null;
  async function load(onStatus) {
    if (tasks) return tasks;
    onStatus && onStatus('第一次使用：下載辨識模型中（只下載模型，照片不會上傳）…');
    const v = await import(`${CDN}/vision_bundle.mjs`);
    const fs = await v.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const mk = async (Cls, opt) => {
      try { return await Cls.createFromOptions(fs, Object.assign({}, opt, { baseOptions: Object.assign({}, opt.baseOptions, { delegate: 'GPU' }) })); }
      catch (_) { return await Cls.createFromOptions(fs, opt); }
    };
    const [face, seg] = await Promise.all([
      mk(v.FaceLandmarker, { baseOptions: { modelAssetPath: M_FACE }, runningMode: 'IMAGE', numFaces: 1 }),
      mk(v.ImageSegmenter, { baseOptions: { modelAssetPath: M_SEG }, runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false }),
    ]);
    tasks = { face, seg };
    return tasks;
  }

  // ---------- 造型特徵標籤（自動配對用） ----------
  // fr＝額頭被瀏海蓋住的比例、len＝長度(0 短 / 1 及肩 / 2 長)、vol＝頭頂蓬度、wid＝頭髮寬度、asym＝左右不對稱、bald＝禿
  const HAIR_TAG = {
    hair_m: {
      bangs: { fr: 1, len: 0, vol: .3, wid: .3 }, crop: { fr: .6, len: 0, vol: .45, wid: .35 }, side: { fr: .5, len: 0, vol: .35, asym: .8 },
      middle: { fr: .4, len: .3, vol: .35, asym: 0 }, spiky: { fr: .45, len: 0, vol: .85, wid: .4 }, buzz: { fr: 0, len: 0, vol: .05, wid: .1 },
      curly: { fr: .6, len: 0, vol: .6, wid: .5 }, slick: { fr: 0, len: 0, vol: .4, wid: .3 }, comma: { fr: .65, len: 0, vol: .35, asym: .6 },
      undercut: { fr: .35, len: 0, vol: .6, wid: .15 }, mohawk: { fr: 0, len: 0, vol: 1, wid: 0 }, manbun: { fr: .1, len: .6, vol: .7, wid: .25 },
      medium: { fr: .5, len: 1, vol: .35, wid: .6 }, afro: { fr: .6, len: .4, vol: 1, wid: 1 }, dreads: { fr: .5, len: 1.4, vol: .5, wid: .7 },
      balding: { fr: 0, len: 0, vol: 0, wid: .3, bald: .7 }, business: { fr: .2, len: 0, vol: .35, asym: .8 }, pompadour: { fr: 0, len: 0, vol: .95, wid: .35 },
      bowl: { fr: 1, len: .2, vol: .35, wid: .45 }, wolf: { fr: .6, len: 1, vol: .5, wid: .55 }, wavy: { fr: .5, len: 1, vol: .45, wid: .65 },
      cornrow: { fr: 0, len: 0, vol: .1, wid: .1 }, fade: { fr: .2, len: 0, vol: .25, wid: .15 }, perm: { fr: .6, len: 0, vol: .7, wid: .6 },
    },
    hair_f: {
      longbangs: { fr: 1, len: 2, vol: .3, wid: .6 }, hime: { fr: 1, len: 2, vol: .3, wid: .7 }, bob: { fr: .7, len: .6, vol: .35, wid: .6 },
      ponyhigh: { fr: .4, len: 1.2, vol: .6, wid: .4 }, twintail: { fr: .6, len: 1.2, vol: .4, wid: .9 }, bun: { fr: .2, len: 0, vol: .8, wid: .3 },
      wavylong: { fr: .3, len: 2, vol: .45, wid: .9 }, pixie: { fr: .5, len: 0, vol: .35, wid: .35 },
      ponylow: { fr: .3, len: 1.3, vol: .3, wid: .4 }, spacebuns: { fr: .5, len: 0, vol: .8, wid: .7 }, sidepony: { fr: .4, len: 1.2, vol: .4, asym: .9 },
      braid: { fr: .4, len: 1.8, vol: .3, wid: .4 }, twinbraid: { fr: .6, len: 1.8, vol: .3, wid: .6 }, flip: { fr: .5, len: .9, vol: .4, wid: .8 },
      frenchcurl: { fr: .8, len: 1.8, vol: .45, wid: .8 }, halfup: { fr: .3, len: 1.8, vol: .45, wid: .7 },
      shoulder: { fr: .2, len: 1, vol: .35, wid: .6, asym: 0 }, curtain: { fr: .45, len: 1.8, vol: .35, wid: .65 }, airy: { fr: .75, len: .3, vol: .35, wid: .5 },
      wolf: { fr: .6, len: 1, vol: .5, wid: .6 }, fro: { fr: .6, len: .6, vol: 1, wid: 1 }, verylong: { fr: .4, len: 2.4, vol: .3, wid: .6 },
      drill: { fr: .6, len: 1.8, vol: .45, wid: .9 }, shortcurl: { fr: .55, len: .2, vol: .55, wid: .55 },
    },
  };
  // ar＝眼睛開合（高/寬）、tilt＝眼尾上揚(+)/下垂(-)、size＝眼睛大小（眼寬/臉寬）
  const FACE_TAG = {
    face_m: {
      narrow: { ar: .2, tilt: 0, size: .5 }, round: { ar: .42, tilt: 0, size: .65 }, droopy: { ar: .3, tilt: -1, size: .55 },
      sharp: { ar: .27, tilt: 1, size: .55 }, squint: { ar: .12, tilt: 0, size: .5 }, monolid: { ar: .22, tilt: .2, size: .4 },
      bold: { ar: .38, tilt: 0, size: .65, brow: 1 }, sanpaku: { ar: .3, tilt: .3, size: .5, brow: .7 },
      dot: { ar: .3, tilt: 0, size: .3 }, deadfish: { ar: .18, tilt: -.4, size: .5 }, uneven: { ar: .3, tilt: 0, size: .55, uneven: 1 },
      hawk: { ar: .25, tilt: .9, size: .55, brow: .8 }, double: { ar: .42, tilt: 0, size: .7 }, fox: { ar: .2, tilt: 1, size: .55 },
      bucktooth: { ar: .3, tilt: 0, size: .55, mouth: 1 }, lips: { ar: .3, tilt: 0, size: .55, lips: 1 },
    },
    face_f: {
      lashes: { ar: .42, tilt: 0, size: .7 }, cat: { ar: .3, tilt: 1, size: .6 }, droopy: { ar: .32, tilt: -1, size: .6 },
      squint: { ar: .14, tilt: 0, size: .55 }, monolid: { ar: .22, tilt: .2, size: .45 }, round: { ar: .45, tilt: 0, size: .65 },
      makeup: { ar: .32, tilt: .6, size: .6 }, almond: { ar: .3, tilt: .2, size: .6 },
      dot: { ar: .3, tilt: 0, size: .3 }, deadfish: { ar: .18, tilt: -.4, size: .55 }, fox: { ar: .2, tilt: 1, size: .55 },
      star: { ar: .45, tilt: 0, size: .75 }, lips: { ar: .3, tilt: 0, size: .6, lips: 1 }, cherry: { ar: .35, tilt: 0, size: .6, lips: -1 },
      lashesheavy: { ar: .4, tilt: .3, size: .7 }, dimple: { ar: .25, tilt: 0, size: .6 },
    },
  };
  // wr＝臉寬/臉長、jaw＝下顎寬/顴骨寬
  // 臉型（只用大臉的新頭型）：wr＝臉寬/臉長、jaw＝下顎寬/顴骨寬、full＝飽滿度（胖瘦）
  const HEAD_TAG = {
    m_chubby: { wr: .86, jaw: .85, full: .38 }, m_fat: { wr: .88, jaw: .9, full: .5 }, m_jowl: { wr: .86, jaw: .93, full: .44 },
    m_fatsquare: { wr: .86, jaw: .95, full: .3 }, m_baby: { wr: .84, jaw: .82, full: .24 }, m_oval2: { wr: .79, jaw: .8, full: 0 },
    m_narrow: { wr: .72, jaw: .78, full: -.15 }, m_bony: { wr: .75, jaw: .76, full: -.22 }, m_strongjaw: { wr: .8, jaw: .9, full: .05 },
    m_triangle: { wr: .78, jaw: .93, full: .12 }, m_invtri: { wr: .78, jaw: .7, full: -.1 }, m_diamond: { wr: .77, jaw: .74, full: -.05 },
    m_rect: { wr: .74, jaw: .86, full: -.05 }, m_egg: { wr: .8, jaw: .76, full: .04 }, m_puffy: { wr: .83, jaw: .78, full: .2 },
    m_flat: { wr: .9, jaw: .88, full: .22 },
    f_chubby2: { wr: .88, jaw: .85, full: .38 }, f_plump: { wr: .88, jaw: .88, full: .48 }, f_baby: { wr: .86, jaw: .8, full: .26 },
    f_wide2: { wr: .92, jaw: .84, full: .3 }, f_oval2: { wr: .8, jaw: .78, full: 0 }, f_long2: { wr: .73, jaw: .78, full: -.12 },
    f_v2: { wr: .8, jaw: .68, full: -.12 }, f_heart2: { wr: .82, jaw: .7, full: -.05 }, f_square: { wr: .82, jaw: .9, full: .08 },
    f_diamond: { wr: .78, jaw: .74, full: -.06 }, f_pear: { wr: .8, jaw: .92, full: .15 }, f_egg: { wr: .8, jaw: .75, full: .03 },
    f_puffy: { wr: .84, jaw: .74, full: .2 }, f_thin: { wr: .75, jaw: .76, full: -.22 }, f_short: { wr: .95, jaw: .86, full: .2 },
    f_point: { wr: .83, jaw: .7, full: .1 },
  };

  // ---------- 量測 ----------
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  // 特殊造型不參加自動配對（只能手動選）
  const NO_AUTO = new Set(['cornrow', 'dreads', 'mohawk', 'manbun', 'balding', 'spacebuns', 'drill', 'uneven', 'bucktooth', 'dot', 'star']);
  // 鼻子：w＝鼻翼寬、l＝鼻長（-1 小／短 ~ 1 大／長）；歪鼻、紅鼻頭只給手動挑
  const NOSE_TAG = {
    dot: { w: -1, l: -1 }, hook: { w: -.6, l: -.2 }, tri: { w: -.3, l: -.6 }, nostril: { w: -.5, l: -1 },
    button: { w: -.1, l: -.4 }, potato: { w: .6, l: .3 }, pointy: { w: -.5, l: .7 }, eagle: { w: .1, l: .9 },
    flat: { w: .9, l: -.6 }, snub: { w: .4, l: -.6 }, flared: { w: 1, l: 0 }, long: { w: -.8, l: 1 },
    anime: { w: -.7, l: .2 }, droopy: { w: .9, l: .9 },
  };
  function nearest(table, feat, W) {
    let best = null, bd = 1e9;
    for (const id in table) {
      if (NO_AUTO.has(id)) continue;
      const t = table[id]; let d = 0;
      for (const k in W) { const a = t[k] == null ? 0 : t[k], b = feat[k] == null ? 0 : feat[k]; d += W[k] * (a - b) ** 2; }
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }
  function colorNearest(list, rgb, pickL) {
    let best = list[0].id, bd = 1e9;
    for (const s of list) {
      if (!s.c) continue;
      const c = [1, 3, 5].map(i => parseInt(s.c.slice(i, i + 2), 16));
      const d = pickL ? Math.abs(lum(...c) - lum(...rgb)) * 2 + Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]) * 0.3
                      : Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]);
      if (d < bd) { bd = d; best = s.id; }
    }
    return best;
  }

  // 膚色：只看亮度分級（手機照片常偏暗、偏暖，色相不可靠），門檻往暗的方向放寬
  function skinPick(rel) {
    return rel > 0.86 ? 'fair' : rel > 0.74 ? 'light' : rel > 0.66 ? 'tan' : rel > 0.5 ? 'brown' : 'dark';
  }
  // 髮色：灰階（飽和度低）只看亮度 → 黑／灰白；有顏色才比色相
  function hairColorPick(rgb) {
    const [r, g, b] = rgb.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    if (sat < 0.18) return l < 0.55 ? 'black' : 'gray';
    return colorNearest(window.AVATAR.HAIRC, rgb, false);
  }
  async function analyze(file, gender, onStatus) {
    const t = await load(onStatus);
    onStatus && onStatus('分析中…（照片只在這支手機上處理）');
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    // 第一階段：在較大解析度找臉（照片很小就先放大兩倍）
    const findFace = (scale) => {
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const r = t.face.detect(c);
      return r.faceLandmarks && r.faceLandmarks.length ? { lm: r.faceLandmarks[0], c } : null;
    };
    // 在原圖的某個區域裡找臉：裁出來放大到 1024 再偵測，特徵點換回原圖座標
    const findIn = (rx, ry, rw, rh) => {
      const s2 = 1024 / Math.max(rw, rh), c = document.createElement('canvas');
      c.width = Math.round(rw * s2); c.height = Math.round(rh * s2);
      c.getContext('2d').drawImage(bmp, rx, ry, rw, rh, 0, 0, c.width, c.height);
      const r = t.face.detect(c);
      if (!(r.faceLandmarks && r.faceLandmarks.length)) return null;
      return { lm: r.faceLandmarks[0].map(p => ({ x: (rx + p.x * rw) / bmp.width, y: (ry + p.y * rh) / bmp.height })) };
    };
    const big = Math.max(bmp.width, bmp.height);
    let found = findFace(Math.min(1, 1280 / big));
    if (!found && big < 1000) found = findFace(Math.min(3, 1600 / big));
    if (!found) {
      // 臉太小：先用分割模型找「臉部皮膚」的範圍，往外擴大後裁切放大再找
      const c = document.createElement('canvas'), s1 = Math.min(1, 1024 / big);
      c.width = Math.round(bmp.width * s1); c.height = Math.round(bmp.height * s1);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const sg = t.seg.segment(c), mk = sg.categoryMask.getAsUint8Array(), mw0 = sg.categoryMask.width, mh0 = sg.categoryMask.height;
      let ax0 = 1e9, ax1 = -1, ay0 = 1e9, ay1 = -1;
      for (let y = 0; y < mh0; y++) for (let x = 0; x < mw0; x++) if (mk[y * mw0 + x] === 3) { if (x < ax0) ax0 = x; if (x > ax1) ax1 = x; if (y < ay0) ay0 = y; if (y > ay1) ay1 = y; }
      sg.categoryMask.close && sg.categoryMask.close();
      if (ax1 > 0) {
        const kx = bmp.width / mw0, ky = bmp.height / mh0, fw = (ax1 - ax0 + 1) * kx, fh = (ay1 - ay0 + 1) * ky, side = Math.max(fw, fh) * 2.2;
        const mx = (ax0 + ax1) / 2 * kx, my = (ay0 + ay1) / 2 * ky;
        const rx = Math.max(0, mx - side / 2), ry = Math.max(0, my - side / 2);
        found = findIn(rx, ry, Math.min(bmp.width - rx, side), Math.min(bmp.height - ry, side));
      }
    }
    if (!found) {
      // 還是找不到：把照片切成重疊的小塊，一塊一塊放大來找
      for (const n of [2, 3]) {
        const tw = bmp.width / n * 1.5, th = bmp.height / n * 1.5;
        for (let i = 0; i < n && !found; i++) for (let j = 0; j < n && !found; j++) {
          const rx = Math.min(bmp.width - tw, Math.max(0, (j + 0.5) * bmp.width / n - tw / 2));
          const ry = Math.min(bmp.height - th, Math.max(0, (i + 0.5) * bmp.height / n - th / 2));
          found = findIn(Math.max(0, rx), Math.max(0, ry), Math.min(tw, bmp.width), Math.min(th, bmp.height));
        }
        if (found) break;
      }
    }
    if (!found) { bmp.close && bmp.close(); throw new Error('找不到臉，換一張正面、清楚的照片試試'); }
    // 第二階段：以臉為中心裁切（往外留頭髮、鬍子的範圍），放大到 640 再完整分析
    const fx = found.lm.map(p => p.x * bmp.width), fy = found.lm.map(p => p.y * bmp.height);
    const x0 = Math.min(...fx), x1 = Math.max(...fx), y0 = Math.min(...fy), y1 = Math.max(...fy);
    const fs = Math.max(x1 - x0, y1 - y0), ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2;
    const half = fs * 1.6;
    const sx = Math.max(0, ccx - half), sy = Math.max(0, ccy - half * 1.05), sw = Math.min(bmp.width - sx, half * 2), sh = Math.min(bmp.height - sy, half * 2.1);
    const sc = 640 / Math.max(sw, sh);
    const cv = document.createElement('canvas'); cv.width = Math.round(sw * sc); cv.height = Math.round(sh * sc);
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high';
    cx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
    const W = cv.width, H = cv.height;
    const fr = t.face.detect(cv);
    if (!fr.faceLandmarks || !fr.faceLandmarks.length) throw new Error('找不到臉，換一張正面、清楚的照片試試');
    const Lm = fr.faceLandmarks[0].map(p => ({ x: p.x * W, y: p.y * H }));
    const seg = t.seg.segment(cv);
    const mask = seg.categoryMask.getAsUint8Array(), mw = seg.categoryMask.width, mh = seg.categoryMask.height;
    const cat = (x, y) => mask[Math.min(mh - 1, Math.max(0, Math.round(y * mh / H))) * mw + Math.min(mw - 1, Math.max(0, Math.round(x * mw / W)))];
    const px = cx.getImageData(0, 0, W, H).data;
    const at = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    seg.categoryMask.close && seg.categoryMask.close();

    const d = (a, b) => Math.hypot(Lm[a].x - Lm[b].x, Lm[a].y - Lm[b].y);
    const faceW = d(234, 454), faceH = d(10, 152), top = Lm[10].y, chin = Lm[152].y;
    const fx0 = Math.min(Lm[234].x, Lm[454].x), fx1 = Math.max(Lm[234].x, Lm[454].x);

    // 膚色：臉部皮膚區平均（排除太亮太暗）
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let y = top; y < chin; y += 2) for (let x = fx0; x < fx1; x += 2) {
      if (cat(x, y) !== 3) continue; const c = at(x, y), l = lum(...c); if (l < 40 || l > 240) continue;
      sr += c[0]; sg += c[1]; sb += c[2]; sn++;
    }
    const skinRGB = sn ? [sr / sn, sg / sn, sb / sn] : at(Lm[50].x, Lm[50].y);
    // 照片亮部基準（第 95 百分位亮度）：用來校正曝光，膚色看「相對亮度」
    const hist = new Array(256).fill(0); let tot = 0;
    for (let i = 0; i < px.length; i += 16) { hist[Math.min(255, lum(px[i], px[i + 1], px[i + 2]) | 0)]++; tot++; }
    let acc95 = 0, p95 = 255; for (let v = 0; v < 256; v++) { acc95 += hist[v]; if (acc95 >= tot * 0.95) { p95 = v; break; } }
    const skinRel = lum(...skinRGB) / Math.max(120, p95);

    // 頭髮：遮罩統計
    const hairPx = [];
    let hn = 0, hx0 = 1e9, hx1 = -1, hy0 = 1e9, hy1 = -1;
    const ext = faceH * 1.6;
    // 眉毛以下、臉寬範圍內的毛髮＝鬍子（長鬍子會垂到下巴以下），不算頭髮
    const browY0 = (Lm[105].y + Lm[334].y) / 2;
    for (let y = Math.max(0, top - ext); y < Math.min(H, chin + ext); y += 2) for (let x = Math.max(0, fx0 - faceW); x < Math.min(W, fx1 + faceW); x += 2) {
      if (cat(x, y) !== 1) continue;
      if (y > browY0 && x > fx0 && x < fx1) continue;
      hn++;
      const c = at(x, y); hairPx.push(c);
      if (y < browY0) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }   // 頭髮寬度只看眉毛以上（排除比臉寬的鬍子）
      if (y < hy0) hy0 = y; if (y > hy1) hy1 = y;
    }
    const hairArea = hn * 4 / (faceW * faceH);
    // 頭髮長度：臉兩側（臉寬外 25% 內）從眼睛到下巴這段，有頭髮的排數比例；有連下來才看下巴以下
    const eyeY0 = (Lm[159].y + Lm[386].y) / 2;
    // 臉邊往外隔 8% 再看到 30%：避開緊貼下顎的鬍子邊；任一側有就算（頭髮可能撥到一邊）
    // 只承認「跟頭頂頭髮相連」的頭髮：從額頭上方往外長出相連區域（排除背景被誤判成頭髮的零星區塊）
    const conn = new Uint8Array(mw * mh);
    {
      const q = [];
      const seedY = Math.max(0, Math.round((top - faceH * 0.15) * mh / H));
      for (let yy = Math.max(0, seedY - Math.round(faceH * 0.3 * mh / H)); yy <= seedY; yy++)
        for (let xx = Math.round(fx0 * mw / W); xx <= Math.round(fx1 * mw / W); xx++)
          if (xx >= 0 && xx < mw && mask[yy * mw + xx] === 1 && !conn[yy * mw + xx]) { conn[yy * mw + xx] = 1; q.push(yy * mw + xx); }
      while (q.length) {
        const i = q.pop(), xx = i % mw, yy = (i / mw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = xx + dx, ny = yy + dy;
          if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
          const j = ny * mw + nx;
          if (!conn[j] && mask[j] === 1) { conn[j] = 1; q.push(j); }
        }
      }
    }
    const hairC = (x, y) => { const xx = Math.round(x * mw / W), yy = Math.round(y * mh / H); return xx >= 0 && yy >= 0 && xx < mw && yy < mh && conn[yy * mw + xx] === 1; };
    const sideHair = y => { let L = false, R = false;
      for (let x = fx0 - faceW * 0.3; x < fx0 - faceW * 0.08; x += 2) if (hairC(x, y)) { L = true; break; }
      for (let x = fx1 + faceW * 0.08; x < fx1 + faceW * 0.3; x += 2) if (hairC(x, y)) { R = true; break; }
      return L || R; };
    let sdc = 0, sdn = 0; for (let y = Lm[1].y; y < Math.max(Lm[61].y, Lm[291].y); y += 2) /* 鼻尖→嘴角：鬢角到不了、長髮會經過 */ { sdn++; if (sideHair(y)) sdc++; }
    const sideCov = sdn ? sdc / sdn : 0;
    let below = 0, bn = 0; for (let y = chin; y < Math.min(H, chin + faceH * 0.9); y += 3) { bn++; if (sideHair(y)) below++; }
    const belowCov = bn ? below / bn : 0;
    // 眉毛以上的頭髮量（光頭判斷用）
    let topHair = 0; for (let y = Math.max(0, top - faceH * 0.6); y < browY0; y += 2) for (let x = fx0; x < fx1; x += 2) if (cat(x, y) === 1) topHair++;
    const topArea = topHair * 4 / (faceW * faceH);
    // 髮色：取偏暗的 15%~55% 段平均（避免邊緣混到背景、高光）
    hairPx.sort((a, b) => lum(...a) - lum(...b));
    const seg2 = hairPx.slice(Math.floor(hairPx.length * 0.15), Math.max(1, Math.floor(hairPx.length * 0.55)));
    const hairRGB = seg2.length ? [0, 1, 2].map(i => seg2.reduce((s, c) => s + c[i], 0) / seg2.length) : [40, 35, 35];
    // 額頭：眉毛到 landmark 10 之間被頭髮蓋住的比例；左右分開算
    const browY = (Lm[105].y + Lm[334].y) / 2, foreTop = top - faceH * 0.08;
    let cl = 0, nl = 0, cr = 0, nr = 0;
    for (let y = foreTop; y < browY; y += 2) for (let x = Lm[70].x; x < Lm[300].x; x += 2) {
      const h = cat(x, y) === 1 ? 1 : 0;
      if (x < Lm[9].x) { cl += h; nl++; } else { cr += h; nr++; }
    }
    const frL = nl ? cl / nl : 0, frR = nr ? cr / nr : 0;
    const feat = {
      fr: (frL + frR) / 2,
      asym: Math.min(1, Math.abs(frL - frR) * 2),
      // 臉側有頭髮但下巴以下沒有＝鮑伯長度；下巴以下也有才算及肩以上
      len: sideCov < 0.4 ? 0 : (sideCov < 0.75 || belowCov < 0.15) ? 0.6 : Math.min(2.4, 1 + belowCov * 1.6),
      vol: hy0 > 1e8 ? 0 : Math.max(0, Math.min(1, ((top - faceH * 0.22) - hy0) / (faceH * 0.35))),  // 頭殼頂以上的頭髮厚度
      wid: hx1 < 0 ? 0 : Math.max(0, Math.min(1, ((hx1 - hx0) / faceW - 1.1) / 0.9)),
      bald: topArea < 0.03 ? 1 : 0,
    };

    // 五官
    const ear = (u, b, l, r) => d(u, b) / Math.max(1, d(l, r));
    const arL = ear(159, 145, 33, 133), arR = ear(386, 374, 263, 362);
    const tiltL = (Lm[133].y - Lm[33].y) / d(33, 133), tiltR = (Lm[362].y - Lm[263].y) / d(263, 362);
    const lipTh = (d(0, 13) + d(14, 17)) / faceH;
    const ff = { ar: (arL + arR) / 2, tilt: Math.max(-1, Math.min(1, (tiltL + tiltR) / 2 * 6)), size: Math.min(1, (d(33, 133) + d(263, 362)) / 2 / faceW * 4 - 0.3),
                 uneven: Math.min(1, Math.abs(arL - arR) * 8), lips: lipTh > 0.11 ? 1 : lipTh < 0.06 ? -1 : 0 };
    // 頭型
    // 胖瘦：嘴角高度的臉寬、下顎寬，都跟顴骨寬比
    const hf = { wr: faceW / faceH, jaw: d(172, 397) / faceW, mid: d(132, 361) / faceW, low: d(136, 365) / faceW };
    hf.full = (hf.wr - 0.78) * 2 + (hf.mid - 0.95) * 4 + (hf.low - 0.72) * 3;     // 飽滿度：越大越胖圓

    // ---------- 本人五官比例（含額頭）----------
    // 髮際線：眉心正上方往上找，第一個不是臉皮膚的點（頭髮或背景）；找不到就估 mesh 頂再往上 0.25 臉長
    const bx = Lm[9].x;
    let hairY = top - faceH * 0.25;
    for (let y = browY; y > Math.max(0, top - faceH * 0.8); y -= 2) {
      const c = cat(bx, y), c2 = cat(bx - faceW * 0.08, y), c3 = cat(bx + faceW * 0.08, y);
      if (c !== 3 && c2 !== 3 && c3 !== 3) { hairY = y; break; }
    }
    const eyeY = (Lm[159].y + Lm[145].y + Lm[386].y + Lm[374].y) / 4;
    const mouthY = (Lm[13].y + Lm[14].y) / 2;
    const eyeCL = { x: (Lm[33].x + Lm[133].x) / 2 }, eyeCR = { x: (Lm[263].x + Lm[362].x) / 2 };
    const raw = {
      forehead: (browY - hairY) / Math.max(1, chin - hairY),        // 額頭佔 髮際線→下巴
      eyeT: (eyeY - hairY) / Math.max(1, chin - hairY),             // 眼睛高度
      gap: Math.abs(eyeCR.x - eyeCL.x) / faceW,                     // 兩眼間距
      size: (d(33, 133) + d(263, 362)) / 2 / faceW,                 // 眼睛寬
      mouthT: (mouthY - eyeY) / Math.max(1, chin - eyeY),           // 嘴巴在 眼→下巴 的位置
      mouthW: d(61, 291) / faceW,                                   // 嘴寬
      noseW: d(64, 294) / faceW,                                    // 鼻翼寬
      noseL: (Lm[2].y - Lm[168].y) / Math.max(1, faceH),            // 鼻長（鼻根→鼻下）
      noseT: (Lm[2].y - eyeY) / Math.max(1, mouthY - eyeY),         // 鼻底在 眼→嘴 的位置
    };
    const MEAN = { forehead: 0.28, eyeT: 0.39, gap: 0.44, size: 0.20, mouthT: 0.59, mouthW: 0.46 };   // 樣本照校正的一般值
    const clp = (v, a, b) => Math.max(a, Math.min(b, v));
    const prop = {
      forehead: clp(0.2 * raw.forehead / MEAN.forehead, 0.06, 0.34),                 // 角色額頭（預設 0.2）
      eyeDy: 0,                                                                       // 眼睛高低已由額頭決定
      eyeGap: clp((raw.gap / MEAN.gap - 1) * 1.5, -0.15, 0.15),
      eyeScale: 1 + clp((raw.size / MEAN.size - 1) * 1.2, -0.2, 0.2),
      mouthDy: clp((raw.mouthT - MEAN.mouthT) * 0.25, -0.04, 0.04),
      mouthScale: 1 + clp((raw.mouthW / MEAN.mouthW - 1) * 1.2, -0.2, 0.2),
      noseY: clp(0.5 + (raw.noseT - 0.66) * 2.5, 0.2, 0.8),                            // 鼻子在 眼→嘴 間的高低
    };
    // 鼻型：女生整體偏小一點（Q 版女生鼻子小）
    const nf = { w: clp((raw.noseW / 0.27 - 1) * 7, -1, 1) - (gender === 'f' ? 0.4 : 0), l: clp((raw.noseL / 0.29 - 1) * 7, -1, 1) - (gender === 'f' ? 0.3 : 0) };

    // 眼鏡：眼睛外圍一圈的邊緣強度 vs 臉頰；墨鏡：眼睛區很暗
    const edge = (x, y) => { const a = lum(...at(x - 1, y)), b = lum(...at(x + 1, y)), c = lum(...at(x, y - 1)), e = lum(...at(x, y + 1)); return Math.abs(a - b) + Math.abs(c - e); };
    let er = 0, en = 0, ck = 0, cn = 0, eyeL = 0, eyeN = 0;
    for (const [c0, c1] of [[33, 133], [263, 362]]) {
      const ex = (Lm[c0].x + Lm[c1].x) / 2, ey = (Lm[c0].y + Lm[c1].y) / 2, rr = d(c0, c1);
      for (let a = 0; a < Math.PI * 2; a += 0.15) for (const k of [0.9, 1.05, 1.2]) { er += edge(ex + Math.cos(a) * rr * k, ey + Math.sin(a) * rr * k * 0.75); en++; }
      for (let y = ey - rr * 0.3; y < ey + rr * 0.3; y += 2) for (let x = ex - rr * 0.4; x < ex + rr * 0.4; x += 2) { eyeL += lum(...at(x, y)); eyeN++; }
    }
    for (const i of [50, 280, 205, 425]) for (let k = 0; k < 12; k++) { ck += edge(Lm[i].x + (k % 4) * 2, Lm[i].y + (k >> 2) * 2); cn++; }
    const rim = (er / en) / Math.max(4, ck / cn), skinL = lum(...skinRGB), eyeDark = (eyeL / eyeN) / skinL;
    // 分割模型第 5 類＝配件（眼鏡常被分在這）：看兩眼周圍與鼻樑有多少像素是配件
    let acc = 0, accN = 0;
    for (const [c0, c1] of [[33, 133], [263, 362]]) {
      const ex = (Lm[c0].x + Lm[c1].x) / 2, ey = (Lm[c0].y + Lm[c1].y) / 2, rr = d(c0, c1);
      for (let y = ey - rr * 0.7; y < ey + rr * 0.7; y += 2) for (let x = ex - rr * 0.9; x < ex + rr * 0.9; x += 2) { accN++; if (cat(x, y) === 5) acc++; }
    }
    const accF = acc / Math.max(1, accN);
    const glasses = (accF > 0.12 && eyeDark < 0.45) || eyeDark < 0.3 ? 'g_sun' : accF > 0.06 ? (accF > 0.2 ? 'g_thick' : 'g_square') : null;

    // 鬍子（男）：跟上臉頰（同光線、不長鬍子）比，下唇下方／上唇／兩側下顎「明顯比較暗」的像素比例，
    //            再加上分割模型判成毛髮的比例；下巴取下唇正下方，避開下巴底下的陰影
    let beard = null, beardDbg = null;
    {
      const disc = (idx, rf) => { const out = []; const r = faceW * rf;
        for (const i of idx) for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) if (dx * dx + dy * dy <= r * r) out.push([Lm[i].x + dx, Lm[i].y + dy]);
        return out; };
      const cheekPts = disc([50, 280, 117, 346, 123, 352], 0.045);
      const cheekL = cheekPts.reduce((s, p) => s + lum(...at(p[0], p[1])), 0) / cheekPts.length;
      const score = idx => { const pts = disc(idx, 0.045); let dark = 0, hair = 0;
        for (const [x, y] of pts) { if (lum(...at(x, y)) < cheekL * 0.72) dark++; if (cat(x, y) === 1) hair++; }
        return Math.max(dark, hair) / pts.length; };
      const chinF = score([18, 200, 199, 175]), lipF = score([164, 167, 393, 165, 391]), jawF = score([172, 397, 136, 365, 150, 379]);
      // 長度：下巴以下（下巴→再往下 0.5 臉長、下顎寬內）有鬍子的排數比例；寬度：嘴巴高度在臉寬外側有沒有鬍子
      const isB = (x, y) => cat(x, y) === 1;   // 只認毛髮分割：脖子陰影、深色衣服、整張偏暗都不算
      let lr = 0, ln = 0;
      for (let y = chin + faceH * 0.06; y < Math.min(H - 1, chin + faceH * 0.55); y += 3) {
        ln++; let c = 0, n = 0;
        for (let x = Lm[172].x; x < Lm[397].x; x += 3) { n++; if (isB(x, y)) c++; }
        if (n && c / n > 0.5) lr++;
      }
      const longF = ln ? lr / ln : 0;
      let wc = 0, wn = 0;
      for (let y = Lm[61].y; y < chin; y += 3) for (const x of [fx0 - faceW * 0.08, fx1 + faceW * 0.08]) { wn++; if (isB(x, y)) wc++; }
      const wideF = wn ? wc / wn : 0;
      beardDbg = { chinF: +chinF.toFixed(2), lipF: +lipF.toFixed(2), jawF: +jawF.toFixed(2), longF: +longF.toFixed(2), wideF: +wideF.toFixed(2), cheekL: Math.round(cheekL) };
      if (gender === 'm') {
        // 四個部位各自判斷（嘴巴永遠在唇上與唇下之間）
        beard = {
          beardUp: lipF > 0.7 ? 'up_natural' : lipF > 0.5 && chinF > 0.3 ? 'up_stubble' : null,
          beardLow: chinF > 0.6 ? 'low_full' : chinF > 0.45 ? 'low_goatee' : chinF > 0.25 && jawF > 0.2 ? 'low_stubble' : null,
          // 鰓邊：下顎常有陰影，要下巴或上唇也有鬍子才算
          beardSide: !(chinF > 0.3 || lipF > 0.5) ? null : jawF > 0.6 ? (wideF > 0.5 ? 'side_bushy' : 'side_short') : jawF > 0.4 && chinF > 0.45 ? 'side_heavystubble' : chinF > 0.25 && jawF > 0.2 ? 'side_stubble' : null,
          beardUnder: longF > 0.55 ? 'under_long' : longF > 0.3 ? 'under_round' : chinF > 0.6 && jawF > 0.4 ? 'under_short' : null,
        };
      }
    }

    const AV = window.AVATAR, g = gender;
    const hairCat = 'hair_' + g, faceCat = 'face_' + g;
    const pick = {
      gender: g,
      skin: skinPick(skinRel),
      hairColor: hairColorPick(hairRGB),
      hair: feat.bald ? 'bald' : nearest(HAIR_TAG[hairCat], feat, { fr: 3, len: 2, vol: 1.5, wid: 1, asym: 1, bald: 2 }),
      face: nearest(FACE_TAG[faceCat], ff, { ar: 30, tilt: 2, size: 2, uneven: 1, lips: .5 }),
      head: nearest(Object.fromEntries(Object.entries(HEAD_TAG).filter(([k]) => k.startsWith(g + '_'))), hf, { wr: 8, jaw: 6, full: 10 }),
      nose: nearest(NOSE_TAG, nf, { w: 1, l: 1 }),
      glasses, prop, ...(beard || {}),
    };
    // 只挑造型庫裡真的有的
    const LIB = window.STYLE_LIB || {};
    if (pick.hair !== 'bald' && !(LIB[hairCat] && LIB[hairCat][pick.hair])) delete pick.hair;
    if (!(LIB[faceCat] && LIB[faceCat][pick.face])) delete pick.face;
    if (!(LIB.head && LIB.head[pick.head])) delete pick.head;
    return { pick, debug: { raw, prop, nf, feat, ff, hf, hairArea: +hairArea.toFixed(2), sideCov: +sideCov.toFixed(2), belowCov: +belowCov.toFixed(2), topArea: +topArea.toFixed(3), beard: beardDbg, rim: +rim.toFixed(2), skinRel: +skinRel.toFixed(3), p95, accF: +accF.toFixed(3), eyeDark: +eyeDark.toFixed(2), skinRGB: skinRGB.map(Math.round), hairRGB: hairRGB.map(Math.round) } };
  }
  return { analyze, HAIR_TAG, FACE_TAG, HEAD_TAG };
})();
