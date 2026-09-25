import { mkdir, rename } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const COLORS = ['#1f7a45', '#f4ead2', '#d7a441', '#143528', '#efe2c2', '#0e5c36']
const RANKS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس']
const reels = [
  {
    file: 'artcake',
    name: 'آرت كيك',
    winners: ['soso_8183', 'alghalyahkhadeejah', 'maryam.m.q8', 'toto__qwex4', 'alysaad340'],
  },
  {
    file: 'klaraig',
    name: 'كلاريج',
    winners: ['beautifulcat_72', 'soso_khazaal', 'eman.hasan999'],
  },
  {
    file: 'quider',
    name: 'قويدر',
    winners: ['perlo1987', '_m662__', 'soso_khazaal'],
  },
]

function shortName(name) {
  const body = name.length > 12 ? `${name.slice(0, 11)}…` : name
  return `@${body}`
}

function slicePath(index, total) {
  const angle = (Math.PI * 2) / total
  const start = index * angle - Math.PI / 2
  const end = start + angle
  const radius = 148
  const x1 = 160 + radius * Math.cos(start)
  const y1 = 160 + radius * Math.sin(start)
  const x2 = 160 + radius * Math.cos(end)
  const y2 = 160 + radius * Math.sin(end)
  const large = angle > Math.PI ? 1 : 0
  return `M160 160 L${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
}

function pageHtml(reel) {
  const names = reel.winners.map((name) => `@${name}`)
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;700&family=IBM+Plex+Sans:wght@600;700&display=swap" rel="stylesheet" />
<style>
  html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #07110c; color: #f7f3ea; font-family: "IBM Plex Sans Arabic", Tahoma, sans-serif; }
  body { display: flex; flex-direction: column; padding: 72px 64px 56px; box-sizing: border-box; background: radial-gradient(ellipse at 50% 0, rgba(232,184,106,.28), transparent 42%), linear-gradient(180deg, #10261a, #07110c 70%); }
  .kicker { color: #e8b86a; font-weight: 700; letter-spacing: .12em; font-size: 28px; }
  h1 { margin: 18px 0 0; font-size: 84px; line-height: 1.05; }
  .score { margin-top: 18px; font-family: "IBM Plex Sans", sans-serif; font-size: 64px; font-weight: 700; color: #f6e2b8; }
  .score span { display: block; font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 28px; color: #b7c4b6; font-weight: 500; }
  .stage { flex: 1; display: grid; place-items: center; }
  .wheel { position: relative; width: 820px; height: 820px; }
  .pointer { position: absolute; z-index: 5; top: 8px; left: 50%; transform: translateX(-50%); }
  .rotor { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; transition: transform 3.4s cubic-bezier(.12,.7,.08,1); }
  .rotor svg { width: 100%; height: 100%; display: block; }
  .hub { position: absolute; z-index: 4; left: 50%; top: 50%; width: 150px; height: 150px; margin: -75px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #f8e7c0, #d7a441 46%, #8a5a16); color: #1a1408; font-size: 36px; font-weight: 700; box-shadow: inset 0 0 0 8px #1a140c; }
  .cards { display: grid; gap: 12px; min-height: 420px; }
  .card { display: flex; gap: 16px; align-items: center; padding: 16px 22px; border-radius: 24px; background: linear-gradient(180deg, #fffaf0, #f3ecdc); color: #1d241c; }
  .card b { display: block; font-size: 34px; direction: ltr; text-align: right; }
  .card small { color: #8a5a16; font-weight: 700; font-size: 22px; }
  .rank { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: #1a140c; color: #f6e2b8; font-family: "IBM Plex Sans", sans-serif; font-weight: 700; font-size: 26px; }
</style>
</head>
<body>
  <p class="kicker">سحب مباشر</p>
  <h1>${reel.name}</h1>
  <p class="score"><span>نتيجة السعودية × الكويت</span><bdi dir="ltr">1–0</bdi></p>
  <div class="stage">
    <div class="wheel">
      <svg class="pointer" viewBox="0 0 36 48" width="54" height="72"><path d="M18 48 3 16a15 15 0 1 1 30 0Z" fill="#f8e7c0"/><circle cx="18" cy="14" r="4.5" fill="#8a5a16"/></svg>
      <div class="rotor" id="rotor"></div>
      <div class="hub">سحب</div>
    </div>
  </div>
  <div class="cards" id="cards"></div>
<script>
const COLORS = ${JSON.stringify(COLORS)}
const RANKS = ${JSON.stringify(RANKS)}
const winners = ${JSON.stringify(names)}
function shortName(name) {
  const body = name.slice(1)
  return '@' + (body.length > 12 ? body.slice(0, 11) + '…' : body)
}
function slicePath(index, total) {
  const angle = (Math.PI * 2) / total
  const start = index * angle - Math.PI / 2
  const end = start + angle
  const radius = 148
  const x1 = 160 + radius * Math.cos(start)
  const y1 = 160 + radius * Math.sin(start)
  const x2 = 160 + radius * Math.cos(end)
  const y2 = 160 + radius * Math.sin(end)
  return 'M160 160 L' + x1 + ' ' + y1 + ' A' + radius + ' ' + radius + ' 0 ' + (angle > Math.PI ? 1 : 0) + ' 1 ' + x2 + ' ' + y2 + ' Z'
}
function draw(shown, winner) {
  const count = shown.length
  const parts = shown.map((name, index) => {
    const tone = index % COLORS.length
    const ink = tone === 1 || tone === 2 || tone === 4 ? '#142016' : '#f6f1e4'
    const angle = (index + 0.5) * (360 / count)
    const turns = ((angle % 360) + 360) % 360
    const flip = turns >= 180
    return '<g><path d="' + slicePath(index, count) + '" fill="' + COLORS[tone] + '"/><g transform="rotate(' + angle + ' 160 160)"><text x="160" y="78" text-anchor="middle" direction="ltr" unicode-bidi="plaintext" fill="' + ink + '" font-size="15" font-weight="700" font-family="IBM Plex Sans, Tahoma, sans-serif" transform="' + (flip ? 'rotate(90 160 78)' : 'rotate(-90 160 78)') + '">' + shortName(name) + '</text></g></g>'
  }).join('')
  document.getElementById('rotor').innerHTML = '<svg viewBox="0 0 320 320"><circle cx="160" cy="160" r="154" fill="#24180a"/>' + parts + '<circle cx="160" cy="160" r="152" fill="none" stroke="#f0d7a2" stroke-width="8"/></svg>'
  return shown.indexOf(winner)
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
let rotation = 0
async function run() {
  await document.fonts.ready
  draw(winners, winners[0])
  await sleep(900)
  const cards = document.getElementById('cards')
  const rotor = document.getElementById('rotor')
  for (const winner of winners) {
    const pool = winners.filter((name) => name !== winner)
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const swap = Math.floor(Math.random() * (i + 1))
      const current = pool[i]
      pool[i] = pool[swap]
      pool[swap] = current
    }
    const index = Math.floor(Math.random() * (pool.length + 1))
    pool.splice(index, 0, winner)
    const at = draw(pool, winner)
    await sleep(40)
    const slice = 360 / pool.length
    const desired = -((at + 0.5) * slice)
    const steps = ((rotation - desired) % 360 + 360) % 360
    rotation -= 360 * 6 + steps
    rotor.style.transform = 'rotate(' + rotation + 'deg)'
    await sleep(3600)
    const card = document.createElement('article')
    card.className = 'card'
    const place = cards.children.length
    card.innerHTML = '<span class="rank">' + (place + 1) + '</span><div><small>الفائز ' + (RANKS[place] || place + 1) + '</small><b dir="ltr">' + winner + '</b></div>'
    cards.appendChild(card)
    await sleep(700)
  }
  await sleep(1600)
  window.reelDone = true
}
run()
</script>
</body>
</html>`
}

const dir = 'stories'
await mkdir(dir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
for (const reel of reels) {
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    recordVideo: { dir, size: { width: 1080, height: 1920 } },
  })
  const page = await context.newPage()
  await page.setContent(pageHtml(reel), { waitUntil: 'load' })
  await page.waitForFunction(() => window.reelDone === true, null, { timeout: 120000 })
  const video = page.video()
  await page.close()
  await context.close()
  const webm = `${dir}/${reel.file}.webm`
  await video.saveAs(webm)
  console.log('recorded', webm)
}
await browser.close()

const require = createRequire(import.meta.url)
let ffmpeg = ''
try {
  ffmpeg = require('ffmpeg-static')
} catch {
  spawnSync('npm', ['install', '--no-save', 'ffmpeg-static'], { stdio: 'inherit', shell: true })
  ffmpeg = require('ffmpeg-static')
}
for (const reel of reels) {
  const webm = `${dir}/${reel.file}.webm`
  const mp4 = `${dir}/${reel.file}-story.mp4`
  const result = spawnSync(ffmpeg, ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${reel.file}`)
  console.log('mp4', mp4)
}
