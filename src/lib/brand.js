// Stxck mark geometry (200×200 box): a stepped bar chart of stacked blocks with a
// detached "breakout" block above the tallest column. Shared by the logo and loader.
const C = 48 // block size
const G = 10 // gap
const X0 = 18
const Y0 = 200 - 18 - C

const at = (col, row, dx = 0, dy = 0) => ({ x: X0 + col * (C + G) + dx, y: Y0 - row * (C + G) - dy, s: C })

// Order matters: the loader lights blocks bottom-left → breakout.
export const LOGO_BLOCKS = [
  { ...at(0, 0), tone: 'yellow' },
  { ...at(1, 0), tone: 'yellow' },
  { ...at(1, 1), tone: 'yellow' },
  { ...at(2, 0), tone: 'yellow' },
  { ...at(2, 1), tone: 'yellow' },
  { ...at(2, 2, 8, 10), tone: 'sky' },
]
export const BLOCK_RADIUS = 9
