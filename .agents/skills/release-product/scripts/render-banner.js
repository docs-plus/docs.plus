// Turns one Claude Design artboard (.dc.html) into a plain HTML page, for a 2x PNG render.
// It runs the artboard's renderVals(), expands <sc-for>, <sc-if> and {{holes}}, and inlines the logo.
// It executes the artboard's script, so run it only on artboards you wrote or reviewed.
// Usage: bun render-banner.js <artboard.dc.html> <logo.svg> <out.html>
const fs = require('fs')

const [src, logoPath, out] = process.argv.slice(2)
if (!src || !logoPath || !out) throw new Error('usage: render-banner.js <artboard.dc.html> <logo.svg> <out.html>')

const html = fs.readFileSync(src, 'utf8')
const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]
const vals = new Function(`class DCLogic {}; ${script}; return new Component().renderVals.call({ props: {} })`)()
const tpl = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '')

const look = (scope, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope)
const holes = (s, scope) =>
  s.replace(/\{\{([\w.]+)\}\}/g, (_, p) => {
    const v = look(scope, p)
    return v == null ? '' : String(v)
  })

function render(s, scope) {
  const m = s.match(/<(sc-for|sc-if)\b([^>]*)>/)
  if (!m) return holes(s, scope)
  const tag = m[1]
  const bodyStart = m.index + m[0].length
  // Find the matching close tag; the same tag can nest.
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g')
  re.lastIndex = bodyStart
  let depth = 1
  let end = bodyStart
  for (let t; (t = re.exec(s)); ) {
    depth += t[0].startsWith('</') ? -1 : 1
    if (!depth) {
      end = t.index
      break
    }
  }
  const body = s.slice(bodyStart, end)
  const rest = s.slice(end + `</${tag}>`.length)
  const attr = (n) => (m[2].match(new RegExp(`${n}="([^"]*)"`)) || [])[1]
  const ref = (a) => look(scope, a.replace(/^\{\{|\}\}$/g, ''))
  let mid = ''
  if (tag === 'sc-for') {
    mid = (ref(attr('list')) || []).map((item) => render(body, { ...scope, [attr('as')]: item })).join('')
  } else if (ref(attr('value'))) {
    mid = render(body, scope)
  }
  return holes(s.slice(0, m.index), scope) + mid + render(rest, scope)
}

const logo = fs
  .readFileSync(logoPath, 'utf8')
  .replace(/<svg width="\d+" height="\d+"/, '<svg width="52" height="52" role="img" aria-label="docs.plus logo" style="display: block"')
const body = render(tpl, vals)
  .trim()
  .replace(/<img src="\/_blob\/[0-9a-f]+"[^>]*>/, logo.trim())
const title = html.match(/<title>(.*?)<\/title>/)[1]

fs.writeFileSync(
  out,
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${title}</title>\n` +
    `<style>body{margin:0}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`
)
const leftovers = body.includes('{{') || /<sc-/.test(body)
console.log(`wrote ${out}${leftovers ? ' (WARNING: unresolved template markup)' : ''}`)
