"""把 GPT 4x4 造型素材切成 lib/<類別>/<id>.png，並更新 lib/manifest.js
用法：python slice_lib.py sheets/M-HAIR-1.png M-HAIR-1
相連圖形依「大部分像素落在哪一格」歸格（越過格線的部分跟著本體走）。
"""
import json
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from slice_grid import label, TH  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))

# 每張表 16 格的用途：(類別, id, 中文名, 層) ；層：front/back/smug/hurt/None
def pairs(cat, items, a, b):
    out = []
    for iid, name in items:
        out += [(cat, iid, name, a), (cat, iid, name, b)]
    return out

SHEETS = {
    'M-HAIR-1': pairs('hair_m', [('bangs', '齊瀏海'), ('crop', '短碎髮'), ('side', '旁分'), ('middle', '中分'),
                                 ('spiky', '刺蝟頭'), ('buzz', '平頭'), ('curly', '短捲髮'), ('slick', '油頭')], 'front', 'back'),
    'M-HAIR-2': pairs('hair_m', [('comma', '逗號瀏海'), ('undercut', '兩側剃短'), ('mohawk', '莫霍克'), ('manbun', '男生丸子頭'),
                                 ('medium', '及肩中長髮'), ('afro', '爆炸頭'), ('dreads', '雷鬼辮'), ('balding', '地中海')], 'front', 'back'),
    'M-HAIR-3': pairs('hair_m', [('business', '西裝側分'), ('pompadour', '飛機頭'), ('bowl', '鍋蓋頭'), ('wolf', '狼尾'),
                                 ('wavy', '中長捲髮'), ('cornrow', '玉米辮'), ('fade', '漸層寸頭'), ('perm', '泡麵燙')], 'front', 'back'),
    'M-FACE-1': pairs('face_m', [('narrow', '細長眼'), ('round', '圓大眼'), ('droopy', '下垂眼'), ('sharp', '吊眼'),
                                 ('squint', '瞇瞇眼'), ('monolid', '單眼皮'), ('bold', '濃眉大眼'), ('sanpaku', '三白眼')], 'smug', 'hurt'),
    'M-FACE-2': pairs('face_m', [('dot', '豆豆眼'), ('deadfish', '死魚眼'), ('uneven', '大小眼'), ('hawk', '鷹眼'),
                                 ('double', '雙眼皮大眼'), ('fox', '狐狸眼'), ('bucktooth', '暴牙'), ('lips', '厚唇')], 'smug', 'hurt'),
    'HEAD': [('head', i, n, None) for i, n in [
        ('m_round', '圓臉'), ('m_oval', '鵝蛋臉'), ('m_long', '長臉'), ('m_square', '方臉'),
        ('m_wide', '寬臉'), ('m_pointed', '尖下巴'), ('m_ears', '大耳朵'), ('m_jaw', '國字臉'),
        ('f_round', '圓臉'), ('f_oval', '鵝蛋臉'), ('f_long', '長臉'), ('f_v', '瓜子臉'),
        ('f_heart', '心形臉'), ('f_wide', '寬臉'), ('f_pointed', '尖下巴'), ('f_chubby', '嬰兒肥')]],
    'ACC-1': [('acc', i, n, None) for i, n in [
        ('g_round', '圓框眼鏡'), ('g_square', '方框眼鏡'), ('g_half', '半框眼鏡'), ('g_thick', '粗黑框'),
        ('g_cat', '貓眼框'), ('g_sun', '墨鏡'), ('g_aviator', '飛行員墨鏡'), ('g_monocle', '單邊眼鏡'),
        ('b_stubble', '鬍渣'), ('b_mustache', '八字鬍'), ('b_handlebar', '翹八字鬍'), ('b_goatee', '山羊鬍'),
        ('b_full', '落腮鬍'), ('b_boxed', '短方鬍'), ('b_chinstrap', '鬢角連鬍'), ('b_soul', '下巴小鬍')]],
    'ACC-2': [('acc', i, n, None) for i, n in [
        ('h_cap', '棒球帽'), ('h_capback', '反戴棒球帽'), ('h_beanie', '毛帽'), ('h_bucket', '漁夫帽'),
        ('h_sweatband', '運動頭帶'), ('h_hairband', '髮箍'), ('h_bow', '蝴蝶結'), ('h_clip', '髮夾'),
        ('e_hoop', '大圈耳環'), ('e_pearl', '珍珠耳環'), ('n_chain', '金項鍊'), ('f_mole', '痣'),
        ('f_freckles', '雀斑'), ('f_scar', '疤痕'), ('f_bandage', 'OK 繃'), ('h_headphones', '耳罩耳機')]],
    'F-HAIR-1': pairs('hair_f', [('longbangs', '長直髮齊瀏海'), ('hime', '公主切'), ('bob', '鮑伯頭'), ('ponyhigh', '高馬尾'),
                                 ('twintail', '雙馬尾'), ('bun', '丸子頭'), ('wavylong', '大波浪'), ('pixie', '精靈短髮')], 'front', 'back'),
    'F-HAIR-2': pairs('hair_f', [('ponylow', '低馬尾'), ('spacebuns', '雙丸子頭'), ('sidepony', '側馬尾'), ('braid', '單麻花辮'),
                                 ('twinbraid', '雙麻花辮'), ('flip', '中長外翻'), ('frenchcurl', '法式瀏海長捲'), ('halfup', '半紮公主頭')], 'front', 'back'),
    'F-HAIR-3': pairs('hair_f', [('shoulder', '及肩中分'), ('curtain', '八字瀏海長髮'), ('airy', '空氣瀏海短髮'), ('wolf', '狼尾'),
                                 ('fro', '爆炸捲'), ('verylong', '超長直髮'), ('drill', '公主捲'), ('shortcurl', '短捲髮')], 'front', 'back'),
    'F-FACE-1': pairs('face_f', [('lashes', '大眼長睫毛'), ('cat', '貓眼'), ('droopy', '下垂眼'), ('squint', '瞇瞇眼'),
                                 ('monolid', '單眼皮'), ('round', '圓眼'), ('makeup', '濃妝眼線'), ('almond', '淡妝杏眼')], 'smug', 'hurt'),
    'F-FACE-2': pairs('face_f', [('dot', '豆豆眼'), ('deadfish', '死魚眼'), ('fox', '狐狸眼'), ('star', '星星眼'),
                                 ('lips', '厚唇'), ('cherry', '櫻桃小嘴'), ('lashesheavy', '濃妝假睫毛'), ('dimple', '酒窩笑')], 'smug', 'hurt'),
}
def body(cat, items):
    out = []
    for iid, name in items:
        out += [(cat, iid, name, l) for l in ('torso', 'armL', 'armR', 'legs')]
    return out
SHEETS['M-BODY-1'] = body('body_m', [('std', '標準'), ('chubby', '胖'), ('slim', '瘦'), ('strong', '壯')])
SHEETS['M-BODY-2'] = body('body_m', [('belly', '大肚腩'), ('short', '矮小'), ('tall', '高瘦'), ('muscle', '肌肉猛男')])
SHEETS['F-BODY-1'] = body('body_f', [('std', '標準'), ('chubby', '胖'), ('slim', '瘦'), ('tall', '高挑')])
SHEETS['F-BODY-2'] = body('body_f', [('short', '矮小'), ('petite', '嬌小'), ('sporty', '運動型'), ('pear', '梨形')])


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    src, key = sys.argv[1], sys.argv[2]
    spec = SHEETS[key]
    im = Image.open(src).convert('RGBA')
    W, H = im.size
    a = im.getchannel('A')
    corners = [a.getpixel(p) for p in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3)]]
    if max(corners) > 0:
        print(f'⚠ 角落 alpha = {corners}：不是真透明，請重出'); return
    lab, comps = label(a, W, H)
    # 依 4x4 重新算各塊歸屬
    cnt = {}
    al = a.load()
    for y in range(H):
        cy = min(3, y * 4 // H)
        row = y * W
        for x in range(W):
            c = lab[row + x]
            if c:
                k = (c, cy * 4 + min(3, x * 4 // W))
                cnt[k] = cnt.get(k, 0) + 1
    owner, total, second = {}, {}, {}
    for (c, cell), n in cnt.items():
        total[c] = total.get(c, 0) + n
        if c not in owner or n > cnt[(c, owner[c])]:
            owner[c] = cell
    for (c, cell), n in cnt.items():
        if cell != owner[c]:
            second[c] = max(second.get(c, 0), n)
    # 兩格黏在一起（第二大格佔 20% 以上）→ 沿格線切開
    split = {c for c in owner if second.get(c, 0) > total[c] * 0.2}
    if split:
        print(f'  有 {len(split)} 塊跨格黏在一起，沿格線切開')
    src_px = im.load()
    man_path = os.path.join(ROOT, 'lib', 'manifest.json')
    man = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {}
    for k, (cat, iid, name, layer) in enumerate(spec):
        layer_im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dst = layer_im.load()
        for y in range(H):
            row = y * W
            for x in range(W):
                c = lab[row + x]
                if not c:
                    continue
                cell = (min(3, y * 4 // H) * 4 + min(3, x * 4 // W)) if c in split else owner.get(c)
                if cell == k:
                    dst[x, y] = src_px[x, y]
        bb = layer_im.getchannel('A').getbbox()
        entry = man.setdefault(cat, {}).setdefault(iid, {'name': name, 'sheet': key})
        if not bb:
            print(f'  {cat}/{iid} {layer or ""}: 空格')
            if layer:
                entry[layer] = None
            continue
        part = layer_im.crop(bb)
        os.makedirs(os.path.join(ROOT, 'lib', cat), exist_ok=True)
        fn = f'{iid}_{layer}.png' if layer else f'{iid}.png'
        part.save(os.path.join(ROOT, 'lib', cat, fn))
        # 記錄在原表的位置（同一張表的前後髮對位用）與格子大小（換算比例用）
        info = {'file': f'lib/{cat}/{fn}', 'w': part.width, 'h': part.height,
                'cx': (bb[0] + bb[2]) / 2 - (k % 4 + 0.5) * W / 4, 'top': bb[1] - (k // 4) * H / 4,
                'cell': W / 4}
        if layer:
            entry[layer] = info
        else:
            entry.update(info)
        print(f'  {cat}/{fn}: {part.size}')
    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, 'lib', 'manifest.js'), 'w', encoding='utf-8') as f:
        f.write('window.STYLE_LIB = ' + json.dumps(man, ensure_ascii=False) + ';\n')
    print('manifest 已更新')


if __name__ == '__main__':
    main()
