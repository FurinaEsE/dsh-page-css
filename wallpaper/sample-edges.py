"""Sample the wallpaper's edges.

The user wants the image bottom-aligned with the window's bottom and the
uncovered band filled with the image's own background colour. That only works
seamlessly if the image's TOP edge is actually background rather than artwork —
otherwise the filled band meets the portrait's head with a hard seam.

So: report the tone of the top rows, the bottom rows, and the left/right edges,
plus how far down the first non-background pixel is.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# 默认采样 dsh-any-background 当前正在用的那张壁纸；也可以直接传一个文件。
# 用法: sample-edges.py [图片]
DEFAULT = Path.home() / ".dsh" / ".dsh-any-background-data" / "wallpaper.jpg"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
if not SRC.exists():
    raise SystemExit(f"找不到图片: {SRC}")

im = Image.open(SRC).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32)
print(f"image    : {W}x{H}  ratio {W/H:.3f}")

def row(y):
    return np.round(a[y].mean(axis=0)).astype(int).tolist()

def col(x):
    return np.round(a[:, x].mean(axis=0)).astype(int).tolist()

print(f"top row 0   : {row(0)}")
print(f"top row 4   : {row(4)}")
print(f"top row 20  : {row(20)}")
print(f"top row 60  : {row(60)}")
print(f"mid row     : {row(H // 2)}")
print(f"bot row -60 : {row(H - 60)}")
print(f"bot row -20 : {row(H - 20)}")
print(f"bot row -1  : {row(H - 1)}")
print(f"left col 0  : {col(0)}")
print(f"right col -1: {col(W - 1)}")

# Where does the top stop being flat background?
ref = a[0].mean(axis=0)
diffs = np.abs(a - ref).sum(axis=2)          # per-pixel distance from the top-row tone
rowdev = diffs.mean(axis=1)
first = next((y for y in range(H) if rowdev[y] > 12), None)
print(f"first row deviating >12 from the top tone: {first}  (={None if first is None else round(first/H*100,1)}% down)")

# The colour a filled band must match: the top rows' mean.
band = np.round(a[0:6].reshape(-1, 3).mean(axis=0)).astype(int)
print(f"suggested fill colour (top 6 rows mean): {band.tolist()}  #{band[0]:02x}{band[1]:02x}{band[2]:02x}")
