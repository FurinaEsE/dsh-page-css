# 壁纸版本清单

由左至右按时间顺序。`sha` 是前 12 位，用来确认服务端实际吐出的就是这一版：

```powershell
# 校验当前生效的是哪一版
curl.exe -s -o $env:TEMP\wp.bin http://127.0.0.1:19387/dsh-any-background/wallpaper
(Get-FileHash "$env:TEMP\wp.bin" -Algorithm SHA256).Hash.ToLower().Substring(0,12)
```

| # | 文件 | 尺寸 | sha | 说明 |
|---|---|---|---|---|
| 00 | `00-original-meme.png` | 384×384 | `2d3a5f07684c` | 用户最初那张「吃白饭的大蓝肥鱼」。**注意扩展名骗人** —— 文件叫 `.jpg` 但字节是 PNG（magic `89504e47`）。插件按字节嗅探 MIME 所以能显示；宽高比是 1:1，做壁纸会被裁 |
| 01 | `01-dark-gradient.jpg` | 2560×1440 | `38e4e9575335` | 纯深色渐变底。亮度均值 11/255，最亮 34 —— 几乎没有结构，只作为后续合成的底 |
| 02 | `02-corner-accent.jpg` | 2560×1440 | `ef461e270862` | 深底 + 右下角「思考娘」贴纸（圆角 46px、羽化 30px、不透明度 0.92） |
| 03 | `03-ricefish-accent.jpg` | 2560×1440 | `dc9b233d0747` | 同上，贴纸换成「吃白饭」那张 |
| 04 | `04-fullscreen-center.jpg` | 2560×1440 | `c0097cc3d76f` | 全屏版，人物居中。压暗 0.46 + 暗角 0.30（保证浅色字能读） |
| 05 | `05-fullscreen-right.jpg` | 2560×1440 | `8a5e1927c689` | 人物右移到 x 31%–95%，避开左侧栏 |
| 06 | `06-fullscreen-left-dark.jpg` | 2560×1440 | `6df0974123d4` | 人物左移到 x 21%–84%。**两侧是模糊背景带，与人物自带底色有明显接缝** ← 用户据此提出「补成图片白色部分」 |
| 07 | `07-light-seamless.jpg` | 2560×1440 | `db8d76a22e85` | **无缝**：两侧填的是从图片左右边缘列采出来的本色 `RGB(221,217,215)`，结构上不可能有接缝。浅色 → **必须配 `schemeOverride: auto`**，否则浅字压浅底看不见 |
| 08 | `08-dark-seamless-2560.jpg` | 2560×1440 | `bd4bd090b8e1` | 在 07 基础上整体 ×0.30、中调对比 ×1.12、暗角 0.18。**深色 + 无缝兼顾**，两侧均值 55、整图 47.8、最亮 79。配 `schemeOverride: dark` ← **当前生效版本** |
| 09 | `09-wide-3200.jpg` | 3200×1440 | `100ecc419ab0` | 同 08 的配方但画布加宽到 2.22:1。目的：`cover` 下横向余量从 ±5.5% 提到 ±19%，让「对齐对话栏中心」的平移不会露边 |

## 切换版本

```powershell
# 切到某一版（会先备份当前版本）
.\wallpaper\use-version.ps1 08

# 只看不切
.\wallpaper\use-version.ps1 -List
```

脚本做的事：备份当前 `wallpaper.jpg` → 覆盖 → 校验服务端 hash。

## ⚠️ 与主题明暗的绑定

壁纸亮度和 `schemeOverride` 必须成对：

| 壁纸 | `schemeOverride` | 原因 |
|---|---|---|
| 07（浅色无缝） | `auto` | 浅底需要深字 |
| 01–06、08、09（深色） | `dark` | 深底需要浅字 |

改壁纸不改这个设置，结果就是「看不清」——用户第一次提的问题正是这么来的。

配置在 `~/.dsh/.dsh-any-background-data/theme-config.json` 的 `schemeOverride` 字段，改完需要刷新页面。
