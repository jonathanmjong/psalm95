// One-off generator for the site's default social-share card (public/og.png, 1200x630).
//
// Zero new dependencies: it renders a self-contained HTML page (the site's gradient
// aesthetic + the heart logo mark from src/components/Logo.tsx) and screenshots it with
// the locally installed Chrome/Chromium in headless mode. The resulting PNG is committed,
// so `npm run build` never depends on this script or on a browser being present.
//
//   node scripts/generate-og-image.mjs            # writes public/og.png
//   CHROME_PATH=/path/to/chrome node scripts/...  # explicit browser
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../public/og.png')

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

const chrome = CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error(
    'No Chrome/Chromium found. Set CHROME_PATH=/path/to/chrome and re-run.\n' +
      '(public/og.png is committed, so this is only needed when redesigning the card.)',
  )
  process.exit(1)
}

// The heart mark: same path + gradient stops as src/components/Logo.tsx, drawn without
// the rounded-square plate so the glyph reads at small preview sizes.
const heart = `
<svg width="132" height="132" viewBox="0 0 512 512" aria-hidden="true">
  <defs>
    <mask id="m">
      <path transform="scale(21.333)" fill="#fff"
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      <rect x="196" y="205" width="30" height="120" rx="15" fill="#000" />
      <rect x="241" y="175" width="30" height="180" rx="15" fill="#000" />
      <rect x="286" y="205" width="30" height="120" rx="15" fill="#000" />
    </mask>
  </defs>
  <rect width="512" height="512" fill="#fff" mask="url(#m)" />
</svg>`

const html = `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    /* --color-accent #ff375f through the logo gradient's violet, plus hero-glow washes. */
    background:
      radial-gradient(70% 90% at 12% 0%, rgba(255, 255, 255, 0.30), transparent 62%),
      radial-gradient(60% 80% at 92% 100%, rgba(88, 28, 235, 0.55), transparent 65%),
      linear-gradient(125deg, #ff375f 0%, #c026d3 55%, #7c3aed 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif;
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 84px;
    -webkit-font-smoothing: antialiased;
  }
  .brand { display: flex; align-items: center; gap: 28px; }
  .wordmark { font-size: 92px; font-weight: 800; letter-spacing: -0.035em; }
  h1 {
    margin-top: 44px;
    font-size: 104px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.02;
    text-shadow: 0 6px 40px rgba(0, 0, 0, 0.22);
  }
  p {
    margin-top: 30px;
    font-size: 44px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.94);
  }
  .dot { opacity: 0.6; padding: 0 6px; }
  .rule { margin-top: 46px; width: 176px; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.85); }
</style></head>
<body>
  <div class="brand">${heart}<span class="wordmark">PsalmTune</span></div>
  <h1>The people's ranking</h1>
  <p>K-pop <span class="dot">·</span> C-pop <span class="dot">·</span> J-pop</p>
  <div class="rule"></div>
</body></html>`

const work = mkdtempSync(join(tmpdir(), 'psalmtune-og-'))
try {
  const page = join(work, 'og.html')
  writeFileSync(page, html)
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      '--screenshot=' + join(work, 'shot.png'),
      'file://' + page,
    ],
    { stdio: 'ignore' },
  )
  copyFileSync(join(work, 'shot.png'), out)
  console.log(`Wrote ${out} (1200x630) using ${chrome}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
