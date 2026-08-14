
const { readDimensions, parseMeasure } = await import('../api/_lib/dimensions.js')

// Unit checks first — fractions are where this quietly goes wrong.
const cases = [['89 ¾', 89.75], ['37 ⅜', 37.375], ['32 ⅝', 32.625], ['89 3/4', 89.75], ['228', 228], ['19 ½', 19.5]]
let bad = 0
for (const [raw, want] of cases) {
  const got = parseMeasure(raw)
  const ok = Math.abs(got - want) < 1e-9
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'FAIL'} parse "${raw}" → ${got} (want ${want})`)
}
console.log()

// Then real pages, with the truth from each page's own dimensions diagram.
const PAGES = [
  ['KIVIK sofa',        'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-gray-s39440593/',      { w: 2.28, d: 0.95, h: 0.83 }],
  ['KIVIK gunnared',    'https://www.ikea.com/us/en/p/kivik-sofa-gunnared-beige-s89499703/',            null],
  ['KIVIK tresund',     'https://www.ikea.com/us/en/p/kivik-sofa-tresund-anthracite-s39482837/',        null],
  ['LACK side table',   'https://www.ikea.com/us/en/p/lack-side-table-white-30449908/', { w: 0.55, d: 0.55, h: 0.45 }],
  ['BILLY bookcase',    'https://www.ikea.com/us/en/p/billy-bookcase-white-90522043/', { w: 0.8, d: 0.28, h: 1.06 }],
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const cm = (m) => (m == null ? '  ?  ' : String(Math.round(m * 100)).padStart(4) + 'cm')

for (const [label, url, truth] of PAGES) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } })
    const html = await res.text()
    const d = readDimensions(html)
    if (!d) {
      console.log(`${label.padEnd(18)} HTTP ${res.status}  → no dimensions found`)
      bad++
      continue
    }
    let line = `${label.padEnd(18)} W${cm(d.widthM)}  D${cm(d.depthM)}  H${cm(d.heightM)}   via ${d.source}`
    if (truth) {
      const near = (a, b) => a != null && Math.abs(a - b) < 0.02
      const ok = near(d.widthM, truth.w) && near(d.depthM, truth.d) && near(d.heightM, truth.h)
      line += ok ? '   ✓ matches the diagram' : `   ✗ WANT ${truth.w}/${truth.d}/${truth.h}`
      if (!ok) bad++
    }
    console.log(line)
  } catch (err) {
    console.log(`${label.padEnd(18)} FAILED ${err.message}`)
    bad++
  }
}
console.log('\n' + (bad ? bad + ' problems' : 'all good'))
