export type Point = { x: number; y: number }
export type Box = { left: number; top: number; right: number; bottom: number }

/** Slack around the corridor edges, so slow or wobbly travel to the card still holds it. */
export const PREVIEW_CORRIDOR_BUFFER_PX = 8

function inBox(p: Point, box: Box): boolean {
  return p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(a, b, p)
  const d2 = cross(b, c, p)
  const d3 = cross(c, a, p)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
    : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * True inside the card, or on the path from `from` to the card: the hull of the
 * point and the card's real rect, so flip and shift need no special case.
 */
export function inPreviewCorridor(
  p: Point,
  from: Point,
  card: Box,
  buffer = PREVIEW_CORRIDOR_BUFFER_PX
): boolean {
  if (inBox(p, card)) return true
  const corners: Point[] = [
    { x: card.left, y: card.top },
    { x: card.right, y: card.top },
    { x: card.right, y: card.bottom },
    { x: card.left, y: card.bottom }
  ]
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]
    if (inTriangle(p, from, a, corners[(i + 1) % corners.length])) return true
    if (distanceToSegment(p, from, a) <= buffer) return true
  }
  return false
}
