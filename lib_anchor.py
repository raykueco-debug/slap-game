"""造型素材自動對位：算每片素材的比例與錨點，寫回 lib/manifest.json / manifest.js，並出預覽圖
- 比例：同類素材以「對應原圖部件」換算（hair→原 hair_front/back，face→原 face_smug，head→原 head）
- 頭髮錨點：上半部最寬那一排（貼著頭殼兩側）對齊原圖瀏海最寬那排
用法：python lib_anchor.py [預覽輸出.png]
"""
import json
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
TH = 40
CLIP_Y = -45   # 短髮後髮只保留 head 座標此線以上


def widest_row(im, frac=0.75):
    """回傳 (y, 左, 右)：上方 frac 範圍內最寬的一排（用不透明像素的最左最右）"""
    a = im.getchannel('A').load()
    W, H = im.size
    best = (0, 0, 0, -1)
    for y in range(int(H * frac)):
        xs = [x for x in range(0, W, 2) if a[x, y] > TH]
        if xs and xs[-1] - xs[0] > best[3]:
            best = (y, xs[0], xs[-1], xs[-1] - xs[0])
    return best[:3]


def fit_anchor(im):
    """頭髮頂部外輪廓擬合成圓（頭殼弧度），回傳 (圓心 y, 圓心 x, 半徑)；頂上的丸子／馬尾／尖刺當離群點剔除"""
    al = im.getchannel('A').load()
    W, H = im.size
    pts = []
    for x in range(int(W * 0.1), int(W * 0.9), 2):
        for y in range(H):
            if al[x, y] > TH:
                pts.append((x, y)); break
    def fit(ps):
        # Kasa：x²+y²+Dx+Ey+F=0 最小平方
        import itertools
        n = len(ps); sx = sum(p[0] for p in ps); sy = sum(p[1] for p in ps)
        sxx = sum(p[0] ** 2 for p in ps); syy = sum(p[1] ** 2 for p in ps); sxy = sum(p[0] * p[1] for p in ps)
        z = [p[0] ** 2 + p[1] ** 2 for p in ps]
        sxz = sum(p[0] * zz for p, zz in zip(ps, z)); syz = sum(p[1] * zz for p, zz in zip(ps, z)); sz = sum(z)
        M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]]; v = [-sxz, -syz, -sz]
        def det(m): return (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
        d = det(M); sol = []
        for i in range(3):
            Mi = [row[:] for row in M]
            for r in range(3): Mi[r][i] = v[r]
            sol.append(det(Mi) / d)
        D, E, F = sol; cx, cy = -D / 2, -E / 2
        return cx, cy, max(1.0, (cx * cx + cy * cy - F)) ** 0.5
    ps = pts
    for _ in range(3):
        cx, cy, r = fit(ps)
        keep = [p for p in ps if ((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 < r * 1.05]
        if len(keep) < 10 or len(keep) == len(ps):
            break
        ps = keep
    return cy, cx, r


def split_mouth(im):
    """五官圖拆成（眼睛眉毛圖, 嘴巴圖, 嘴巴資訊）；嘴巴＝下半部、靠近中線的相連圖形"""
    from slice_grid import label
    W, H = im.size
    al = im.getchannel('A')
    lab, comps = label(al, W, H)
    n = len(comps)
    sx = [0] * (n + 1); sy = [0] * (n + 1); cnt = [0] * (n + 1)
    for y in range(H):
        row = y * W
        for x in range(W):
            c = lab[row + x]
            if c:
                sx[c] += x; sy[c] += y; cnt[c] += 1
    mouth = set()
    for c in range(1, n + 1):
        if cnt[c] < 30:
            continue
        cx, cy = sx[c] / cnt[c], sy[c] / cnt[c]
        if abs(cx - W / 2) < W * 0.22 and cy > H * 0.58:
            mouth.add(c)
    if not mouth:
        return None
    px = im.load()
    eyes = im.copy(); ep = eyes.load()
    mo = Image.new('RGBA', im.size, (0, 0, 0, 0)); mp = mo.load()
    for y in range(H):
        row = y * W
        for x in range(W):
            if lab[row + x] in mouth:
                mp[x, y] = px[x, y]; ep[x, y] = (0, 0, 0, 0)
    bb = mo.getchannel('A').getbbox()
    info = {'cx': (bb[0] + bb[2]) / 2 - W / 2, 'cy': (bb[1] + bb[3]) / 2 - H / 2, 'w': bb[2] - bb[0]}
    eb = eyes.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
    info['eyes'] = {'cx': (eb[0] + eb[2]) / 2 - W / 2, 'cy': (eb[1] + eb[3]) / 2 - H / 2, 'w': eb[2] - eb[0], 'h': eb[3] - eb[1], 'W': W, 'H': H}
    return eyes, mo.crop(bb), info


def hairline(im, axr=0.5):
    """前髮在中線附近的髮際線（圖片高度比例）：中間 10% 寬的每一欄，從上往下穿過頭髮後第一個透明處，取中位數"""
    al = im.getchannel('A').load(); W, H = im.size
    ys = []
    for x in range(int(W * (axr - 0.05)), int(W * (axr + 0.05)) + 1):
        y = 0
        while y < H and al[x, y] <= TH: y += 1           # 跳過上方透明
        while y < H and al[x, y] > TH: y += 1            # 穿過頭髮
        ys.append(y)
    ys.sort()
    return ys[len(ys) // 2] / H


def head_geo(im):
    """頭的幾何：頭頂、下巴（脖子以上）、頭殼寬（上半部最寬，不含耳朵）、中心 x（皆為圖片 px）"""
    al = im.getchannel('A').load(); W, H = im.size
    rows = []
    for y in range(H):
        xs = [x for x in range(0, W, 1) if al[x, y] > TH]
        rows.append((xs[0], xs[-1]) if xs else None)
    top = next(y for y in range(H) if rows[y])
    mw = max((r[1] - r[0]) for r in rows if r)
    nb = next(y for y in range(H - 1, 0, -1) if rows[y])            # 脖子底
    ny = int(nb - (nb - top) * 0.08)                                 # 脖子中段（避開最底下收尾的描邊）
    while ny > top and not rows[ny]:
        ny -= 1
    neckW = rows[ny][1] - rows[ny][0]
    chin = ny
    for y in range(ny, top, -1):                 # 從脖子最細處往上：比脖子寬 1.6 倍的那排＝下巴最低點
        if rows[y] and rows[y][1] - rows[y][0] > neckW * 1.6:
            chin = y; break
    lim = top + int((chin - top) * 0.42)
    best = max(((rows[y][1] - rows[y][0], y) for y in range(top, lim) if rows[y]))
    y = best[1]
    cx = (rows[y][0] + rows[y][1]) / 2
    # 臉輪廓：每個高度從中線往外掃，碰到描邊（暗）或透明就是臉邊界；耳朵在描邊外面不算
    px = im.load()
    def edge(yy, step):
        x = int(cx)
        while 0 <= x < W:
            r, g, b, a = px[x, yy]
            if a <= TH or (0.3 * r + 0.59 * g + 0.11 * b) < 90:
                return x
            x += step
        return x
    prof = []
    for k in range(25):
        yy = int(top + 4 + (chin - top - 4) * k / 24)
        prof.append([yy, edge(yy, -1), edge(yy, 1)])
    return {'top': top, 'chin': chin, 'sw': best[0], 'cx': cx, 'W': W, 'H': H, 'prof': prof}


def main():
    man_path = os.path.join(ROOT, 'lib', 'manifest.json')
    man = json.load(open(man_path, encoding='utf-8'))
    P = os.path.join(ROOT, 'parts')
    o_hf, o_hb = Image.open(f'{P}/hair_front.png'), Image.open(f'{P}/hair_back.png')
    o_head, o_face = Image.open(f'{P}/head.png'), Image.open(f'{P}/face_smug.png')
    # 原圖：瀏海最寬排在 hair_front 圖內的位置（原圖座標）
    ref_f, ref_b = fit_anchor(o_hf), fit_anchor(o_hb)
    print('原圖頭殼弧圓心', [round(v) for v in ref_f], [round(v) for v in ref_b])
    scales = {}
    # 頭髮比例：以 bangs（齊瀏海＝原圖同款）換算
    for cat in ('hair_m', 'hair_f'):
        if cat not in man:
            continue
        base = man['hair_m'].get('bangs', {}).get('front')
        scales[cat] = o_hf.width / base['w'] if base else 1.27
    if 'face_m' in man or 'face_f' in man:
        ws = [v['smug']['w'] for c in ('face_m', 'face_f') for v in man.get(c, {}).values() if v.get('smug')]
        ws.sort(); scales['face'] = o_face.width / ws[len(ws) // 2]
    if 'head' in man:
        ws = sorted(v['w'] for v in man['head'].values()); scales['head'] = o_head.width / ws[len(ws) // 2]
    if 'acc' in man:
        scales['acc'] = scales.get('face', 1.0)
    print('比例', {k: round(v, 3) for k, v in scales.items()})
    hcy, hcx, head_r0 = fit_anchor(o_head)
    fix = json.load(open(os.path.join(ROOT, 'lib', 'fix.json'), encoding='utf-8'))

    # 每張表各自的比例：用頭殼弧半徑換算（取該表所有前髮的中位數）
    ref_r = fit_anchor(o_hf)[2]
    per_sheet = {}
    for cat in ('hair_m', 'hair_f'):
        for iid, e in man.get(cat, {}).items():
            fr = e.get('front')
            if fr:
                r = fit_anchor(Image.open(os.path.join(ROOT, fr['file'])))[2]
                per_sheet.setdefault(e['sheet'], []).append(ref_r / r)
    sheet_scale = {k: sorted(v)[len(v) // 2] for k, v in per_sheet.items()}
    print('各表比例', {k: round(v, 3) for k, v in sheet_scale.items()})

    for cat, items in man.items():
        for iid, e in items.items():
            for layer in ('front', 'back'):
                info = e.get(layer)
                if not info or not cat.startswith('hair'):
                    continue
                im = Image.open(os.path.join(ROOT, info['file']))
                cy, cx, _r = fit_anchor(im)
                info['scale'] = sheet_scale.get(e['sheet'], scales[cat])
                if layer == 'front':
                    info['hairline'] = hairline(im)
                info['ay'] = cy / im.height
                info['ax'] = cx / im.width
                fx = fix.get(cat, {}).get(iid, {})
                if layer == 'front' and 'fay' in fx: info['ay'] = fx['fay']   # 直接指定錨點（擬合失敗的款式）
                if layer == 'back' and 'bay' in fx: info['ay'] = fx['bay']
                info['dy'] = fx.get('dy', 0) if layer == 'front' else fx.get('bdy', 0)
                info['dx'] = fx.get('dx', 0) if layer == 'front' else fx.get('bdx', 0)
                e['long'] = bool(fx.get('long', cat == 'hair_f'))
            for layer in ('smug', 'hurt'):
                if e.get(layer):
                    e[layer]['scale'] = scales.get('face', 1)
                    f = e[layer]['file']; src = os.path.join(ROOT, f)
                    sp = split_mouth(Image.open(src).convert('RGBA'))
                    if sp:
                        ef, mf = f.replace('.png', '_eyes.png'), f.replace('.png', '_mouth.png')
                        sp[0].save(os.path.join(ROOT, ef)); sp[1].save(os.path.join(ROOT, mf))
                        e[layer]['eyes'] = ef
                        e[layer]['eyebox'] = sp[2].pop('eyes')
                        e[layer]['mouth'] = dict(sp[2], file=mf, mw=sp[1].width, mh=sp[1].height)
                    else:
                        e[layer].pop('eyes', None); e[layer].pop('mouth', None)
            if cat == 'head':
                e['scale'] = scales['head']         # 整張表同一比例；頭頂對齊原頭頭頂（avatar.js）
                e['geo'] = head_geo(Image.open(os.path.join(ROOT, e['file'])))
            if cat == 'acc':
                e['scale'] = scales['acc']
    # 原圖瀏海最寬排在 head 座標：hair_front 放在 head (0,-232)、ay=0 → 最寬排 y = -232 + ref_f[0]*unit
    # ---------- 分部位鬍子：每張表一個比例（一般八字鬍寬 ≈ 88 單位＝原嘴寬 1.3 倍）----------
    bz = {}
    for iid, e in man.get('beard', {}).items():
        if iid.startswith('up_'):
            bz.setdefault(e['sheet'], []).append(e['w'])
    for iid, e in man.get('beard', {}).items():
        ws = sorted(bz.get(e['sheet'], [e['w']]))
        e['k'] = 88.0 / ws[len(ws) // 2]

    # ---------- 身體：上衣去袖＋拆前領層；整張表比例以原上衣（含袖）寬換算 ----------
    sys.path.insert(0, ROOT)
    from slice_grid import strip_sleeves, make_collar
    import io, contextlib
    o_torso_full = 338   # 原上衣含袖寬（parts_sheet_polo 切出、去袖前）
    body_sheet_scale = {}
    for cat in ('body_m', 'body_f'):
        for iid, e in man.get(cat, {}).items():
            t = e.get('torso')
            if not t:
                continue
            if 'rawW' not in t:
                t['rawW'] = t['w']
            if iid == 'std':
                body_sheet_scale[e['sheet']] = o_torso_full / t['rawW']
    for cat in ('body_m', 'body_f'):
        for iid, e in man.get(cat, {}).items():
            sc = body_sheet_scale.get(e['sheet']) or body_sheet_scale.get('M-BODY-1') or 1.0
            t = e.get('torso')
            if t:
                raw = os.path.join(ROOT, t['file'].replace('_torso.png', '_torso_raw.png'))
                src = os.path.join(ROOT, t['file'])
                if not os.path.exists(raw):
                    os.replace(src, raw)
                with contextlib.redirect_stdout(io.StringIO()):
                    st = strip_sleeves(Image.open(raw).convert('RGBA'))
                    col = make_collar(st)
                st.save(src); t['w'], t['h'] = st.size
                if col:
                    cf = t['file'].replace('_torso.png', '_collar.png'); col.save(os.path.join(ROOT, cf)); e['collar'] = {'file': cf}
                else:
                    e.pop('collar', None)
            for k in ('torso', 'armL', 'armR', 'legs'):
                if e.get(k):
                    e[k]['scale'] = sc
    print('身體比例', {k: round(v, 3) for k, v in body_sheet_scale.items()})

    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 原臉也拆成眼睛＋嘴巴（之後五官比例調整對原臉也有效）
    orig_faces = {}
    for layer, fn in (('smug', 'face_smug'), ('hurt', 'face_hurt')):
        eyes, mo, info = split_mouth(Image.open(f'{P}/{fn}.png').convert('RGBA'))
        eyes.save(f'{P}/{fn}_eyes.png'); mo.save(f'{P}/{fn}_mouth.png')
        orig_faces[layer] = {'eyes': f'parts/{fn}_eyes.png', 'mouth': f'parts/{fn}_mouth.png', 'eyebox': info.pop('eyes'), 'm': info}
    meta = {'refFront': ref_f[0] / o_hf.height, 'refBack': ref_b[0] / o_hb.height,
            'headSky': hcy / o_head.height, 'headW': o_head.width, 'headH': o_head.height,
            'headGeo': head_geo(o_head), 'hairlineFront': hairline(o_hf),
            'face': orig_faces,
            'beardPos': json.load(open(os.path.join(ROOT, 'lib', 'beard_pos.json'), encoding='utf-8'))}
    with open(os.path.join(ROOT, 'lib', 'manifest.js'), 'w', encoding='utf-8') as f:
        f.write('window.STYLE_LIB = ' + json.dumps(man, ensure_ascii=False) + ';\n')
        f.write('window.STYLE_META = ' + json.dumps(meta) + ';\n')
    print('錨點已寫入', meta)

    # 預覽：每款男髮型套在原頭＋原臉上
    if len(sys.argv) > 1:
        U = 230 / o_head.width                    # 原圖 px → 角色座標
        Z = 1.0                                   # 角色座標 → 預覽 px
        cells = []
        for iid, e in man.get(sys.argv[2] if len(sys.argv) > 2 else 'hair_m', {}).items():
            c = Image.new('RGBA', (300, 330), (255, 236, 214, 255))
            hx, hy = 150, 300                     # head pivot（脖子底）
            def paste(im, cx, cy_top, sc):
                im2 = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))))
                c.alpha_composite(im2, (int(cx - im2.width / 2), int(cy_top)))
            # 原圖：hair_front 頂 = head y -232、寬 = 380*U；最寬排 head y：
            yf = -232 + ref_f[0] * U
            yb = -118 - o_hb.height * U / 2 + ref_b[0] * U
            for layer, yref in (('back', yb), ('front', None)):
                info = e.get(layer)
                if layer == 'front':
                    # 先畫頭和臉
                    hs = U
                    hh = o_head.resize((int(o_head.width * hs), int(o_head.height * hs)))
                    c.alpha_composite(hh, (int(hx - hh.width / 2), int(hy - 0.97 * hh.height)))
                    ff = o_face.resize((int(o_face.width * U), int(o_face.height * U)))
                    c.alpha_composite(ff, (int(hx - ff.width / 2), int(hy - 62 - ff.height / 2)))
                    yref = yf
                if not info:
                    continue
                im = Image.open(os.path.join(ROOT, info['file']))
                sc = info['scale'] * U
                top = hy + yref + info.get('dy', 0) - info['ay'] * im.height * sc
                if layer == 'back' and not e.get('long'):
                    clip_y = (hy + CLIP_Y) - top            # 下巴以上才保留（截在預覽縮放前的座標）
                    im = im.crop((0, 0, im.width, max(1, min(im.height, int(clip_y / sc)))))
                paste(im, hx + info.get('dx', 0) - (info['ax'] - 0.5) * im.width * sc, top, sc)
            cells.append((iid, c))
        cols = 6
        rows = (len(cells) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 300, rows * 330), (255, 255, 255))
        for i, (iid, c) in enumerate(cells):
            sheet.paste(c.convert('RGB'), ((i % cols) * 300, (i // cols) * 330))
        sheet.save(sys.argv[1])
        print('預覽', sys.argv[1], len(cells), '款')


if __name__ == '__main__':
    main()
