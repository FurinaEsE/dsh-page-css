"""Generate a dark, low-contrast 2560x1440 background image for dsh-any-background.

Design goals: clearly dark (so light UI text reads well), soft structure only
(no high-frequency detail behind text), no banding (dithered grain).
"""
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 2560, 1440
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / "dark-bg.jpg"

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u = xx / (W - 1)
v = yy / (H - 1)

# --- base diagonal gradient: deep indigo -> near black -----------------------
base_top = np.array([20, 24, 42], dtype=np.float32)
base_bot = np.array([5, 6, 12], dtype=np.float32)
t = np.clip(0.65 * v + 0.35 * u, 0, 1)[..., None]
img = base_top[None, None, :] * (1 - t) + base_bot[None, None, :] * t

# --- glow 1: cool indigo, upper right ---------------------------------------
cx, cy, r = 0.70, 0.26, 0.55
d = np.sqrt(((u - cx) * (W / H)) ** 2 + (v - cy) ** 2)
glow = np.clip(1 - d / r, 0, 1) ** 2.2
img += glow[..., None] * np.array([34, 58, 118], dtype=np.float32)[None, None, :] * 0.55

# --- glow 2: faint teal, lower left -----------------------------------------
cx2, cy2, r2 = 0.12, 0.92, 0.50
d2 = np.sqrt(((u - cx2) * (W / H)) ** 2 + (v - cy2) ** 2)
g2 = np.clip(1 - d2 / r2, 0, 1) ** 2.6
img += g2[..., None] * np.array([18, 40, 44], dtype=np.float32)[None, None, :] * 0.45

# --- vignette ---------------------------------------------------------------
dv = np.sqrt(((u - 0.5) * (W / H)) ** 2 + (v - 0.5) ** 2)
vig = np.clip(1.12 - dv * 1.05, 0.55, 1.0)[..., None]
img *= vig

# --- grain (kills banding) --------------------------------------------------
rng = np.random.default_rng(20261007)
img += rng.normal(0.0, 1.1, img.shape).astype(np.float32)

img = np.clip(img, 0, 255).astype(np.uint8)
im = Image.fromarray(img, "RGB")
im.save(OUT, "JPEG", quality=92, optimize=True, subsampling=1)

lum = (0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2])
print(f"saved        : {OUT}")
print(f"size         : {W}x{H}")
print(f"luma mean    : {lum.mean():.1f} / 255")
print(f"luma p99     : {np.percentile(lum, 99):.1f} / 255")
print(f"luma max     : {lum.max():.1f} / 255")
print(f"corner TL    : {img[0, 0].tolist()}   center: {img[H // 2, W // 2].tolist()}   BR: {img[-1, -1].tolist()}")
