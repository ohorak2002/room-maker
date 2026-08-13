import { CATALOG } from './catalog'

/**
 * Turns plain-language "what came with the place" text into catalog ids.
 *
 * This is keyword matching against a synonym table, not a language model —
 * there is no API key in this app and no server to hold one. It handles the
 * phrasings people actually use ("it came with a queen bed and blinds") by
 * matching product names, a synonym table, and category words. Anything it
 * can't place is returned as a leftover so the caller can show it back rather
 * than silently dropping it.
 *
 * Shared between the onboarding "What came with the place" step and the
 * Design panel's chat box, so both understand the same vocabulary.
 */

const SYNONYMS = {
  bed: ['bed', 'mattress', 'queen', 'full size', 'twin', 'king', 'bedframe', 'bed frame'],
  desk: ['desk', 'workspace', 'study table', 'writing table'],
  'desk-chair': ['desk chair', 'office chair', 'task chair', 'rolling chair', 'swivel'],
  sofa: ['sofa', 'couch', 'loveseat', 'settee', 'sectional'],
  bookshelf: ['bookshelf', 'shelving', 'shelves', 'bookcase', 'storage unit'],
  curtains: ['curtain', 'curtains', 'blinds', 'shades', 'drapes', 'window covering'],
  nightstand: ['nightstand', 'night stand', 'bedside table', 'side table'],
  'coffee-table': ['coffee table', 'centre table', 'center table'],
  rug: ['rug', 'carpet', 'carpeting', 'area rug'],
  'floor-lamp': ['floor lamp', 'standing lamp', 'lamp'],
  'desk-lamp': ['desk lamp', 'table lamp', 'reading lamp'],
  tv: ['tv', 'television', 'smart tv', 'flatscreen', 'flat screen'],
  'floor-mirror': ['mirror', 'full length mirror', 'floor mirror'],
  monitor: ['monitor', 'display', 'screen'],
  'pc-tower': ['pc', 'computer', 'desktop', 'tower'],
  'ceiling-fan': ['ceiling fan', 'fan'],
  microwave: ['microwave'],
  dishwasher: ['dishwasher'],
  blinds: ['mini blinds', 'venetian blinds'],
  closet: ['closet organizer', 'closet system'],
}

/** Longest phrases first so "desk chair" wins over "desk". */
const MATCHERS = Object.entries(SYNONYMS)
  .flatMap(([id, words]) => words.map((w) => ({ id, w: w.toLowerCase() })))
  .concat(CATALOG.map((i) => ({ id: i.id, w: i.name.toLowerCase() })))
  .sort((a, b) => b.w.length - a.w.length)

const FILLER =
  /^(it|the|a|an|and|with|has|have|had|came|comes|come|my|is|are|was|were|there|also|already|plus|some|place|apartment|flat|room|unit|building|includes|included|including|got|we|i|they)$/

/**
 * @param text free-language description
 * @returns { found: string[] catalog ids, leftovers: string[] unrecognized phrases }
 */
export function parsePrefurnished(text) {
  let hay = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
  const found = []
  for (const { id, w } of MATCHERS) {
    if (found.includes(id)) continue
    if (hay.includes(` ${w} `) || hay.includes(` ${w}s `)) {
      found.push(id)
      // Consume the phrase so "desk chair" doesn't also register as "desk".
      hay = hay.split(` ${w} `).join(' ').split(` ${w}s `).join(' ')
    }
  }
  // Whatever's left that looked like a noun phrase and matched nothing. Filler
  // is stripped from both ends so we quote the actual noun back, not
  // "the place has a flurgle".
  const leftovers = hay
    .split(/\band\b|,|\bplus\b/)
    .map((s) => {
      const words = s.trim().split(/\s+/).filter(Boolean)
      while (words.length && FILLER.test(words[0])) words.shift()
      while (words.length && FILLER.test(words[words.length - 1])) words.pop()
      return words.join(' ')
    })
    .filter((s) => s.length > 2)
  return { found, leftovers }
}
