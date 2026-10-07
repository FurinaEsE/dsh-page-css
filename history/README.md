# history —— 回收的历史版本

这个目录放**在 git 仓库建立之前就已经被覆盖掉**的版本。它们不在任何提交里，
只能从别处捞回来。

## 为什么会有这个目录

`dsh-page-css` 是在**没有版本管理**的情况下写了很久的。仓库建立时，第一个提交
`addcd8e` 装进去的**已经是当时的最新代码** —— 更早的那些中间状态（比如「用量栏
跟输入框同色」那一版）在 git 里根本不存在，`git log` 永远找不到。

有个更隐蔽的坑：**pnpm 对 `file:` 依赖是复制一份到 `node_modules`**。那次复制
曾经无意中保存了一版旧代码，但改成 `link:` 时它被清掉了 —— 也就是说，连这个
意外的备份也没了。

## 唯一还能找回的地方：DSH 会话日志

`~/.dsh/sessions/**/session.v4.jsonl.zstd`

Agent 的每一次 `write` / `edit` 都带着完整内容记在里面。这些日志是**压缩**的，
而且有两个坑：

### 坑 1：它们是 `.zstd`，但 `zstdDecompressSync` 只解第一帧

DSH 是**逐次追加**写的，每个文件里有成百上千个独立的 zstd 帧。Node 的
`zlib.zstdDecompressSync()` 只返回第一帧 —— 实测 4.9 MB 的日志只解出 **209 字节**，
而且不报错，看起来像"日志是空的"。

正确做法：按 zstd magic（`28 b5 2f fd`）切开，逐帧解压再拼接。

```js
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
function decodeAll(buf) {
  const offs = []
  let i = buf.indexOf(MAGIC, 0)
  while (i !== -1) { offs.push(i); i = buf.indexOf(MAGIC, i + 4) }
  let text = ''
  for (let k = 0; k < offs.length; k++) {
    const end = k + 1 < offs.length ? offs[k + 1] : buf.length
    text += zlib.zstdDecompressSync(buf.subarray(offs[k], end)).toString('utf8')
  }
  return text
}
```

一个 13 个文件的会话目录，解开后是 **61 MB** 文本。

### 坑 2：日志在子目录里

`.zstd` 文件在 `sessions/--D-...--/` 这种按工作目录命名的子目录下，
`readdirSync` 只看顶层会得到 0 个文件。

### 坑 3：去重 key 不能只取前若干字符

同一份 CSS 的多个版本**共享开头几条规则**。我第一次用「前 220 字符」当去重 key，
结果「灰色版」被折叠进"早期版"里，明明在日志里却搜不出来。
**必须用全文哈希**（`sha1(css.replace(/\s+/g,' '))`）。

## 现有工具

| 脚本 | 用途 |
|---|---|
| `tools/decode-sessions.mjs` | 按帧解压会话日志，命中关键字的写出 `*.decoded.txt` |
| `tools/extract-css-versions.mjs` | 从解压结果里抽出每一版 `const CSS = ...`，全文哈希去重 |

用法（Node 需要 ≥ 22 才有 `zlib.zstdDecompressSync`）：

```powershell
node tools/decode-sessions.mjs "$env:USERPROFILE\.dsh\sessions" "Rd79tq_"
node tools/extract-css-versions.mjs "$env:USERPROFILE\.dsh\sessions"
```

## 回收记录

| 文件 | 原 sha1 | 说明 |
|---|---|---|
| `usage-bar-gray.css` | `c75c8f0661` | 用量栏用 `--dsw-specific-input-major` 上色，与输入框同色 → 观感发灰。后被显式深色版取代 |

> **教训**：先建仓库再改代码。哪怕只是 `git init` 加一次提交，也比事后从会话日志里
> 逆向捞回来省事得多。
