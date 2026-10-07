import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const dir = process.argv[2]
function walk(d) {
  const out = []
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.decoded.txt')) out.push(p)
  }
  return out
}

const un = (s) => s.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '  ')
const seen = new Map()

for (const f of walk(dir)) {
  const text = fs.readFileSync(f, 'utf8')
  let i = 0
  while ((i = text.indexOf('const CSS = ', i)) !== -1) {
    const after = text.indexOf('`', i)
    if (after < 0) break
    const end = text.indexOf('`', after + 1)
    if (end < 0) break
    const css = un(text.slice(after + 1, end)).trim()
    if (css.includes('Rd79tq_') || css.includes('dsh-page-css') || css.includes('_centerCol')) {
      const h = crypto.createHash('sha1').update(css.replace(/\s+/g, ' ')).digest('hex').slice(0, 10)
      if (!seen.has(h)) seen.set(h, css)
    }
    i = end
  }
}

console.log(`发现 ${seen.size} 个互不相同的 CSS 版本\n`)
let n = 0
for (const [h, css] of seen) {
  n++
  const flag = css.includes('dsw-specific-input-major') ? '  ★★★ 灰色版：跟输入框同色'
    : css.includes('11, 13, 20') ? '  ◆◆◆ 深色版：显式深色'
    : css.includes('transparent !important') && css.includes('Rd79tq_') ? '  ○ 早期：只让 hover 透明'
    : ''
  console.log(`\n########## 版本 ${n}   sha1:${h}${flag} ##########`)
  console.log(css)
  if (n >= 10) { console.log('\n...(截断)'); break }
}
