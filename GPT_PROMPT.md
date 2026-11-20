# GPT 九宮格部件提示詞

> 送出前：選「透明背景」選項。收到圖後用 `python slice_grid.py 下載的圖.png` 切，腳本會檢查角落 alpha，假透明（棋盤格）會警告 → 重出。

```
Create a character parts sheet for a 2D puppet game, on a fully TRANSPARENT background (real alpha channel, background alpha = 0, no checkerboard, no white, no color fill).

Character: a chibi (super-deformed, 2-head-tall) cute boy with a very smug, cocky, arrogant attitude.
Hair: short black hair with straight-cut blunt bangs at eyebrow level.
Outfit: T-shirt whose upper part is dark navy blue and lower part is white, with short sleeves in the same dark navy blue as the shirt's upper part; dark navy blue shorts; white sneakers.
Style: clean anime chibi illustration, bold dark outlines, flat cel shading, front view, facing the camera.

Layout: a 3x3 grid of equal square cells (no grid lines, no labels, no text). Each cell contains ONE separate body part, centered, with generous empty transparent padding; nothing touches the cell borders. All parts drawn at the SAME scale, as if they come from the same assembled character, so they can be reassembled in code.

Row 1:
1. Front hair only: the top hair cap with the straight blunt bangs and short sideburns. No face, no skin.
2. Back hair only: the rear hair mass that sits behind the head. No face, no skin.
3. Bald head base: blank skin head with ears and a short neck, NO eyes, NO eyebrows, NO mouth, NO hair.

Row 2:
4. Smug face features only (floating on transparent): half-lidded cocky eyes, one eyebrow raised, smirking one-sided grin. No skin, no head outline.
5. Hurt face features only (floating on transparent): squeezed shut ><-shaped eyes, tears, wavy open mouth in pain. No skin, no head outline.
6. Torso only: the T-shirt body (navy upper, white lower), no arms, no head, no legs, neck opening visible.

Row 3:
7. Arm on the viewer's left side: dark navy short sleeve plus bare arm and hand, hanging down, separate from the body.
8. Arm on the viewer's right side: dark navy short sleeve plus bare arm and hand, hanging down, separate from the body.
9. Lower body: dark navy shorts with both legs and white sneakers, standing pose.

Transparent background, alpha 0 everywhere outside the parts.
```
