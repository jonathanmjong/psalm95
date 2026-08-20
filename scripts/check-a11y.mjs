#!/usr/bin/env node
/**
 * Keyboard-accessibility check for the shared Modal (src/components/Modal.tsx), driven
 * through Chrome DevTools Protocol against a running site. The modal contract — focus moves
 * in, Tab and Shift+Tab stay trapped, Escape closes, focus returns to the trigger, body
 * scroll locks and releases — is the kind of thing that only reading the code cannot
 * confirm, so this exercises it for real.
 *
 * Usage:
 *   node scripts/check-a11y.mjs                        # against production
 *   BASE_URL=http://localhost:4173 node scripts/check-a11y.mjs
 *   CHROME_PATH=/path/to/chrome node scripts/check-a11y.mjs
 *
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
const BASE_URL = process.env.BASE_URL || 'https://psalmtune.com'

/** CHROME_PATH wins; otherwise take the first browser that exists, so this runs unchanged on
 *  a developer's Mac and on a Linux CI runner. */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]
  const found = candidates.find((p) => existsSync(p))
  if (!found) {
    console.error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.')
    process.exit(2)
  }
  return found
}

const CHROME = findChrome()
// A fresh profile per run: a reused one replays the previous run's IndexedDB and service
// worker, which makes results depend on what ran before.
const PROFILE = `/tmp/a11yprof-${process.pid}`
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--remote-debugging-port=9333','--no-first-run',`--user-data-dir=${PROFILE}`,'about:blank'],{stdio:'ignore'})
const sleep = ms => new Promise(r=>setTimeout(r,ms))
await sleep(2500)
const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const page = targets.find(t=>t.type==='page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id=0; const pending=new Map()
ws.onmessage = e => { const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m); pending.delete(m.id)} }
await new Promise(r=>ws.onopen=r)
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}))})
const evalJs = async expr => { const r = await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true}); return r.result?.result?.value }
const key = async (type,k,code,keyCode) => { await send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode}); }
const press = async (k,code,kc) => { await key('rawKeyDown',k,code,kc); await key('keyUp',k,code,kc); await sleep(250) }

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate',{url: BASE_URL + '/artist/blackpink'})
await sleep(6000)

const results = []
const check = (name, pass, detail='') => { results.push({name,pass,detail}); console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?' — '+detail:''}`) }

// find a picture thumbnail and focus it, then open the lightbox
const opened = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /Open .* picture/i.test(b.getAttribute('aria-label')||''));
  if (!btn) return 'nobutton';
  btn.setAttribute('data-trigger','1'); btn.focus(); btn.click(); return 'clicked';
})()`)
await sleep(1200)
check('lightbox opens from a photo', opened === 'clicked', String(opened))

const dialogInfo = await evalJs(`(() => {
  const d = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (!d) return null;
  return { hasName: !!(d.getAttribute('aria-label')||d.getAttribute('aria-labelledby')),
           focusInside: d.contains(document.activeElement),
           activeTag: document.activeElement?.tagName,
           bodyLocked: getComputedStyle(document.body).overflow === 'hidden' };
})()`)
check('dialog present with accessible name', !!dialogInfo?.hasName)
check('focus moved into dialog on open', !!dialogInfo?.focusInside, 'active='+dialogInfo?.activeTag)
check('body scroll locked', !!dialogInfo?.bodyLocked)

// Tab through more elements than the dialog holds; focus must never leave it
for (let i=0;i<12;i++) await press('Tab','Tab',9)
const stillInside = await evalJs(`(() => { const d=document.querySelector('[role="dialog"]'); return d ? d.contains(document.activeElement) : 'nodialog' })()`)
check('focus trapped after 12 Tabs', stillInside === true, 'inside='+stillInside)

// Shift+Tab backwards past the start
for (let i=0;i<6;i++){ await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8}); await sleep(200) }
const stillInside2 = await evalJs(`(() => { const d=document.querySelector('[role="dialog"]'); return d ? d.contains(document.activeElement) : 'nodialog' })()`)
check('focus trapped after 6 Shift+Tabs', stillInside2 === true, 'inside='+stillInside2)

// Escape closes, focus returns to the trigger
await press('Escape','Escape',27)
await sleep(600)
const afterEsc = await evalJs(`(() => ({
  dialogGone: !document.querySelector('[role="dialog"][aria-modal="true"]'),
  focusRestored: document.activeElement?.getAttribute?.('data-trigger') === '1',
  bodyUnlocked: getComputedStyle(document.body).overflow !== 'hidden'
}))()`)
check('Escape closes the dialog', !!afterEsc?.dialogGone)
check('focus restored to trigger', !!afterEsc?.focusRestored)
check('body scroll released', !!afterEsc?.bodyUnlocked)

console.log('\n' + results.filter(r=>r.pass).length + '/' + results.length + ' passed')
ws.close(); chrome.kill()
process.exit(results.every(r=>r.pass)?0:1)
