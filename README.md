# dsh-page-css

给 DeepSeek Harness 的**外观补丁**：三处宿主样式修不出来的地方，加一个小桥把壁纸对齐到对话栏。

它不替代 [`dsh-any-background`](https://github.com/Tkingxiao/dsh-any-background)（壁纸本体、透明度、毛玻璃都由它管），只补它的空白。

---

## 它解决什么

### 1. 页面画布

`dsh-any-background` 把 `--dsw-alias-bg-base` 的透明度调到 0，任何宿主没画到的区域就漏到浏览器画布 —— 默认是白的。

```css
html, body { background-color: #0b0d14 !important; }
```

### 2. Windows 应用骨架

`AppFrame.module.css` 里最外层骨架是实色画的，壁纸透不过来：

```css
[data-windows-titlebar] .<hash>_frame { background: var(--dsw-specific-sidebar-fill) }
```

按 CSS Modules 的 **local 名后缀** `_frame` 匹配（DSH 只保证后缀，哈希前缀每次构建都变）。

### 3. 用量栏底色

宿主调色板把这几个表面渲成浅色，`schemeOverride=dark` 只管字体方向、管不到表面色，所以用量栏是白的。改成显式钉死深色，并用 `body[data-ds-dark-theme]` 收口（切回浅色方案时自动失效）：

```css
body[data-ds-dark-theme] [class*="Rd79tq_"] { background-color: rgba(11,13,20,.86) !important; }
```

`Rd79tq_`（用量药丸）和 `Xt1eiG_`（用量弹层）都是**构建相关**的 CSS-module 前缀，DSH 升级后失效——失效只是那几处变回浅色，不影响别的功能。重新挖法：在安装好的 `dsh-client-ui-chat` 包里搜 `TurnUsagePanel.module.css`。

### 4. 居中对齐（JS 桥）

壁纸层是 `dsh-any-background` 自己建的、挂在 `body` 上的固定 div。从它源码看出来：

```js
wpEl.style.cssText = "position:fixed;inset:0;z-index:-1;...";
document.body.prepend(wpEl);
wpEl.style.backgroundImage = <壁纸>;
wpEl.style.backgroundSize = "cover" | "contain" | "<w>px <h>px";
wpEl.style.backgroundPosition = "center";
```

图片是这个 div 的 CSS 背景，位置由 `background-position` 决定 —— 所以对齐就是改这个属性，**不需要 transform、不需要缩放、不会露边**。

这段逻辑住在 **`client.js`（客户端半侧）**，每 250ms 复查一次（插件每次重绘都会把 `background-position` 写回 `center`，缓存值会被悄悄覆盖）：

- **水平**：壁纸中心对齐 `[class*="_centerCol"]`（对话栏）的中心
- **垂直**：读 `getComputedStyle` 解析出的真实高度 —— 没有余量（cover 铺满）就保持 `center`；有余量则把下边缘对齐到**输入区里那颗**用量药丸的顶边，找不到就退回窗口底边
- **未覆盖处**：给该 div 设 `background-color`，取壁纸自身顶边的采样色（`#393837`），保证接缝不可见

两个必须记住的坑，都踩过：

- **找药丸不能用 `querySelector` 的第一个匹配。** 那个选择器在页面上有 9 个命中：输入区一颗、**聊天记录里每轮一颗**。记录里那颗可能滚在两万像素外（实测 `top=-20324`），于是 `refTop` 算成 0、`wantY = -768`，**整张壁纸被推出视口**。见 `findDockChip()`：要求属于 `[data-composer-seat]` 且盒子在视口内，并把 `refTop` 收敛到 `[0, vh]`。
- **`body` 的背景色必须保持透明。** 壁纸是 `body` 的 `z-index:-1` 子元素，而**非定位块级元素的背景绘制在根层叠上下文的负 z-index 子元素之后** —— body 一旦有不透明背景就把壁纸整个盖住。所以是 `html` 深色 + `body` 透明（body 原本被 index 的 boot 内联样式写死 `#fff`，也不能不管）。

---

## 为什么是「客户端半侧」，而不是往 index 里塞脚本

**这一条是最贵的教训。**

插件最初用宿主半侧的 `webServer.tapIndex` 把一段 `<style>` + 内联 `<script>` 注入到 served index。日志每次都报成功：

```
index inspect: nonce=no cspMeta=no htmlLen=37257 hasHeadClose=true
tap: injected branch=replace-head count=1 injectionLen=8821
```

文档有 `</head>`、分支是 `replace-head`、块确实写进了 HTML、页面**既没有 CSP 也没有 nonce**（不是被拦）—— 但样式没生效、脚本没执行，一次上报都没有。

根因是客户端半侧跑起来后才暴露的，它上报的第一行就是：

```
href: dsh-app://app/
```

**Electron 窗口是用自定义协议 `dsh-app://` 加载页面的，从不请求 `http://127.0.0.1:19387`。** `tapIndex` 改的是 web server 渲染的 index，而窗口根本不看那份 —— 所以它永远到不了页面。前面那些关于 CSP、nonce、注入分支的推断全部建立在错误前提上。

DSH 把插件分成宿主半侧和客户端半侧，**DOM 与样式属于客户端半侧**：

```json
"exports": { "./client": { "default": "./client.js" } },
"dsh": { "client": { "platform": "web", "inject": [], "immediately": true } }
```

```js
window.__ModuleLoader__.load({
  id: 'dsh-page-css',
  factory: (require) => {
    function apply(ctx) { /* 直接操作 DOM */ }
    exports.apply = apply; exports.inject = inject; exports.name = name
    return module.exports
  },
})
```

这条路**没有「注入」这一步可以失败**。所以 `index.js` 现在只负责一件事：提供 `/dsh-page-css/probe` 作为反馈通道。

---

## 诊断

宿主看不到页面，所以 `client.js` 主动上报 —— 这是唯一的反馈通道。

**日志** —— `~/.dsh-page-css.log`，记录宿主半侧每次 `apply()`、探针路由注册、以及每一条收到的客户端上报。

**探针** —— `GET /dsh-page-css/probe`：

| 字段 | 含义 |
|---|---|
| `build` | 客户端半侧版本标记，用来确认**页面里跑的是哪一版** |
| `href` | 页面真实来源（就是它暴露了 `dsh-app://`） |
| `probeHits` | 每次请求的 User-Agent + 是否带 `?r=`，用于区分浏览器上报和自己的 curl |
| `vw` / `vh` | 视口尺寸 |
| `colLeft/Width/Center` | 对话栏实测盒子 |
| `wpBox` | **壁纸元素实际落在哪** —— 一个数字就能看出图片有没有被推出视口 |
| `bgPos` / `bgSize` / `computedBgSize` / `bgColor` | 桥写进去的值与浏览器解析出的值 |
| `dockChipFound` / `dockChipBox` / `seatBox` / `chipCount` | 药丸定位的真实情况 |
| `chipChain` | **药丸祖先链：每层 tag / class / 计算后的背景色** —— 用来不猜选择器地定位「是谁在画那条底色」 |

> ⚠️ 这两个通道是排障用的临时设施，稳定后可以移除；但只要还在调外观，它们就是唯一能看见页面的窗口。

---

## 部署上的坑（踩过，重要）

**pnpm 对 `file:` 依赖是「复制」，对 `link:` 才是「软链」。**

最早依赖写成 `file:<插件目录的绝对路径>`，pnpm 把目录**复制**进了 `node_modules`。结果：源文件改了几十次，宿主一直在跑那份复制出来的旧拷贝，**所有改动全部空转**，而 `list_plugins` 照样报 `active`。

排查方法：对比两边的文件哈希，并看 `node_modules/<pkg>` 的属性 —— 是 `Directory` 就是拷贝，是 `Junction`/`ReparsePoint` 才是软链。

现在依赖是 `link:`，`node_modules/dsh-page-css` 是指向本目录的 Junction，改动即时可见。**但宿主进程会缓存模块 —— 改完仍需重启 DSH 或重新加载插件才能生效。**

**改 `client.js` 还要额外注意。** 客户端包的 URL 带一个 `rev`（由文件元信息 mtime/ctime/size 算出），响应标 `IMMUTABLE_CACHE`。宿主没有重新组合时 `rev` 不变、URL 不变，浏览器会继续用缓存里的旧包。所以改完页面侧代码要**重启 DSH** 拿新 `rev`，并在探针里核对 `build` 标记是否跟着变了 —— 否则你会以为改动没生效，而其实是根本没下载。

---

## 安装

把这个目录放到 `~/.dsh/plugins/` 下（Windows 上是 `%USERPROFILE%\.dsh\plugins\`），然后：

```powershell
# 注意用 link: 而不是 file: —— 原因见上面的部署坑
plugin_manager install_bundle "link:$env:USERPROFILE/.dsh/plugins/dsh-page-css"
```

装完**必须重启一次 DSH**：模块缓存在进程里，禁用/启用插件或触碰文件都拉不动它。

卸载：`plugin_manager remove_bundle dsh-page-css`，或删掉 profile `cordis.patch.yml` 里的 `page-css` 行。

---

## 结构

```
client.js                   客户端半侧：CSS 修正 + 壁纸对齐 + DOM 上报（页面里跑）
index.js                    宿主半侧：只提供 /dsh-page-css/probe 反馈通道
package.json                声明 dsh.bundle.patch 与 dsh.client
cordis.patch.yml            插入 page-css 一行
wallpaper/                  壁纸流水线（Python + Pillow）
  compose-wide.py           宽版 3200×1440 配方
  sample-edges.py           采样边缘色，决定未覆盖处的填充色
  make-dark-bg.py           最早那张深色底
  use-version.ps1           切换正在使用的壁纸版本（带服务端字节校验）
  assets/                   配方依赖的源图
  versions/                 **10 个壁纸版本全部纳管**，见 MANIFEST.md
history/                    回收的、存在于 git 之前的版本，见其 README
tools/
  emit-bridge.mjs           按模板字面量规则求值，供语法检查
  extract-bridge.mjs
  decode-sessions.mjs       多帧 zstd 解压（从会话日志回收历史版本用）
  extract-css-versions.mjs  从会话日志抽每一版 `const CSS =`，全文哈希去重
```

### 当前生效版本

`versions/08-dark-seamless-2560.jpg` —— sha `bd4bd090b8e1`，2560×1440，深色无缝。

```powershell
.\wallpaper\use-version.ps1 -List    # 看清单，并标出当前用的是哪个
.\wallpaper\use-version.ps1 08       # 切过去（先备份当前版本，再校验服务端字节）
```

> **浅色壁纸必须配 `schemeOverride: auto`，深色必须配 `dark`。** 改壁纸不改这个设置，
> 结果就是「字看不清」——用户最开始提的问题正是这么来的。对应关系写在 `MANIFEST.md`。

> `use-version.ps1` 存成 **UTF-8 with BOM**。没有 BOM 的 `.ps1` 会被 Windows PowerShell 5.1
> 按系统 ANSI(GBK) 解析，脚本里的中文直接变成乱码并导致语法错误 —— 踩过一次。

> `tools/emit-bridge.mjs` / `extract-bridge.mjs` 是**历史工具**：早期版本的 `index.js` 把一段 JS 放在模板字面量里（`const BRIDGE = \`…\``），它的转义在**模块求值时**才处理 —— 检查源文件或原始模板文本**都不等于**检查浏览器实际收到的那段 JS。曾经就因为注释里写了反引号把模板字面量提前截断，只有 `node --check` 才发现。那段代码已经搬进 `client.js` 变成真实代码，工具留着用于回收历史版本。

---

## 许可

代码与文档：**MIT**，见 `LICENSE`。

`wallpaper/versions/` 与 `wallpaper/assets/` 下的图片是**作者个人绘图，不在 MIT 授权范围内** —— 它们只为让壁纸流水线可复现而随仓库提供，请勿再分发或复用。想用这部分功能请换成你自己的图。
