// The approved reference is an illustration, not a retailer catalog. These
// authored demo pieces use bundled CC0 surfaces and make no purchasing claims.
export const FABRIC_SWATCHES = [
  { id: 'oatmeal', name: 'Oatmeal', color: '#e4d6bb' },
  { id: 'sage', name: 'Sage', color: '#8f9b82' },
  { id: 'stone', name: 'Stone', color: '#bab3a8' },
  { id: 'charcoal', name: 'Charcoal', color: '#64635f' },
]
export const FABRIC_MAP = '/materials/polyhaven/poly_wool_herringbone/poly_wool_herringbone_diff_2k.jpg'
export const WOOD_MAP = '/materials/polyhaven/oak_veneer_01/oak_veneer_01_diff_2k.jpg'
const base = { price: null, retailerName: 'Demo item', materialSet: 'pilot', pilot: true, provenance: 'Nested-authored concept geometry; bundled Poly Haven CC0 materials. Not a verified retail product.' }
export const PILOT_PRODUCTS = [
  { ...base, id: 'pilot-sofa', name: 'Oatmeal sofa', model: 'referenceSofa', cat: 'seating', color: FABRIC_SWATCHES[0].color, finish: 'oatmeal', w: 2.2, d: .95, h: .82, fp: 1.1, area: 2.09, detail: 'Wool-blend upholstery', materialImage: FABRIC_MAP },
  { ...base, id: 'pilot-chair', name: 'Oak lounge chair', model: 'referenceChair', cat: 'seating', color: FABRIC_SWATCHES[0].color, finish: 'oatmeal', w: .78, d: .82, h: .83, fp: .41, area: .64, detail: 'Oak frame · upholstered cushions', materialImage: WOOD_MAP },
  { ...base, id: 'pilot-table', name: 'Round coffee table', model: 'referenceTable', cat: 'tables', color: '#d5b583', w: 1.05, d: 1.05, h: .38, fp: .525, area: .87, detail: 'Natural oak concept finish', materialImage: WOOD_MAP },
  { ...base, id: 'pilot-rug', name: 'Textured rug', model: 'referenceRug', cat: 'decor', color: '#e5ddc9', w: 2.8, d: 2.1, h: .018, fp: 1.4, area: 0, detail: 'Woven wool concept finish', materialImage: FABRIC_MAP },
  { ...base, id: 'pilot-lamp', name: 'Floor lamp', model: 'referenceLamp', cat: 'lighting', color: '#7c6746', w: .5, d: .4, h: 1.62, fp: .25, area: .2, detail: 'Brushed bronze concept finish', materialImage: null },
]
export const PILOT_PLACEMENTS = {
  'pilot-sofa#0': { x: -.2, y: 0, z: -1.23, ry: 0, zone: 'floor' },
  'pilot-chair#0': { x: 1.24, y: 0, z: -.3, ry: -.62, zone: 'floor' },
  'pilot-table#0': { x: -.35, y: .018, z: -.24, ry: 0, zone: 'center' },
  'pilot-rug#0': { x: .05, y: 0, z: -.2, ry: 0, zone: 'center' },
  'pilot-lamp#0': { x: -1.67, y: 0, z: -1.27, ry: -.25, zone: 'floor' },
}
export function pilotState() {
  return {
    onboarded: true, briefDraft: null, floorplan: 'living', palette: 'clay',
    lighting: 'natural', wallOverride: '#ddd4c2', floorOverride: '#c4a779',
    customShape: {
      pilot: true, cols: 9, rows: 8, h: 2.8, exactW: 4.5, exactD: 3.8, area: 17.1,
      cells: Array.from({ length: 72 }, (_, i) => `${i % 9},${Math.floor(i / 9)}`),
      footprint: [{ x: -2.25, z: -1.9 }, { x: 2.25, z: -1.9 }, { x: 2.25, z: 1.9 }, { x: -2.25, z: 1.9 }],
      openings: [{ type: 'window', edge: 3, offset: 1.2, width: 2.3, sill: .13, height: 2.48 }],
      surfaces: { floor: 'oak', wall: 'plaster', floorColor: '#c4a779', wallColor: '#ddd4c2', trimColor: '#e9e2d6', accentColor: '#c6b9a3', floorFinish: 'matte', wallFinish: 'matte', textureScale: 1 },
    },
    items: PILOT_PRODUCTS.map(p => ({ id: p.id, qty: 1 })),
    synthetics: Object.fromEntries(PILOT_PRODUCTS.map(p => [p.id, { ...p }])),
    placements: structuredClone(PILOT_PLACEMENTS),
    studio: { brightness: 110, sun: 32, accent: true },
  }
}
