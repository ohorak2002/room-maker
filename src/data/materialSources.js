/**
 * Provenance for the bundled photographic material sets used by the material
 * pilot (one sofa, one coffee table). Everything here is a *concept* finish:
 * it says what the generic surface is made from, not what any retailer's
 * product is made from. Verified retail finishes never use these.
 *
 * Source: Poly Haven (https://polyhaven.com), textures published under CC0
 * (https://polyhaven.com/license). Files were fetched once from the official
 * download URLs listed by the Poly Haven API (https://api.polyhaven.com/files/<id>),
 * checked against the MD5 values it publishes, and are bundled under
 * public/materials/polyhaven/ so nothing is requested at run time.
 *
 * `tile` is the real-world size the source publishes for one texture repeat
 * (API `dimensions`, millimetres, converted to metres). It is the photographed
 * sample's size, not a claim about any product's weave or grain.
 */
export const POLYHAVEN_ACCESSED = '2026-09-29'

export const MATERIAL_SETS = {
  'polyhaven-wool-herringbone': {
    kind: 'fabric',
    name: 'Poly Wool Herringbone',
    assetId: 'poly_wool_herringbone',
    sourceUrl: 'https://polyhaven.com/a/poly_wool_herringbone',
    license: 'CC0 1.0',
    authors: 'colormass (photography), Rico Cilliers (processing)',
    published: '2025-09-05',
    resolution: '2048 x 2048 (2k JPG)',
    tile: [0.27008, 0.2757],
    dir: 'poly_wool_herringbone',
    maps: {
      map: 'poly_wool_herringbone_diff_2k.jpg',
      normalMap: 'poly_wool_herringbone_nor_gl_2k.jpg',
      roughnessMap: 'poly_wool_herringbone_rough_2k.jpg',
    },
    md5: {
      'poly_wool_herringbone_diff_2k.jpg': 'ab20cb6c120dfa5d38f4e4d3fd9b980d',
      'poly_wool_herringbone_nor_gl_2k.jpg': '954185c16339c6bb3d1825071e4cfe90',
      'poly_wool_herringbone_rough_2k.jpg': '009bf33f8d8a5fda0ba245e5a4dd646d',
    },
    normalConvention: 'OpenGL (nor_gl), matching three.js',
  },
  'polyhaven-oak-veneer-01': {
    kind: 'wood',
    name: 'Oak Veneer 01',
    assetId: 'oak_veneer_01',
    sourceUrl: 'https://polyhaven.com/a/oak_veneer_01',
    license: 'CC0 1.0',
    authors: 'Jenelle van Heerden',
    published: '2024-03-08',
    resolution: '2048 x 2048 (2k JPG)',
    tile: [1.83, 1.83],
    dir: 'oak_veneer_01',
    maps: {
      map: 'oak_veneer_01_diff_2k.jpg',
      normalMap: 'oak_veneer_01_nor_gl_2k.jpg',
      roughnessMap: 'oak_veneer_01_rough_2k.jpg',
    },
    md5: {
      'oak_veneer_01_diff_2k.jpg': '0ad13b8daf8dc00318a437f56e54c484',
      'oak_veneer_01_nor_gl_2k.jpg': 'a6b8dd99a4407aa5dd24d5eee25492d3',
      'oak_veneer_01_rough_2k.jpg': 'cacab0148320161ceced18ae909e3ada',
    },
    normalConvention: 'OpenGL (nor_gl), matching three.js',
  },
}

/** Downloaded 2026-09-29 from the official download URLs listed by the Poly Haven API;
 *  `md5` values match the ones the API publishes for each file. */

/** Set ids a catalog piece may name in `materialSet`. */
export const PILOT_MATERIALS = { upholstery: 'polyhaven-wool-herringbone', wood: 'polyhaven-oak-veneer-01' }
