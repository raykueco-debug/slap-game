"""把 GPT 九宮格部件圖切成 parts/*.png（自動裁掉透明邊）
用法：python slice_grid.py 九宮格.png
順序須對應 GPT_PROMPT.md 的格子順序。

不是死切格線：先找出每一塊相連的圖形，依「該塊大部分像素落在哪一格」歸格，
所以 GPT 畫越過格線的部分（例如脖子）會跟著本體走，不會被切到隔壁格。
另外從 torso 拆出 torso_collar.png（前領層），讓脖子能插在前領之後、後領之前。
"""
import os
import sys
from collections import deque
from PIL import Image

NAMES = ['hair_front', 'hair_back', 'head',
         'face_smug', 'face_hurt', 'torso',
         'arm_left', 'arm_right', 'legs']
TH = 8  # alpha 門檻


def label(alpha, W, H):
    """相連元件標記（8 鄰接），回傳 labels list 與每塊各格像素數"""
    a = alpha.load()
    lab = [0] * (W * H)
    comps = []
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if lab[i] or a[x, y] <= TH:
                continue
            cid = len(comps) + 1
            cells = [0] * 9
            q = deque([(x, y)])
            lab[i] = cid
            while q:
                px, py = q.popleft()
                cells[min(2, py * 3 // H) * 3 + min(2, px * 3 // W)] += 1
                for dy in (-1, 0, 1):
                    ny = py + dy
                    if ny < 0 or ny >= H:
                        continue
                    for dx in (-1, 0, 1):
                        nx = px + dx
                        if nx < 0 or nx >= W:
                            continue
                        j = ny * W + nx
                        if not lab[j] and a[nx, ny] > TH:
                            lab[j] = cid
                            q.append((nx, ny))
            comps.append(cells)
    return lab, comps


def strip_sleeves(torso):
    """切掉衣服本身的袖子：只留身體寬度（以下襬那排的寬度為準），袖子交給手臂部件"""
    W, H = torso.size
    px = torso.load()
    y = int(H * 0.9)
    xs = [x for x in range(W) if px[x, y][3] > TH]
    L, R = xs[0] - 2, xs[-1] + 2
    out = torso.copy()
    o = out.load()
    for yy in range(H):
        for x in list(range(0, max(0, L))) + list(range(min(W, R + 1), W)):
            o[x, yy] = (0, 0, 0, 0)
    print(f'  torso: 去袖，保留 x {L}-{R}')
    return out.crop(out.getchannel('A').getbbox())


def polo_details(torso):
    """Polo 細節（座標對應 parts_sheet_polo.png 去袖後的 torso）：
    翻領外緣紅白滾線、釦排往下延伸略超過深藍段。4 倍超取樣後縮回，邊緣才平滑。"""
    from PIL import ImageDraw
    Z = 4
    W, H = torso.size
    ov = Image.new('RGBA', (W * Z, H * Z), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    P = lambda pts: [(x * Z, y * Z) for x, y in pts]
    mir = lambda pts: [(W - 1 - x, y) for x, y in pts]
    NAVY, LINE, RED, WHITE = (34, 44, 91, 255), (20, 18, 28, 255), (214, 40, 52, 255), (248, 248, 246, 255)
    # 釦排：V 領尖往下到深藍段下緣再多一點
    x0, x1, y0, y1 = 109, 125, 104, 158
    d.rounded_rectangle([x0 * Z, y0 * Z, x1 * Z, y1 * Z], radius=3 * Z, fill=NAVY, outline=LINE, width=int(1.8 * Z))
    for by in (120, 137):
        d.ellipse([(117 - 2.6) * Z, (by - 2.6) * Z, (117 + 2.6) * Z, (by + 2.6) * Z], fill=WHITE, outline=LINE, width=Z)
    # 翻領滾線：外側紅、內側白
    red = [(50, 33), (50, 70), (79, 55)]
    white = [(54, 35), (54, 66), (79, 51)]
    for pts, col in ((red, RED), (white, WHITE)):
        for side in (pts, mir(pts)):
            d.line(P(side), fill=col, width=int(2.2 * Z), joint='curve')
    ov = ov.resize((W, H), Image.LANCZOS)
    out = torso.copy()
    out.alpha_composite(ov)
    return out


def hole_mask(torso):
    """領口洞內側（深藍、很暗、偏藍）：從上緣中央往下長出相連區域"""
    W, H = torso.size
    px = torso.load()
    dark = lambda x, y: px[x, y][3] > 200 and px[x, y][2] > px[x, y][0] + 12 and sum(px[x, y][:3]) < 110
    seeds = [(x, y) for y in range(int(H * 0.2)) for x in range(int(W * 0.4), int(W * 0.6)) if dark(x, y)]
    if not seeds:
        return None
    m = set(seeds)
    q = deque(seeds)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < int(H * 0.5) and (nx, ny) not in m and dark(nx, ny):
                m.add((nx, ny)); q.append((nx, ny))
    return m


def make_collar(torso):
    """前領層＝洞以外、洞頂往下一小段開始的衣服（翻領、V 領邊、前領）。
    繪製順序 torso（含後領）→ head（脖子蓋住洞內和後領）→ torso_collar（前領蓋回脖子）"""
    W, H = torso.size
    px = torso.load()
    m = hole_mask(torso)
    if not m:
        print('  torso_collar: 找不到領口洞，略過')
        return None
    ys = [p[1] for p in m]; xs = [p[0] for p in m]
    top, bot = min(ys), max(ys)
    cut = top + max(4, int((bot - top) * 0.12))   # 這條線以上＝後領，不放進前領層
    grow = set()
    for (x, y) in m:  # 洞往外擴 1px，避免洞邊殘留暗線蓋住脖子
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                grow.add((x + dx, y + dy))
    out = Image.new('RGBA', torso.size, (0, 0, 0, 0))
    o = out.load()
    for y in range(cut, H):
        for x in range(W):
            if (x, y) not in grow and px[x, y][3] > 0:
                o[x, y] = px[x, y]
    print(f'  torso_collar: 洞 x {min(xs)}-{max(xs)} y {top}-{bot}，後領線 y<{cut}')
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    if len(sys.argv) < 2:
        print(__doc__)
        return
    im = Image.open(sys.argv[1]).convert('RGBA')
    W, H = im.size
    a = im.getchannel('A')
    corners = [a.getpixel(p) for p in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3), (W // 2, 2)]]
    if max(corners) > 0:
        print(f'⚠ 角落 alpha = {corners}：不是真透明（可能是棋盤格／白底），請叫 GPT 重出')
        if '--force' not in sys.argv:
            return
    print('標記相連圖形中…')
    lab, comps = label(a, W, H)
    owner = [0] + [max(range(9), key=lambda c: cells[c]) for cells in comps]
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'parts')
    os.makedirs(out, exist_ok=True)
    src = im.load()
    for k, name in enumerate(NAMES):
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dst = layer.load()
        for y in range(H):
            row = y * W
            for x in range(W):
                c = lab[row + x]
                if c and owner[c] == k:
                    dst[x, y] = src[x, y]
        # 門檻以下的淡邊（抗鋸齒）補回：同格內、緊鄰已收像素的半透明點
        bb = layer.getchannel('A').getbbox()
        if not bb:
            print(f'  {name}: 空格，略過')
            continue
        x0, y0, x1, y1 = bb
        x0, y0, x1, y1 = max(0, x0 - 2), max(0, y0 - 2), min(W, x1 + 2), min(H, y1 + 2)
        for y in range(y0, y1):
            for x in range(x0, x1):
                if dst[x, y][3] == 0 and 0 < src[x, y][3] <= TH:
                    near = any(dst[min(W - 1, max(0, x + dx)), min(H - 1, max(0, y + dy))][3] > TH
                               for dx in (-1, 0, 1) for dy in (-1, 0, 1))
                    if near:
                        dst[x, y] = src[x, y]
        part = layer.crop(layer.getchannel('A').getbbox())
        if name == 'torso':
            part = strip_sleeves(part)
            if 'polo' in os.path.basename(sys.argv[1]):
                part = polo_details(part)
        part.save(os.path.join(out, name + '.png'))
        print(f'  {name}: {part.size}')
        if name == 'torso':
            col = make_collar(part)
            if col:
                col.save(os.path.join(out, 'torso_collar.png'))
    print('完成 →', out)


if __name__ == '__main__':
    main()
