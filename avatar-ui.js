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
  #avTabs{display:flex;gap:6px;overflow-x:auto;padding:8px 10px;flex:none;-webkit-overflow-scrolling:touch}
  #avTabs button{flex:none;padding:4px 10px;font-size:13px}
  #avGrid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;padding:4px 10px 16px;-webkit-overflow-scrolling:touch}
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
      <button id="avReset">重設</button><button id="avDone">完成</button></div>
    <div class="note">照片只在你的手機上分析，不會上傳也不會保存；只記住選了哪些造型。</div>
    <div class="note" id="avStatus"></div>
    <div id="avTabs"></div><div id="avGrid"></div>`;
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
    { key: 'hair', name: '髮型', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/hair_front.png' }] : [])
        .concat([{ id: 'bald', name: '光頭' }])
        .concat(Object.entries(LIB['hair_' + g()] || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.front && v.front.file, gray: true }))) },
    { key: 'hairColor', name: '髮色', list: () => AV.HAIRC.map(c => ({ id: c.id, name: c.name, sw: c.c })) },
    { key: 'skin', name: '膚色', list: () => AV.SKIN.map(c => ({ id: c.id, name: c.name, sw: c.c || '#fbd7bd' })) },
    { key: 'head', name: '臉型', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/head.png' }] : [])
        .concat(Object.entries(LIB.head || {}).filter(([k]) => k.startsWith(g() + '_')).map(([k, v]) => ({ id: k, name: v.name, img: v.file }))) },
    { key: 'face', name: '五官', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/face_smug.png' }] : [])
        .concat(Object.entries(LIB['face_' + g()] || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.smug && v.smug.file }))) },
    { key: 'body', name: '體型', list: () => (g() === 'm' ? [{ id: 'orig', name: '原本', img: 'parts/torso.png' }] : [])
        .concat(Object.entries(LIB['body_' + g()] || {}).map(([k, v]) => ({ id: k, name: v.name, img: v.torso && v.torso.file }))) },
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
  let curCat = 'hair';
  function drawTabs() {
    $('#avTabs').innerHTML = CATS.map(c => `<button data-c="${c.key}" class="${c.key === curCat ? 'on' : ''}">${c.name}</button>`).join('');
    panel.querySelectorAll('[data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === g()));
  }
  function drawGrid() {
    const c = CATS.find(x => x.key === curCat), sel = AV.get()[curCat];
    $('#avGrid').innerHTML = c.list().map(o => `
      <div class="it ${o.id === sel ? 'on' : ''}" data-id="${o.id === null ? '' : o.id}">
        <div class="th">${o.sw ? `<div class="sw" style="background:${o.sw}"></div>` : o.img ? `<img src="${o.img}" loading="lazy" alt="">` : '<span style="font-size:26px">✕</span>'}</div>${o.name}</div>`).join('');
  }
  const refresh = () => { drawTabs(); drawGrid(); };
  $('#avTabs').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { curCat = b.dataset.c; refresh(); } });
  $('#avGrid').addEventListener('click', e => {
    const it = e.target.closest('.it'); if (!it) return;
    const id = it.dataset.id === '' ? null : it.dataset.id;
    AV.set({ [curCat]: id }).then(drawGrid); drawGrid();
  });
  const FDEF = { hair: 'longbangs', face: 'lashes', head: 'f_oval', body: 'std', beardUp: null, beardLow: null, beardSide: null, beardUnder: null };
  const MDEF = { hair: 'orig', face: 'orig', head: 'orig', body: 'orig' };
  panel.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.g === g()) return;
    AV.set(Object.assign({ gender: b.dataset.g }, b.dataset.g === 'f' ? FDEF : MDEF)).then(refresh); refresh();
  }));
  $('#avReset').addEventListener('click', () => { AV.reset().then(refresh); status(''); });
  const setOpen = o => { panel.classList.toggle('open', o); window.AV_PANEL_OPEN = o; btn.style.display = o ? 'none' : ''; window.onAvatarChange && window.onAvatarChange(); };
  $('#avDone').addEventListener('click', () => setOpen(false));
  btn.addEventListener('click', () => { setOpen(true); refresh(); });
  $('#avFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f || !window.FACEMATCH) return;
    try {
      const { pick } = await FACEMATCH.analyze(f, g(), status);
      await AV.set(Object.assign({ glasses: null, beardUp: null, beardLow: null, beardSide: null, beardUnder: null }, pick));
      status('配對完成！不像的地方可以在下面自己換。');
      refresh();
    } catch (err) { status('⚠ ' + (err && err.message || err)); }
  });
})();
