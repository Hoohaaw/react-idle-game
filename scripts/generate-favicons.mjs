// Regenerates the sized favicon/manifest PNGs and the Open Graph card from public/favicon.svg.
// Rasterizes with a headless Chromium (Playwright, already a devDependency) instead of adding an
// image-processing package — re-run this whenever favicon.svg changes.
//
//   node scripts/generate-favicons.mjs
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const svg = readFileSync(join(publicDir, 'favicon.svg'), 'utf8')

const BG_DEEP = '#0f0305'
const GOLD_LIGHT = '#f0d060'
const GOLD_MID = '#c9922a'

// Icons: logo centered with ~14% padding, transparent background (standard for favicon/manifest
// icons — browsers/launchers supply their own background).
const icons = [
  { file: 'favicon-16x16.png', size: 16, padding: 0.1, transparent: true },
  { file: 'favicon-32x32.png', size: 32, padding: 0.1, transparent: true },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.16, transparent: false },
  { file: 'android-chrome-192x192.png', size: 192, padding: 0.14, transparent: true },
  { file: 'android-chrome-512x512.png', size: 512, padding: 0.14, transparent: true },
]

function iconHtml(padding, transparent) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:${transparent ? 'transparent' : BG_DEEP};}
    .wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:${padding * 100}%;}
    svg{width:100%;height:100%;}
  </style></head><body><div class="wrap">${svg}</div></body></html>`
}

function ogHtml() {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;}
    .wrap{
      width:1200px;height:630px;box-sizing:border-box;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:28px;
      background:
        radial-gradient(ellipse at 50% 30%, rgba(126,20,255,0.35) 0%, rgba(126,20,255,0) 60%),
        ${BG_DEEP};
      font-family:Georgia,serif;
    }
    .logo{width:180px;height:auto;}
    h1{
      margin:0;color:${GOLD_LIGHT};font-size:72px;letter-spacing:2px;
      text-shadow:0 0 24px rgba(240,208,96,0.45);
    }
    p{margin:0;color:${GOLD_MID};font-size:32px;letter-spacing:3px;text-transform:uppercase;}
  </style></head><body>
    <div class="wrap">
      <div class="logo">${svg}</div>
      <h1>The Idle Game</h1>
      <p>Browser Idle RPG</p>
    </div>
  </body></html>`
}

const browser = await chromium.launch()
const page = await browser.newPage()

for (const { file, size, padding, transparent } of icons) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(iconHtml(padding, transparent))
  const buf = await page.screenshot({ omitBackground: transparent })
  writeFileSync(join(publicDir, file), buf)
  console.log(`wrote public/${file} (${size}x${size})`)
}

await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(ogHtml())
const ogBuf = await page.screenshot()
writeFileSync(join(publicDir, 'og-image.png'), ogBuf)
console.log('wrote public/og-image.png (1200x630)')

await browser.close()
