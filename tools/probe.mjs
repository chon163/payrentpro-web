import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const now = Date.now()
const SESSION = {
  access_token: 'stub', refresh_token: 'stub-r', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(now / 1000) + 3600,
  user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'founder@payrentpro.com', app_metadata: {}, user_metadata: {}, created_at: new Date(now).toISOString() },
}

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) }))
await ctx.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
await ctx.addInitScript((s) => {
  localStorage.setItem('sb-ceanwvsvbiktbwydvyyi-auth-token', JSON.stringify(s))
  localStorage.setItem('payrentpro_pdpa', '1')
}, SESSION)
const p = await ctx.newPage()
p.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 200)))
await p.goto(BASE + '/assets', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
console.log('--- localStorage keys ---')
console.log(await p.evaluate(() => Object.keys(localStorage)))
console.log('--- body text (first 400) ---')
console.log((await p.evaluate(() => document.body.innerText)).slice(0, 400))
await b.close()
