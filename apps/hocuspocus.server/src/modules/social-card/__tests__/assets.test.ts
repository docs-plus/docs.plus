import { describe, expect, it } from 'bun:test'

import { isDrawable } from '../infra/assets'

// Arimo maps these English code points and Inter does not, so Arimo must stay registered.
// U+202A–U+202E and U+2066–U+2069 are left out: the bidi guard refuses them on purpose.
const ARIMO_ONLY = `
  000d 00ad 0149 01c4 0255 027c-027d 0285 0291 02a5 0305 030b 030d-030e 0310-0312 0314
  0316-031a 031c-0322 0324-0325 0329-032b 032d-0336 0339-0341 0344-0345 1ab0-1abe 1d01-1d0c
  1d0e-1d1a 1d1c-1d25 1d2c-1d42 1d44-1d46 1d4a-1d4c 1d4e 1d51 1d53-1d55 1d59-1d5a 1d5c 1d6b-1d77
  1d79-1d9b 1d9d-1d9f 1da1-1dba 1dbc-1dbe 1dfb 1e9c 200c-200f 2028-2029 2056 2058-205e 2060-2064
  206a-206f 20b0 20b6-20b7 20bb 2102 2104 2107-2108 210a-2112 2114-2115 2118-211d 2123-2125
  2127-2129 212c-212d 212f-2131 2133-213a 213c-214c 214e-214f 21a8 2215 2219 221f 2229 2261 2302
  2310 2320-2321 2500 2502 250c 2510 2514 2518 251c 2524 252c 2534 253c 2550-256c 2580 2584 2588
  258c 2590-2593 25ab-25ac 25cc 25d8-25d9 263a-263b 2640 2642 2660 2663 2666 266f 2c60-2c7b
  2c7d-2c7e 2e00-2e17 2e19-2e42 a717-a7ae a7b0-a7b7 a7f7-a7fe ab30-ab64 fb01-fb04 fe20-fe2d
  fffc-fffd
`
  .trim()
  .split(/\s+/)
  .flatMap((range) => {
    const [from, to = from] = range.split('-').map((hex) => parseInt(hex, 16))
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  })

const name = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

describe('isDrawable', () => {
  it('draws English text, accents and dashes included', () => {
    expect(isDrawable('House London')).toBe(true)
    expect(isDrawable('Café – naïve')).toBe(true)
  })

  it('refuses a script outside the English rule', () => {
    expect(isDrawable('سلام')).toBe(false)
  })

  it('draws every English code point that only Arimo maps', () => {
    expect(ARIMO_ONLY).toHaveLength(721)
    const refused = ARIMO_ONLY.filter((cp) => !isDrawable(String.fromCodePoint(cp))).map(name)
    expect(refused).toEqual([])
  })
})
