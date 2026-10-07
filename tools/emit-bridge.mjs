// Reconstruct what the host actually injects.
//
// The BRIDGE lives inside a template literal in index.js, so its escape
// sequences are processed when the module is evaluated — checking index.js or
// the RAW template text is not the same as checking what the browser receives.
// Here the raw text is evaluated as a template literal, exactly as the module
// does, and the result is written out for a real syntax check.
import fs from 'node:fs'

const [, , srcPath, outPath] = process.argv
const src = fs.readFileSync(srcPath, 'utf8')

const marker = 'const BRIDGE = `'
const start = src.indexOf(marker)
if (start < 0) { console.log('FAIL: BRIDGE not found'); process.exit(1) }
const from = start + marker.length
const end = src.indexOf('`', from)
if (end < 0) { console.log('FAIL: closing backtick not found'); process.exit(1) }

const raw = src.slice(from, end)
console.log('raw template chars :', raw.length)
console.log('raw backticks      :', (raw.match(/`/g) || []).length)
console.log('raw ${ placeholders:', (raw.match(/\$\{/g) || []).length)

let emitted
try {
  emitted = new Function('return `' + raw + '`')()
} catch (e) {
  console.log('FAIL: template evaluation threw:', e.message)
  process.exit(1)
}

fs.writeFileSync(outPath, emitted, 'utf8')
console.log('emitted chars      :', emitted.length)
const esc = (emitted.match(/\\s\+/g) || []).length
console.log('emitted \\s+ count  :', esc)
console.log('wrote              :', outPath)
