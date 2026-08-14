import { productIdFromUrl, cacheKeyFor } from '../src/data/productId.js'

const cases = [
  ['https://www.ikea.com/us/en/p/kivik-sofa-hillared-anthracite-s79305103/?ref=srp&pos=3', 'ikea', 's79305103'],
  ['https://www.ikea.com/us/en/p/poaeng-armchair-birch-veneer-50508652/', 'ikea', '50508652'],
  ['https://www.amazon.com/Modway-Loveseat-Upholstered/dp/B01N5IB20Q/ref=sr_1_3?keywords=sofa', 'amazon', 'b01n5ib20q'],
  ['https://www.amazon.com/gp/product/B07XJ8C8F5?th=1', 'amazon', 'b07xj8c8f5'],
  ['https://www.wayfair.com/furniture/pdp/andover-mills-sofa-w001234567.html?piid=123', 'wayfair', 'w001234567'],
  ['https://www.target.com/p/threshold-accent-chair/-/A-83916671?preselect=1', 'target', 'a-83916671'],
  ['https://www.walmart.com/ip/Mainstays-Sofa-Grey/847362991?athbdg=L1600', 'walmart', '847362991'],
  ['https://www.westelm.com/products/andes-sofa-h2833/?pkey=csofas', 'westelm', 'h2833'],
  ['https://www.homedepot.com/p/Hampton-Bay-Floor-Lamp/312345678', 'homedepot', '312345678'],
  ['https://www.article.com/product/17550/sven-charme-tan-sofa', 'article', '17550'],
  ['https://someshop.example/collections/lamps/items/brass-arc-4471820', 'someshop.example', '4471820'],
  ['https://www.ikea.com/us/en/cat/sofas-fu003/', null, null],
]

let fail = 0
for (const [url, retailer, id] of cases) {
  const got = productIdFromUrl(url)
  const ok = retailer === null ? got === null : got && got.retailer === retailer && got.id === id
  if (!ok) fail++
  console.log(ok ? 'ok  ' : 'FAIL', JSON.stringify(got), '<-', url.slice(0, 62))
}

const a = cacheKeyFor({ url: 'https://www.ikea.com/us/en/p/kivik-sofa-s79305103/?ref=srp&pos=3' })
const b = cacheKeyFor({ url: 'https://www.ikea.com/us/en/p/kivik-sofa-s79305103/?utm_campaign=oct#reviews' })
console.log(a === b ? 'ok   stable across tracking params' : 'FAIL tracking params changed key', a, b)
if (a !== b) fail++

console.log('name key:        ', cacheKeyFor({ name: 'green velvet armchair', model: 'armchair' }))
console.log('word order stable:', cacheKeyFor({ name: 'velvet green armchair', model: 'armchair' }))
console.log(fail ? `\n${fail} FAILURES` : '\nall passed')
