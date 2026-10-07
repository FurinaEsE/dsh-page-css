"""Rebuild the wallpaper WIDER so the host can pan it without any scaling.

Why: `dsh-any-background` paints the wallpaper as `background-image` on a
`position:fixed; inset:0` element with `background-size: cover` and
`background-position: center`. Aligning the image's centre with the conversation
column's centre is therefore just a matter of shifting `background-position` —
but `cover` only leaves ±5.5% of horizontal slack for a 16:9 image in a 1.6-ratio
window, and the column offset here is ~8.7%.

Widening the image is the fix: the sides are the portrait's own (uniform)
background, so extending the canvas horizontally costs nothing and buys the pan
range. At 3200x1440 the cover scale is still height-driven, so the portrait's
on-screen size is unchanged; the slack becomes ±19% of the window instead.

Same recipe as the dark seamless version: canvas rows filled from the portrait's
own edge columns (no invented colour), portrait centred, uniform dark grade.
"""
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent

# 源图默认用仓库自带的那张，所以本脚本可以独立运行。
# 想换图：compose-wide.py <源图> [输出文件]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "assets" / "accent-thinking-girl.png"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.gettempdir()) / "wallpaper-wide.jpg"

if not SRC.exists():
    raise SystemExit(f"找不到源图: {SRC}")

W, H = 3200, 1440          # 2.22:1 -> plenty of pan slack under `cover`
SUBJ_H = 1620              # unchanged, so the on-screen portrait size is unchanged
SUBJ_X = (W - SUBJ_H) // 2  # centred
SUBJ_Y = -95
EDGE = 6
GRADE = 0.30
VIGNETTE = 0.18
CONTRAST = 1.12

src = Image.open(SRC).convert("RGB")
subj = src.resize((SUBJ_H, SUBJ_H), Image.LANCZOS)

arr = np.asarray(subj).astype(np.float32)
edge = (arr[:, 0:EDGE, :].mean(axis=1) + arr[:, -EDGE:, :].mean(axis=1)) / 2.0

rows = np.zeros((H, 3), dtype=np.float32)
for y in range(H):
    rows[y] = edge[min(max(y - SUBJ_Y, 0), SUBJ_H - 1)]
canvas = np.repeat(rows[:, None, :], W, axis=1)

src_y0 = max(0, -SUBJ_Y)
dst_y0 = max(0, SUBJ_Y)
copy_h = min(SUBJ_H - src_y0, H - dst_y0)
src_x0 = max(0, -SUBJ_X)
dst_x0 = max(0, SUBJ_X)
copy_w = min(SUBJ_H - src_x0, W - dst_x0)
canvas[dst_y0:dst_y0 + copy_h, dst_x0:dst_x0 + copy_w] = arr[src_y0:src_y0 + copy_h, src_x0:src_x0 + copy_w]

# uniform dark grade (identical to the dark seamless version)
canvas = canvas / 255.0 * GRADE
canvas = np.clip((canvas - 0.5 * GRADE) * CONTRAST + 0.5 * GRADE, 0.0, 1.0)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = xx / (W - 1), yy / (H - 1)
d = np.sqrt(((u - 0.5) * (W / H)) ** 2 + (v - 0.5) ** 2)
canvas *= np.clip(1.0 - VIGNETTE * np.clip(d / 0.62, 0, 1) ** 1.6, 0.0, 1.0)[..., None]

out = np.clip(canvas * 255.0, 0, 255).astype(np.uint8)
Image.fromarray(out, "RGB").save(OUT, "JPEG", quality=93, optimize=True, subsampling=1)

lum = 0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2]
print(f"canvas    : {W}x{H}  ratio {W / H:.2f}")
print(f"portrait  : x={SUBJ_X}..{SUBJ_X + SUBJ_H}  centre={SUBJ_X + SUBJ_H // 2}  (canvas centre={W // 2})")
print(f"luma      : mean {lum.mean():.1f}  max {lum.max():.1f}")
print(f"saved     : {OUT}")
