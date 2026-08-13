// Onboarding option data: palettes, moods, light, floorplans.
// Each palette carries the actual hexes used to paint the 3D room.

export const PALETTES = [
  {
    id: 'clay',
    name: 'Clay & Linen',
    blurb: 'Earthy, sun-warmed, forgiving',
    wall: '#E4DAD0',
    floor: '#B08968',
    trim: '#F2ECE6',
    accent: '#C0703C',
  },
  {
    id: 'pine',
    name: 'Pine & Slate',
    blurb: 'Deep greens against cool stone',
    wall: '#DCE3DE',
    floor: '#6E6A63',
    trim: '#F1F4F1',
    accent: '#2E6B5E',
  },
  {
    id: 'ink',
    name: 'Ink & Brass',
    blurb: 'Low light, high contrast',
    wall: '#2B2D33',
    floor: '#4A423A',
    trim: '#3A3D45',
    accent: '#C9A227',
  },
  {
    id: 'paper',
    name: 'Paper White',
    blurb: 'Everything recedes but the objects',
    wall: '#F4F4F2',
    floor: '#D9CFC2',
    trim: '#FFFFFF',
    accent: '#8A8F98',
  },
  {
    id: 'dusk',
    name: 'Dusk Blue',
    blurb: 'Cool, quiet, a little melancholy',
    wall: '#C6D0DB',
    floor: '#8C7B6B',
    trim: '#E8EEF4',
    accent: '#3F6C93',
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Saturated and unapologetic',
    wall: '#7A2E2E',
    floor: '#3C2B24',
    trim: '#A85A47',
    accent: '#E08A3C',
  },
]

export const MOODS = [
  { id: 'cozy', name: 'Cozy', blurb: 'Soft edges, layered textiles, low lamps' },
  { id: 'modern', name: 'Modern', blurb: 'Clean lines, restraint, negative space' },
  { id: 'warm', name: 'Warm', blurb: 'Wood, amber light, nothing cold' },
  { id: 'cool', name: 'Cool', blurb: 'Grey, glass, a calm flat light' },
  { id: 'natural', name: 'Natural', blurb: 'Plants, raw materials, daylight' },
  { id: 'bold', name: 'Bold', blurb: 'Strong color, contrast, statement pieces' },
]

export const LIGHTING = [
  { id: 'natural', name: 'Daylight', blurb: 'Neutral, even, sun through a window', kelvin: 5600 },
  { id: 'warm', name: 'Warm', blurb: 'Lamplight, evening, amber cast', kelvin: 2700 },
  { id: 'cool', name: 'Cool', blurb: 'Crisp and blue-leaning', kelvin: 6500 },
  { id: 'moody', name: 'Moody', blurb: 'Dim, pooled light, deep shadow', kelvin: 2200 },
]

export const FLOORPLANS = [
  { id: 'studio', name: 'Studio', blurb: 'Compact, one open square', w: 4, d: 4, h: 2.6 },
  { id: 'bedroom', name: 'Bedroom', blurb: 'A standard private room', w: 5, d: 4.5, h: 2.7 },
  { id: 'living', name: 'Living Room', blurb: 'Room to arrange around a center', w: 7, d: 5.5, h: 2.9 },
  { id: 'loft', name: 'Loft', blurb: 'Tall, wide, industrial volume', w: 9, d: 7, h: 3.6 },
]

export const getPalette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0]
export const getFloorplan = (id) => FLOORPLANS.find((f) => f.id === id) || FLOORPLANS[1]
export const getLighting = (id) => LIGHTING.find((l) => l.id === id) || LIGHTING[0]
