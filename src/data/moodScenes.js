/**
 * Config for the small illustrated room vignette shown on each "room feel"
 * card, so the choice is a picture instead of a guess from a single word.
 *
 * These are stylized flat illustrations, not photos or renders of the actual
 * app — nothing here claims photographic accuracy. `furniture` is a short list
 * of shape tokens (see MoodPreview.jsx for what each draws) placed at roughly
 * where that piece would sit in a small room, tuned by hand per mood so each
 * one reads as genuinely different rather than the same room recolored.
 */
export const MOOD_SCENES = {
  cozy: {
    wall: '#E8D9C7', floor: '#B08968', accent: '#C0703C', corner: 18,
    furniture: [
      { t: 'sofa', x: 30, y: 62, s: 1.1 },
      { t: 'cushion', x: 62, y: 66, s: 0.5 },
      { t: 'lamp', x: 80, y: 40, s: 1, glow: true },
      { t: 'rug', x: 44, y: 78, s: 1 },
      { t: 'frame', x: 20, y: 22, s: 0.8 },
    ],
  },
  modern: {
    wall: '#EFEFEF', floor: '#D6D6D6', accent: '#2B2D33', corner: 3,
    furniture: [
      { t: 'sofa', x: 34, y: 64, s: 1, sharp: true },
      { t: 'frame', x: 66, y: 24, s: 1, sharp: true },
      { t: 'rug', x: 44, y: 80, s: 0.8, sharp: true },
    ],
  },
  warm: {
    wall: '#F0DFC0', floor: '#8C5A3C', accent: '#D9A83C', corner: 16,
    furniture: [
      { t: 'sofa', x: 28, y: 62, s: 1 },
      { t: 'plant', x: 76, y: 56, s: 1 },
      { t: 'lamp', x: 62, y: 38, s: 0.9, glow: true },
      { t: 'rug', x: 42, y: 78, s: 0.9 },
    ],
  },
  cool: {
    wall: '#DCE3E8', floor: '#A8B0B8', accent: '#3F6C93', corner: 5,
    furniture: [
      { t: 'sofa', x: 32, y: 64, s: 1, sharp: true },
      { t: 'frame', x: 70, y: 26, s: 0.9, sharp: true },
      { t: 'shelf', x: 84, y: 44, s: 0.8 },
    ],
  },
  natural: {
    wall: '#E2E8DC', floor: '#BBA97F', accent: '#6E8C5A', corner: 14,
    furniture: [
      { t: 'plant', x: 24, y: 50, s: 1.2 },
      { t: 'plant', x: 78, y: 58, s: 0.85 },
      { t: 'sofa', x: 46, y: 68, s: 0.9 },
      { t: 'rug', x: 46, y: 82, s: 0.9 },
    ],
  },
  bold: {
    wall: '#2B2D33', floor: '#1A1B1E', accent: '#E0785A', corner: 10,
    furniture: [
      { t: 'sofa', x: 32, y: 64, s: 1, glow: false },
      { t: 'lamp', x: 78, y: 38, s: 1, glow: true, hot: true },
      { t: 'frame', x: 22, y: 22, s: 0.9 },
    ],
  },
  minimal: {
    wall: '#F8F7F4', floor: '#EAE7E0', accent: '#8A8F98', corner: 4,
    furniture: [
      { t: 'cushion', x: 46, y: 64, s: 0.7, sharp: true },
      { t: 'plant', x: 78, y: 60, s: 0.7 },
    ],
  },
  maximal: {
    wall: '#E8CDB8', floor: '#8C5A3C', accent: '#B4562E', corner: 14,
    furniture: [
      { t: 'sofa', x: 26, y: 62, s: 1 },
      { t: 'plant', x: 82, y: 50, s: 1 },
      { t: 'lamp', x: 64, y: 34, s: 0.9, glow: true },
      { t: 'frame', x: 18, y: 20, s: 0.7 },
      { t: 'frame', x: 34, y: 16, s: 0.6 },
      { t: 'rug', x: 44, y: 80, s: 1 },
      { t: 'shelf', x: 90, y: 40, s: 0.7 },
    ],
  },
  industrial: {
    wall: '#3A3B3E', floor: '#26272A', accent: '#C77B4C', corner: 2,
    furniture: [
      { t: 'shelf', x: 78, y: 38, s: 1, sharp: true },
      { t: 'sofa', x: 30, y: 66, s: 0.9, sharp: true },
      { t: 'lamp', x: 56, y: 30, s: 0.8, glow: true },
    ],
  },
  playful: {
    wall: '#F3D9CC', floor: '#DCEFE2', accent: '#E0785A', accent2: '#4E9E76', corner: 20,
    furniture: [
      { t: 'cushion', x: 30, y: 66, s: 0.7 },
      { t: 'cushion', x: 50, y: 70, s: 0.55, alt: true },
      { t: 'plant', x: 78, y: 52, s: 0.9 },
      { t: 'frame', x: 20, y: 22, s: 0.7, alt: true },
    ],
  },
  academic: {
    wall: '#E4DAD0', floor: '#5A3E28', accent: '#8A6F4E', corner: 6,
    furniture: [
      { t: 'shelf', x: 74, y: 32, s: 1.1 },
      { t: 'books', x: 74, y: 46, s: 1 },
      { t: 'lamp', x: 34, y: 44, s: 0.8, glow: true },
      { t: 'sofa', x: 28, y: 66, s: 0.75 },
    ],
  },
  zen: {
    wall: '#F4F4F2', floor: '#D9CFC2', accent: '#6E8C5A', corner: 16,
    furniture: [
      { t: 'cushion', x: 44, y: 68, s: 0.6 },
      { t: 'plant', x: 78, y: 56, s: 0.9 },
    ],
  },
}

export const sceneFor = (moodId) => MOOD_SCENES[moodId] || MOOD_SCENES.cozy
