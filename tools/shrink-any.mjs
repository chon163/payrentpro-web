// ย่อรูปอะไรก็ได้ (jpg/png) ผ่าน Chromium canvas — ใช้ตอนไม่มี sharp/magick
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const [srcArg, outArg, wArg] = process.argv.slice(2)
const maxW = Number(wArg || 520)
const src = path.resolve(srcArg)
const buf = fs.readFileSync(src)
const ext = path.extname(src).toLowerCase() === '.png' ? 'png' : 'jpeg'
const dataUrl = `data:image/${ext};base64,${buf.toString('base64')}`

const b = await chromium.launch()
const p = await b.newPage()
const out = await p.evaluate(async ({ dataUrl, maxW }) => {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxW / img.naturalWidth)
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  const cx = c.getContext('2d')
  cx.imageSmoothingQuality = 'high'
  cx.drawImage(img, 0, 0, c.width, c.height)
  return { url: c.toDataURL('image/png'), w: c.width, h: c.height, ow: img.naturalWidth, oh: img.naturalHeight }
}, { dataUrl, maxW })
await b.close()

fs.writeFileSync(path.resolve(outArg), Buffer.from(out.url.split(',')[1], 'base64'))
console.log(`${path.basename(src)} ${out.ow}x${out.oh} -> ${out.w}x${out.h} ${(fs.statSync(path.resolve(outArg)).size / 1024).toFixed(0)}KB`)
