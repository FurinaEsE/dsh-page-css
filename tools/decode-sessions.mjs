// DSH appends one zstd frame per write, so zstdDecompressSync only returns the
// first frame (a few hundred bytes). Split on the zstd magic and decode every
// frame, then search the concatenated log for the historical CSS revisions.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dir = process.argv[2]
const needle = process.argv[3]

function walk(d) {
  const out = []
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.zstd')) out.push(p)
  }
  return out
}

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function decodeAll(buf) {
  const offsets = []
  let i = buf.indexOf(MAGIC, 0)
  while (i !== -1) { offsets.push(i); i = buf.indexOf(MAGIC, i + 4) }
  let text = ''
  let ok = 0, bad = 0
  for (let k = 0; k < offsets.length; k++) {
    const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length
    try {
      text += zlib.zstdDecompressSync(buf.subarray(offsets[k], end)).toString('utf8')
      ok++
    } catch { bad++ }
  }
  return { text, frames: offsets.length, ok, bad }
}

let grand = 0
for (const f of walk(dir)) {
  const { text, frames, ok, bad } = decodeAll(fs.readFileSync(f))
  grand += text.length
  const hit = text.includes(needle)
  console.log(`${path.basename(f).slice(0, 34)} frames=${frames} ok=${ok} bad=${bad} ${(text.length / 1024).toFixed(0)}KB ${hit ? '<-- 命中 ' + needle : ''}`)
  if (hit) fs.writeFileSync(f + '.decoded.txt', text, 'utf8')
}
console.log(`\n总解压 ${(grand / 1024 / 1024).toFixed(1)} MB`)
