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
  const HEAD_TAG = {
    m_round: { wr: .95, jaw: .85 }, m_oval: { wr: .8, jaw: .75 }, m_long: { wr: .7, jaw: .75 }, m_square: { wr: .88, jaw: .95 },
    m_wide: { wr: 1.02, jaw: .85 }, m_pointed: { wr: .82, jaw: .6 }, m_ears: { wr: .85, jaw: .8 }, m_jaw: { wr: .9, jaw: 1 },
    f_round: { wr: .95, jaw: .85 }, f_oval: { wr: .8, jaw: .75 }, f_long: { wr: .7, jaw: .72 }, f_v: { wr: .78, jaw: .6 },
    f_heart: { wr: .85, jaw: .62 }, f_wide: { wr: 1, jaw: .85 }, f_pointed: { wr: .8, jaw: .58 }, f_chubby: { wr: .98, jaw: .92 },
  };

  // ---------- 量測 ----------
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  // 特殊造型不參加自動配對（只能手動選）
  const NO_AUTO = new Set(['cornrow', 'dreads', 'mohawk', 'manbun', 'balding', 'spacebuns', 'drill', 'uneven', 'bucktooth', 'dot', 'star']);
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
    const sc = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
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

    // 頭髮：遮罩統計
    const hairPx = [];
    let hn = 0, hx0 = 1e9, hx1 = -1, hy0 = 1e9, hy1 = -1;
    const ext = faceH * 1.6;
    for (let y = Math.max(0, top - ext); y < Math.min(H, chin + ext); y += 2) for (let x = Math.max(0, fx0 - faceW); x < Math.min(W, fx1 + faceW); x += 2) {
      if (cat(x, y) !== 1) continue; hn++;
      const c = at(x, y); hairPx.push(c);
      if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; if (y < hy0) hy0 = y; if (y > hy1) hy1 = y;
    }
    const hairArea = hn * 4 / (faceW * faceH);
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
      len: hy1 < 0 ? 0 : Math.max(0, Math.min(2.4, (hy1 - chin) / (faceH * 0.5) + 0.3)),
      vol: hy0 > 1e8 ? 0 : Math.max(0, Math.min(1, ((top - faceH * 0.22) - hy0) / (faceH * 0.35))),  // 頭殼頂以上的頭髮厚度
      wid: hx1 < 0 ? 0 : Math.max(0, Math.min(1, ((hx1 - hx0) / faceW - 1.1) / 0.9)),
      bald: hairArea < 0.08 ? 1 : 0,
    };

    // 五官
    const ear = (u, b, l, r) => d(u, b) / Math.max(1, d(l, r));
    const arL = ear(159, 145, 33, 133), arR = ear(386, 374, 263, 362);
    const tiltL = (Lm[133].y - Lm[33].y) / d(33, 133), tiltR = (Lm[362].y - Lm[263].y) / d(263, 362);
    const lipTh = (d(0, 13) + d(14, 17)) / faceH;
    const ff = { ar: (arL + arR) / 2, tilt: Math.max(-1, Math.min(1, (tiltL + tiltR) / 2 * 6)), size: Math.min(1, (d(33, 133) + d(263, 362)) / 2 / faceW * 4 - 0.3),
                 uneven: Math.min(1, Math.abs(arL - arR) * 8), lips: lipTh > 0.11 ? 1 : lipTh < 0.06 ? -1 : 0 };
    // 頭型
    const hf = { wr: faceW / faceH, jaw: d(172, 397) / faceW };

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
    const glasses = eyeDark < 0.35 ? 'g_sun' : rim > 3.2 ? (rim > 4.5 ? 'g_thick' : 'g_square') : null;

    // 鬍子（男）：下巴、上唇、下顎附近有多少像素被分割成「毛髮」
    let beard = null;
    if (gender === 'm') {
      const frac = idx => { let h = 0, n = 0; const r = faceW * 0.05;
        for (const i of idx) for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) { n++; if (cat(Lm[i].x + dx, Lm[i].y + dy) === 1) h++; }
        return h / n; };
      const chinF = frac([152, 148, 377, 175, 199]), lipF = frac([164, 167, 393, 37, 267]), jawF = frac([172, 397, 136, 365, 58, 288]);
      if (chinF > 0.35 && jawF > 0.3) beard = 'b_full';
      else if (chinF > 0.35 && lipF > 0.3) beard = 'b_boxed';
      else if (chinF > 0.35) beard = 'b_goatee';
      else if (lipF > 0.35) beard = 'b_mustache';
      else if (chinF > 0.15 && jawF > 0.15) beard = 'b_stubble';
      var beardDbg = { chinF: +chinF.toFixed(2), lipF: +lipF.toFixed(2), jawF: +jawF.toFixed(2) };
    }

    const AV = window.AVATAR, g = gender;
    const hairCat = 'hair_' + g, faceCat = 'face_' + g;
    const pick = {
      gender: g,
      skin: colorNearest(AV.SKIN, skinRGB, true),
      hairColor: hairColorPick(hairRGB),
      hair: feat.bald ? 'bald' : nearest(HAIR_TAG[hairCat], feat, { fr: 3, len: 2, vol: 1.5, wid: 1, asym: 1, bald: 2 }),
      face: nearest(FACE_TAG[faceCat], ff, { ar: 30, tilt: 2, size: 2, uneven: 1, lips: .5 }),
      head: nearest(Object.fromEntries(Object.entries(HEAD_TAG).filter(([k]) => k.startsWith(g + '_'))), hf, { wr: 10, jaw: 6 }),
      glasses, beard,
    };
    // 只挑造型庫裡真的有的
    const LIB = window.STYLE_LIB || {};
    if (pick.hair !== 'bald' && !(LIB[hairCat] && LIB[hairCat][pick.hair])) delete pick.hair;
    if (!(LIB[faceCat] && LIB[faceCat][pick.face])) delete pick.face;
    if (!(LIB.head && LIB.head[pick.head])) delete pick.head;
    return { pick, debug: { feat, ff, hf, hairArea: +hairArea.toFixed(2), beard: beardDbg, rim: +rim.toFixed(2), eyeDark: +eyeDark.toFixed(2), skinRGB: skinRGB.map(Math.round), hairRGB: hairRGB.map(Math.round) } };
  }
  return { analyze, HAIR_TAG, FACE_TAG, HEAD_TAG };
})();
