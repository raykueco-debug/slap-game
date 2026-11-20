"""32 款鬍子套在原頭＋原臉（拆開的眼睛＋嘴巴）上的預覽；定位數值讀 lib/beard_pos.json"""
import json, sys
from PIL import Image
U = 230 / 377; Z = 1.6
man = json.load(open('lib/manifest.json', encoding='utf-8'))
pos = json.load(open('lib/beard_pos.json', encoding='utf-8'))
head = Image.open('parts/head.png'); eyes = Image.open('parts/face_smug_eyes.png'); mouth = Image.open('parts/face_smug_mouth.png')
mx, my = 11.0 * U, 54.0 * U      # 嘴中心（face 座標）
cells = []
for bid, p in pos.items():
    if bid.startswith('_') or bid not in man['acc']: continue
    c = Image.new('RGBA', (int(300 * Z * 0.75), int(380 * Z * 0.75)), (255, 236, 214, 255))
    S = Z * 0.75; hx, hy = c.width / 2, 300 * S        # head pivot
    def put(im, cx, cy, w, ay=0.5):
        h = w * im.height / im.width
        im2 = im.resize((max(1, int(w * S)), max(1, int(h * S))))
        c.alpha_composite(im2, (int(hx + (cx - w / 2) * S), int(hy + (cy - ay * h) * S)))
    put(head, 0, 0, 230, 0.97)
    fy = -62
    put(eyes, 0, fy, 260 * U, 0.5)
    b = Image.open(man['acc'][bid]['file']).convert('RGBA')
    g = Image.new('RGBA', b.size, (0, 0, 0, 0)); px = b.load(); gp = g.load()
    for y in range(b.height):
        for x in range(b.width):
            r, gg, bb, a = px[x, y]; l = (r + gg + bb) / 3
            gp[x, y] = (int(l * 0.35), int(l * 0.28), int(l * 0.25), a) if a else (0, 0, 0, 0)
    chin_f = (-227.2 + 342 * U)                     # 原頭下巴（head 座標）
    put(g, mx if p.get('at') != 'chin' else 0, (fy + my) if p.get('at') != 'chin' else chin_f, p['w'], p['ay'])
    put(mouth, mx, fy + my, 112 * U, 0.5)
    cells.append(c)
cols = 8; W0, H0 = cells[0].size
out = Image.new('RGB', (cols * W0, ((len(cells) + cols - 1) // cols) * H0), (255, 255, 255))
for i, c in enumerate(cells): out.paste(c.convert('RGB'), ((i % cols) * W0, (i // cols) * H0))
out.save(sys.argv[1]); print(len(cells))
