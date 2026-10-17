#!/usr/bin/env node
// tools/check.mjs — dist/ 안의 상대 링크가 전부 실제 파일을 가리키는지 본다 (빌드 뒤, 올리기 전)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
let bad = 0, checked = 0;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

for (const file of walk(DIST)) {
  if (path.relative(DIST, file) === '404.html') continue; // 뿌리 404 만 절대 경로(설명은 build.mjs notFoundPage)
  const html = fs.readFileSync(file, 'utf8');
  const base = path.dirname(file);
  for (const m of html.matchAll(/\b(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:|\/\/)/.test(url)) continue;
    if (url.startsWith('/')) { console.error(`✗ ${path.relative(DIST, file)} → 절대 경로 ${url} (Pages 기본 주소에서 깨진다)`); bad++; continue; }
    let target = path.resolve(base, url);
    if (url.endsWith('/')) target = path.join(target, 'index.html');
    checked++;
    if (!fs.existsSync(target)) { console.error(`✗ ${path.relative(DIST, file)} → ${url} 없음`); bad++; }
  }
}
if (bad) { console.error(`✗ 깨진 링크 ${bad}개`); process.exit(1); }
console.log(`✓ 링크 ${checked}개 확인, 깨진 것 없음`);
