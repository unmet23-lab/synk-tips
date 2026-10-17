#!/usr/bin/env node
// tools/capture.mjs — 헤드리스 Chrome(CDP)으로 페이지 전체를 찍는다 (의존 없음, Node 22+)
//   node tools/capture.mjs <출력폴더> [기본주소=http://127.0.0.1:4173] [light|dark=light]
//   휴대폰 390×2배·데스크톱 1440×1배로 ko·en 첫 화면과 글마다 한 장씩.
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

async function waitReady() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {} await sleep(250); }
  throw new Error('Chrome 디버그 포트가 안 열린다');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else if (m.method) this.events.push(m); }; }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
  static async open(url) { const ws = new WebSocket(url); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); return new CDP(ws); }
}

async function shot(name, url, { width, height = 900, dpr = 1, mobile = false }) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  const c = await CDP.open(target.webSocketDebuggerUrl);
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await c.send('Page.enable');
  await c.send('Page.navigate', { url });
  for (let i = 0; i < 40; i++) { if (c.events.some((e) => e.method === 'Page.loadEventFired')) break; await sleep(100); }
  await c.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  await sleep(300);
  const { result } = await c.send('Runtime.evaluate', { expression: 'JSON.stringify({h:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,w:innerWidth})', returnByValue: true });
  const m = JSON.parse(result.value);
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(m.h, 6000), deviceScaleFactor: dpr, mobile });
  await sleep(150);
  const { data } = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`${name}.png  ${width}×${m.h}  ${m.sw > m.w ? '⚠ 가로 넘침 ' + m.sw + '>' + m.w : '넘침 없음'}`);
  await c.send('Target.closeTarget', { targetId: target.id }).catch(() => {});
  c.ws.close();
}

const pages = JSON.parse(fs.readFileSync(path.resolve('dist/ko/search.json'), 'utf8')).map((p) => p.u);
try {
  await waitReady();
  for (const lang of ['ko', 'en']) {
    await shot(`phone-${lang}-home`, `${base}/${lang}/`, { width: 390, dpr: 2, mobile: true });
    await shot(`desktop-${lang}-home`, `${base}/${lang}/`, { width: 1440 });
    for (const u of pages) {
      const slug = u.replace(/\/$/, '');
      if (!fs.existsSync(path.resolve(`dist/${lang}/${slug}/index.html`))) continue;
      await shot(`phone-${lang}-${slug}`, `${base}/${lang}/${u}`, { width: 390, dpr: 2, mobile: true });
      await shot(`desktop-${lang}-${slug}`, `${base}/${lang}/${u}`, { width: 1440 });
    }
  }
} finally {
  chrome.kill();
}
