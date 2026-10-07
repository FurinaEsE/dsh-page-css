// Extract the BRIDGE template literal from the plugin and syntax-check it on
// its own — a syntax error INSIDE the string would not be caught by checking
// index.js, because for index.js it is just string content.
import fs from 'node:fs'

const [, , srcPath, outPath] = process.argv
const src = fs.readFileSync(srcPath, 'utf8')

const marker = 'const BRIDGE = `'
const start = src.indexOf(marker)
if (start < 0) { console.log('FAIL: BRIDGE declaration not found'); process.exit(1) }

const from = start + marker.length
// The template ends at the NEXT backtick (the declaration is followed by a
// newline, not by "`;"), so match the backtick alone.
const end = src.indexOf('`', from)
if (end < 0) { console.log('FAIL: closing backtick for BRIDGE not found'); process.exit(1) }

const body = src.slice(from, end)
fs.writeFileSync(outPath, body, 'utf8')

console.log('extracted :', body.length, 'chars')
console.log('backticks :', (body.match(/`/g) || []).length)
console.log('template  :', (body.match(/\$\{/g) || []).length)
console.log('closeTag  :', body.includes('</script'))
console.log('wrote     :', outPath)
