import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const [srcArg, outArg, maxWArg] = process.argv.slice(2)
const maxW = Number(maxWArg || 760)
const src = path.resolve(srcArg)
const out = path.resolve(outArg)

const png = PNG.sync.read(fs.readFileSync(src))
const scale = Math.min(1, maxW / png.width)
const w = Math.max(1, Math.round(png.width * scale))
const h = Math.max(1, Math.round(png.height * scale))
const dst = new PNG({ width: w, height: h })
// box-average downsample
const bx = png.width / w
const by = png.height / h
for (let y = 0; y < h; y++) {
  const y0 = Math.floor(y * by), y1 = Math.min(png.height, Math.max(y0 + 1, Math.floor((y + 1) * by)))
  for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * bx), x1 = Math.min(png.width, Math.max(x0 + 1, Math.floor((x + 1) * bx)))
    let r = 0, g = 0, b = 0, a = 0, n = 0
    for (let sy = y0; sy < y1; sy++) {
      for (let sx = x0; sx < x1; sx++) {
        const i = (png.width * sy + sx) << 2
        r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; a += png.data[i + 3]; n++
      }
    }
    const o = (w * y + x) << 2
    dst.data[o] = Math.round(r / n); dst.data[o + 1] = Math.round(g / n)
    dst.data[o + 2] = Math.round(b / n); dst.data[o + 3] = Math.round(a / n)
  }
}
fs.writeFileSync(out, PNG.sync.write(dst, { colorType: 2 }))
console.log(`${path.basename(src)} ${png.width}x${png.height} -> ${w}x${h}  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`)
