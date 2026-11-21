// 造型選單：右上角「換人」→ 下方面板：男／女、照片自動配對、各類造型手動挑選
(() => {
  'use strict';
  const AV = window.AVATAR, LIB = window.STYLE_LIB || {};
  if (!AV) return;
  const css = `
  #avBtn{position:fixed;top:calc(max(8px,env(safe-area-inset-top)) + 64px);right:8px;z-index:20;border:0;border-radius:20px;padding:8px 14px;
    background:#3a2a22;color:#fff;font:800 15px system-ui,sans-serif;box-shadow:0 2px 6px #0004}
  #avPanel{position:fixed;left:0;right:0;bottom:0;height:46vh;z-index:21;background:#fff8ef;border-top:3px solid #3a2a22;
    border-radius:18px 18px 0 0;display:none;flex-direction:column;font:14px system-ui,"Noto Sans TC",sans-serif;color:#3a2a22;
    touch-action:pan-y;user-select:none}
  #avPanel.open{display:flex}
  #avPanel .row{display:flex;gap:6px;align-items:center;padding:8px 10px 0;flex-wrap:wrap}
  #avPanel button,#avPanel label.btn{border:2px solid #3a2a22;background:#fff;border-radius:14px;padding:5px 11px;font:700 14px system-ui,sans-serif;color:#3a2a22}
  #avPanel button.on{background:#3a2a22;color:#fff}
  #avPanel .note{font-size:12px;color:#8a6a4a;padding:4px 12px 0}
  #avList{flex:1;overflow-y:auto;padding:6px 10px 16px;-webkit-overflow-scrolling:touch}
  #avList .sec{border:2px solid #e6d3bd;border-radius:12px;margin-bottom:6px;background:#fffdf9}
  #avList .sec.open{border-color:#3a2a22}
  #avList .hd{display:flex;width:100%;align-items:center;gap:8px;border:0!important;background:none!important;padding:8px 10px!important;text-align:left}
  #avList .hd .ar{width:14px;transition:transform .15s}
  #avList .sec.open .hd .ar{transform:rotate(90deg)}
  #avList .hd .cur{margin-left:auto;font-weight:500;font-size:12px;color:#8a6a4a}
  #avList .hd .adj{font-size:11px;color:#e74c3c}
  #avGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;padding:0 8px 10px}
  #avAdj{display:none;padding:6px 10px 0;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}
  #avAdj.on{display:flex}
  #avAdj b{color:#e74c3c}
  #avPanel button.adjOn{background:#e74c3c;border-color:#e74c3c;color:#fff}
  .secNote{padding:0 12px 10px;font-size:12px;color:#8a6a4a}
  #avGrid .it{border:2px solid #e6d3bd;border-radius:12px;background:#fff;padding:4px;text-align:center;font-size:12px;line-height:1.2}
  #avGrid .it.on{border-color:#e74c3c;box-shadow:0 0 0 2px #e74c3c55}
  #avGrid .it .th{height:56px;display:flex;align-items:center;justify-content:center}
  #avGrid .it img{max-width:100%;max-height:56px;filter:drop-shadow(0 1px 0 #0002)}
  #avGrid .sw{width:40px;height:40px;border-radius:50%;border:2px solid #3a2a22;margin:6px auto}
  #avStatus{min-height:16px}`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  const btn = Object.assign(document.createElement('button'), { id: 'avBtn', textContent: '👤 換人' });
  const panel = document.createElement('div'); panel.id = 'avPanel';
  panel.innerHTML = `
    <div class="row"><button data-g="m">男</button><button data-g="f">女</button>
      <label class="btn">📷 照片自動配對<input id="avFile" type="file" accept="image/*" hidden></label>
      <button id="avAdjBtn">🛠 調整</button><button id="avReset">重設</button><button id="avDone">完成</button></div>
    <div class="note">照片只在你的手機上分析，不會上傳也不會保存；只記住選了哪些造型。</div>
    <div class="note" id="avStatus"></div>
    <div id="avAdj"><span>調整：<b id="avAdjName">－</b>　拖動＝移動　滾輪／雙指＝縮放</span>
      <button id="avAdjReset">重設此部件</button>
      <label id="avPhRow" style="display:none"><input type="checkbox" id="avPhShow" checked> 底圖　人物透明 <input type="range" id="avPhAlpha" min="0.15" max="1" step="0.05" value="0.6" style="width:90px;vertical-align:middle"></label></div>
    <div id="avList"></div>`;
  document.body.append(btn, panel);
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart']) panel.addEventListener(ev, e => e.stopPropagation());
  const $ = s => panel.querySelector(s);
  const status = t => { $('#avStatus').textContent = t || ''; };

  // 各類選項
  const g = () => AV.get().gender;
  const none = { id: null, name: '無' };
  const beardOf = pre => [none].concat(Object.entries(LIB.beard || {}).filter(([k]) => k.startsWith(pre)).map(([k, v]) => ({ id: k, name: v.name, img: v.file })));
  const accOf = pre => [none].concat(Object.entries(LIB.acc || {}).filter(([k]) => k.startsWith(pre)).map(([k, v]) => ({ id: k, name: v.name, img: v.file })));
  const CATS = [
    { key: 'photo', name: '參考底圖', photo: true },
    { key: 'hair', name: '髮型', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/hair_front.png' }] : [])
        .concat([{ id: 'bald', name: '光頭' }])
        .concat(Object.entries(LIB['hair_' + g()] || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.front && v.front.file, gray: true }))) },
    { key: 'hairColor', name: '髮色', list: () => AV.HAIRC.map(c => ({ id: c.id, name: c.name, sw: c.c })) },
    { key: 'skin', name: '膚色', list: () => AV.SKIN.map(c => ({ id: c.id, name: c.name, sw: c.c || '#fbd7bd' })) },
    { key: 'head', name: '臉型', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/head.png' }] : [])
        .concat(Object.entries(LIB.head || {}).filter(([k]) => k.startsWith(g() + '_'))
          .sort((a, b) => (b[1].sheet > a[1].sheet) - (b[1].sheet < a[1].sheet))     // 新的大臉頭型排前面
          .map(([k, v]) => ({ id: k, name: v.name, img: v.file }))) },
    { key: 'face', name: '五官', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/face_smug.png' }] : [])
        .concat(Object.entries(LIB['face_' + g()] || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.smug && v.smug.file }))) },
    { key: 'body', name: '體型', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/torso.png' }] : [])
        .concat(Object.entries(LIB['body_' + g()] || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.torso && v.torso.file }))) },
    { key: 'mouth', name: '嘴巴', note: '嘴巴跟著「五官」款式；開「調整」可拖動、縮放。' },
    { key: 'nose', name: '鼻子', list: () => [none].concat(Object.entries(LIB.nose || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.file }))) },
    { key: 'glasses', name: '眼鏡', list: () => accOf('g_') },
    { key: 'beardUp', name: '唇上鬍', list: () => beardOf('up_') },
    { key: 'beardLow', name: '唇下鬍', list: () => beardOf('low_') },
    { key: 'beardSide', name: '鰓邊鬍', list: () => beardOf('side_') },
    { key: 'beardUnder', name: '頷下鬍', list: () => beardOf('under_') },
    { key: 'hat', name: '頭飾', list: () => accOf('h_') },
    { key: 'ear', name: '耳環', list: () => accOf('e_') },
    { key: 'neck', name: '項鍊', list: () => accOf('n_') },
    { key: 'mark', name: '臉上', list: () => accOf('f_') },
  ];
  // 展開式選單：一次開一個部件；調整模式下，開著的部件就是拖動／縮放的對象
  const ADJ = { photo: 'photo', hair: 'hair', head: 'head', face: 'eyes', mouth: 'mouth', nose: 'nose', glasses: 'glasses',
    beardUp: 'beardUp', beardLow: 'beardLow', beardSide: 'beardSide', beardUnder: 'beardUnder', hat: 'hat', ear: 'ear', neck: 'neck', mark: 'mark' };
  let curCat = 'hair', adjMode = false;
  const curName = c => { if (!c.list) return ''; const v = AV.get()[c.key], o = c.list().find(x => x.id === v); return o ? o.name : (v == null ? '無' : v); };
  function syncAdj() {
    window.AV_ADJUST = adjMode; window.AV_ADJ_TARGET = adjMode ? ADJ[curCat] || null : null;
    $('#avAdjBtn').classList.toggle('adjOn', adjMode);
    $('#avAdj').classList.toggle('on', adjMode);
    const c = CATS.find(x => x.key === curCat);
    $('#avAdjName').textContent = window.AV_ADJ_TARGET ? c.name : '（請展開要調整的部件）';
    const ph = AV.photo(); $('#avPhRow').style.display = ph ? '' : 'none';
    if (ph) { $('#avPhShow').checked = ph.show; $('#avPhAlpha').value = ph.alpha; }
  }
  function gridHTML(c) {
    if (c.photo) return `<div class="secNote">${AV.photo() ? '已載入參考照片（只在這台手機的記憶體，不存檔）。開「調整」可拖動、縮放底圖。' : '還沒有參考照片：用上面「📷 照片自動配對」，或這裡只載入底圖不改造型。'}</div>
      <div class="row" style="padding:0 8px 10px"><label class="btn">🖼 只載入底圖<input id="avPhFile" type="file" accept="image/*" hidden></label>${AV.photo() ? '<button id="avPhDel">移除底圖</button>' : ''}</div>`;
    if (c.note) return `<div class="secNote">${c.note}</div>`;
    const sel = AV.get()[c.key];
    return '<div id="avGrid">' + c.list().map(o => `
      <div class="it ${o.id === sel ? 'on' : ''}" data-id="${o.id === null ? '' : o.id}">
        <div class="th">${o.sw ? `<div class="sw" style="background:${o.sw}"></div>` : o.img ? `<img src="${o.img}" loading="lazy" alt="">` : '<span style="font-size:26px">✕</span>'}</div>${o.name}</div>`).join('') + '</div>';
  }
  function refresh() {
    panel.querySelectorAll('[data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === g()));
    const adj = AV.get().adj || {};
    $('#avList').innerHTML = CATS.map(c => `<div class="sec ${c.key === curCat ? 'open' : ''}" data-c="${c.key}">
      <button class="hd"><span class="ar">▸</span>${c.name}${adj[ADJ[c.key]] ? '<span class="adj">已調整</span>' : ''}<span class="cur">${curName(c)}</span></button>
      ${c.key === curCat ? gridHTML(c) : ''}</div>`).join('');
    syncAdj();
  }
  $('#avList').addEventListener('click', e => {
    const hd = e.target.closest('.hd');
    if (hd) { const k = hd.parentNode.dataset.c; curCat = curCat === k ? null : k; refresh();
      const o = panel.querySelector('.sec.open'); if (o) o.scrollIntoView({ block: 'nearest' }); return; }
    if (e.target.id === 'avPhDel') { AV.setPhoto(null); refresh(); return; }
    const it = e.target.closest('.it'); if (!it) return;
    const id = it.dataset.id === '' ? null : it.dataset.id;
    AV.set({ [curCat]: id }).then(refresh); refresh();
  });
  $('#avList').addEventListener('change', async e => {
    if (e.target.id !== 'avPhFile') return;
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f || !window.FACEMATCH) return;
    try { const r = await FACEMATCH.analyze(f, g(), status); AV.setPhoto(r.photo); AV.resetAdj('photo'); status('底圖已載入。'); refresh(); }
    catch (err) { status('⚠ ' + (err && err.message || err)); }
  });
  $('#avAdjBtn').addEventListener('click', () => { adjMode = !adjMode; refresh(); });
  // 拖完／滾完更新「已調整」標記
  const cvEl = document.getElementById('c');
  let rT = 0; const later = () => { if (adjMode) { clearTimeout(rT); rT = setTimeout(refresh, 250); } };
  cvEl.addEventListener('pointerup', later); cvEl.addEventListener('wheel', later);
  $('#avAdjReset').addEventListener('click', () => { if (window.AV_ADJ_TARGET) { AV.resetAdj(window.AV_ADJ_TARGET); refresh(); } });
  $('#avPhShow').addEventListener('change', e => { const ph = AV.photo(); if (ph) ph.show = e.target.checked; });
  $('#avPhAlpha').addEventListener('input', e => { const ph = AV.photo(); if (ph) ph.alpha = +e.target.value; });
  const FDEF = { hair: 'longbangs', face: 'lashes', head: 'f_oval2', body: 'std', beardUp: null, beardLow: null, beardSide: null, beardUnder: null };
  const MDEF = { hair: 'orig', face: 'orig', head: 'orig', body: 'orig' };
  panel.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.g === g()) return;
    AV.set(Object.assign({ gender: b.dataset.g }, b.dataset.g === 'f' ? FDEF : MDEF)).then(refresh); refresh();
  }));
  $('#avReset').addEventListener('click', () => { AV.reset().then(refresh); status(''); });
  const setOpen = o => { panel.classList.toggle('open', o); window.AV_PANEL_OPEN = o; btn.style.display = o ? 'none' : ''; window.onAvatarChange && window.onAvatarChange(); };
  $('#avDone').addEventListener('click', () => { adjMode = false; syncAdj(); setOpen(false); });
  btn.addEventListener('click', () => { setOpen(true); refresh(); });
  $('#avFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f || !window.FACEMATCH) return;
    try {
      const { pick, photo } = await FACEMATCH.analyze(f, g(), status);
      AV.setPhoto(photo);
      await AV.set(Object.assign({ glasses: null, beardUp: null, beardLow: null, beardSide: null, beardUnder: null, adj: {} }, pick));
      status('配對完成！不像的地方可以在下面自己換。');
      refresh();
    } catch (err) { status('⚠ ' + (err && err.message || err)); }
  });
})();
