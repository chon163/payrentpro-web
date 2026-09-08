import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
const [srcArg, outArg, yArg, hArg] = process.argv.slice(2)
const y0 = Number(yArg || 0), hh = Number(hArg || 900)
const png = PNG.sync.read(fs.readFileSync(path.resolve(srcArg)))
const h = Math.min(hh, png.height - y0)
const dst = new PNG({ width: png.width, height: h })
PNG.bitblt(png, dst, 0, y0, png.width, h, 0, 0)
fs.writeFileSync(path.resolve(outArg), PNG.sync.write(dst, { colorType: 2 }))
console.log(`crop ${png.width}x${h} @y=${y0}`)
