#!/usr/bin/env node
// tools/capture.mjs — 헤드리스 Chrome(CDP)으로 페이지 전체를 찍는다 (의존 없음, Node 22+)
//   node tools/capture.mjs <출력폴더> [기본주소=http://127.0.0.1:4173] [light|dark=light]
//   휴대폰 390×2배·데스크톱 1440×1배로 ko·en 첫 화면과 글마다 한 장씩. 가로 넘침도 같이 잰다.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const out = path.resolve(process.argv[2] || '.tmp/captures');
const base = (process.argv[3] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const scheme = process.argv[4] || 'light';
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('Chrome 을 못 찾았다. CHROME=<경로> 로 알려 준다.'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const PORT = 9333;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(out, '.profile')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserWs() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {} await sleep(250); }
  throw new Error('Chrome 디버그 포트가 안 열린다');
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); } else if (m.method) this.events.push(m); };
  }
  send(method, params = {}, sessionId) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params, sessionId })); return new Promise((res, rej) => this.pending.set(id, { res, rej, method })); }
  static async open(url) { const ws = new WebSocket(url); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); return new CDP(ws); }
}

async function shot(c, name, url, { width, height = 900, dpr = 1, mobile = false }) {
  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await c.send('Target.attachToTarget', { targetId, flatten: true });
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile }, s);
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, s);
  await c.send('Page.enable', {}, s);
  c.events.length = 0;
  await c.send('Page.navigate', { url }, s);
  for (let i = 0; i < 50; i++) { if (c.events.some((e) => e.method === 'Page.loadEventFired' && e.sessionId === s)) break; await sleep(100); }
  await c.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, s);
  await sleep(300);
  const { result } = await c.send('Runtime.evaluate', { expression: 'JSON.stringify({h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,w:innerWidth})', returnByValue: true }, s);
  const m = JSON.parse(result.value);
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(m.h, 6000), deviceScaleFactor: dpr, mobile }, s);
  await sleep(150);
  const { data } = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, s);
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`${name}.png  ${width}×${m.h}  ${m.sw > m.w ? '⚠ 가로 넘침 ' + m.sw + '>' + m.w : '넘침 없음'}`);
  await c.send('Target.closeTarget', { targetId }).catch(() => {});
}

const pages = JSON.parse(fs.readFileSync(path.resolve('dist/ko/search.json'), 'utf8')).map((p) => p.u);
try {
  const c = await CDP.open(await browserWs());
  for (const lang of ['ko', 'en']) {
    await shot(c, `phone-${lang}-home`, `${base}/${lang}/`, { width: 390, dpr: 2, mobile: true });
    await shot(c, `desktop-${lang}-home`, `${base}/${lang}/`, { width: 1440 });
    for (const u of pages) {
      const slug = u.replace(/\/$/, '');
      if (!fs.existsSync(path.resolve(`dist/${lang}/${slug}/index.html`))) continue;
      await shot(c, `phone-${lang}-${slug}`, `${base}/${lang}/${u}`, { width: 390, dpr: 2, mobile: true });
      await shot(c, `desktop-${lang}-${slug}`, `${base}/${lang}/${u}`, { width: 1440 });
    }
  }
  c.ws.close();
} finally {
  chrome.kill();
}
