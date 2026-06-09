/**
 * generate-icon.mjs
 *
 * Creates build/icon.png (512×512 RGBA) using only Node.js built-in modules.
 * Run: node scripts/generate-icon.mjs
 *
 * Design: premium transparent two-layer shield
 *   - Shield body (dark navy gradient: #1e3a6e → #091e40)
 *   - Outer border (bright sky-blue: #38bdf8, stroke ~4 px)
 *   - Inner concentric shield border (lighter, stroke ~2 px)
 *   - Top metallic shine overlay
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../build/icon.png')
mkdirSync(join(__dirname, '../build'), { recursive: true })

const W = 512, H = 512

// ── Bezier sampling ──────────────────────────────────────────────────────────

const cb = (t, a, b, c, d) => {
  const u = 1 - t
  return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d
}
const qb = (t, a, b, c) => {
  const u = 1 - t
  return u*u*a + 2*u*t*b + t*t*c
}

function sampleShield(N = 50) {
  // Path: M256,40 C338,40 452,96 452,132 L452,282 Q452,408 256,472 Q56,408 56,282 L56,132 C56,96 174,40 256,40 Z
  const xs = [], ys = []
  const s = 1 / N
  for (let i = 0; i <= N; i++) {
    const t = i * s
    xs.push(cb(t, 256, 338, 452, 452)); ys.push(cb(t, 40, 40, 96, 132))
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(452); ys.push(132 + t * 150)
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(qb(t, 452, 452, 256)); ys.push(qb(t, 282, 408, 472))
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(qb(t, 256, 56, 56)); ys.push(qb(t, 472, 408, 282))
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(56); ys.push(282 - t * 150)
  }
  for (let i = 1; i < N; i++) {
    const t = i * s
    xs.push(cb(t, 56, 56, 174, 256)); ys.push(cb(t, 132, 96, 40, 40))
  }
  return { xs, ys }
}

function sampleInnerShield(N = 50) {
  // Inset ~38 px from outer
  // M256,80 C328,80 418,126 418,158 L418,282 Q418,392 256,438 Q94,392 94,282 L94,158 C94,126 184,80 256,80 Z
  const xs = [], ys = []
  const s = 1 / N
  for (let i = 0; i <= N; i++) {
    const t = i * s
    xs.push(cb(t, 256, 328, 418, 418)); ys.push(cb(t, 80, 80, 122, 158))
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(418); ys.push(158 + t * 124)
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(qb(t, 418, 418, 256)); ys.push(qb(t, 282, 392, 438))
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(qb(t, 256, 94, 94)); ys.push(qb(t, 438, 392, 282))
  }
  for (let i = 1; i <= N; i++) {
    const t = i * s
    xs.push(94); ys.push(282 - t * 124)
  }
  for (let i = 1; i < N; i++) {
    const t = i * s
    xs.push(cb(t, 94, 94, 184, 256)); ys.push(cb(t, 158, 122, 80, 80))
  }
  return { xs, ys }
}

// ── Rasterization helpers ────────────────────────────────────────────────────

/** Ray-casting point-in-polygon. */
function pip(px, py, xs, ys) {
  let inside = false
  const n = xs.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = xs[i], yi = ys[i], xj = xs[j], yj = ys[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2). */
function ptSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy)
}

/** Minimum distance from point to polygon edges. */
function distToPolygon(px, py, xs, ys) {
  let minD = Infinity
  const n = xs.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const d = ptSegDist(px, py, xs[i], ys[i], xs[j], ys[j])
    if (d < minD) minD = d
  }
  return minD
}

// ── Pixel buffer ─────────────────────────────────────────────────────────────

const buf = new Uint8Array(W * H * 4)

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 4
  // Alpha-blend over existing
  const srcA = a / 255
  const dstA = buf[i + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA === 0) return
  buf[i]     = Math.round((r * srcA + buf[i]     * dstA * (1 - srcA)) / outA)
  buf[i + 1] = Math.round((g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA)
  buf[i + 2] = Math.round((b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA)
  buf[i + 3] = Math.round(outA * 255)
}

// ── Draw ─────────────────────────────────────────────────────────────────────

const outer = sampleShield(80)
const inner = sampleInnerShield(80)

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (pip(x, y, outer.xs, outer.ys)) {
      // Shield body gradient: #1e3a6e (top) → #091e40 (bottom)
      const t = Math.max(0, Math.min(1, (y - 40) / 432))
      const r = Math.round(30 * (1 - t) + 9 * t)
      const g = Math.round(58 * (1 - t) + 30 * t)
      const b = Math.round(110 * (1 - t) + 64 * t)
      setPixel(x, y, r, g, b)
    }
  }
}

// Outer border: pixels within 3.5 px of outer polygon edge AND inside the polygon
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = distToPolygon(x, y, outer.xs, outer.ys)
    if (d <= 3.5) {
      // Border color gradient: #60a5fa (top) → #1d4ed8 (bottom), opacity based on distance
      const alpha = Math.round(255 * Math.max(0, 1 - d / 3.5) * 0.95)
      const t = Math.max(0, Math.min(1, (y - 40) / 432))
      const r = Math.round(96 * (1 - t) + 29 * t)
      const g = Math.round(165 * (1 - t) + 78 * t)
      const b = Math.round(250 * (1 - t) + 216 * t)
      setPixel(x, y, r, g, b, alpha)
    }
  }
}

// Inner concentric border: pixels within 2 px of inner polygon edge
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = distToPolygon(x, y, inner.xs, inner.ys)
    if (d <= 2.0) {
      // Inner border: lighter blue, #bae6fd → fades at bottom
      const alpha = Math.round(255 * Math.max(0, 1 - d / 2.0) * 0.55)
      const t = Math.max(0, Math.min(1, (y - 80) / 358))
      const r = Math.round(186 * (1 - t) + 56 * t)
      const g = Math.round(230 * (1 - t) + 189 * t)
      const b = Math.round(253 * (1 - t) + 253 * t)
      setPixel(x, y, r, g, b, alpha)
    }
  }
}

// Top metallic shine: white gradient fading from y=40 to y=200, clipped to shield
for (let y = 40; y < 200; y++) {
  const alpha = Math.round(52 * (1 - (y - 40) / 160))
  for (let x = 0; x < W; x++) {
    if (pip(x, y, outer.xs, outer.ys)) {
      setPixel(x, y, 255, 255, 255, alpha)
    }
  }
}

// ── PNG encode ───────────────────────────────────────────────────────────────

function crc32(data) {
  const tbl = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    tbl[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) crc = tbl[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  typeBytes.copy(out, 4)
  data.copy(out, 8)
  const crcBuf = Buffer.concat([typeBytes, data])
  out.writeUInt32BE(crc32(crcBuf), 8 + data.length)
  return out
}

// IHDR
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGBA

// Scanlines: prepend filter byte 0 to each row
const raw = Buffer.alloc(H * (1 + W * 4))
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0
  for (let x = 0; x < W; x++) {
    const src = (y * W + x) * 4
    const dst = y * (1 + W * 4) + 1 + x * 4
    raw[dst]     = buf[src]
    raw[dst + 1] = buf[src + 1]
    raw[dst + 2] = buf[src + 2]
    raw[dst + 3] = buf[src + 3]
  }
}

const compressed = deflateSync(raw, { level: 6 })

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0))
])

writeFileSync(OUT, png)
console.log(`[generate-icon] wrote ${OUT} (${(png.length / 1024).toFixed(1)} KB)`)
