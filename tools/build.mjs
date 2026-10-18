#!/usr/bin/env node
// tools/build.mjs — posts/*.md → dist/  (의존: marked 하나)
//
//   posts/<slug>.ko.md + posts/<slug>.en.md  →  dist/ko/<slug>/  dist/en/<slug>/
//   첫 화면·주제 페이지·전체 글·검색 색인(search.json)·RSS(feed.xml)·sitemap 을 같이 만든다.
//   안쪽 링크는 전부 상대 경로라 tips.synk.im 에서도, GitHub Pages 기본 주소(/synk-tips/)에서도 열린다.
//
//   node tools/build.mjs            → dist/
//   SITE_URL=https://… node …       → canonical·RSS 에 쓰는 절대 주소(기본 https://tips.synk.im)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(ROOT, 'posts');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://tips.synk.im').replace(/\/$/, '');
const REPO_URL = process.env.REPO_URL || readJson(path.join(ROOT, 'site.json')).repo || '';
// Cloudflare Web Analytics(쿠키 없음, 무료). 번호는 모든 페이지에 실리는 공개 값이다. 빈칸이면 넣지 않는다.
const CF_BEACON = process.env.CF_BEACON ?? readJson(path.join(ROOT, 'site.json')).cfBeacon ?? '';
const beaconTag = () => (CF_BEACON ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_BEACON.replace(/[^a-f0-9]/gi, '')}"}'></script>\n` : '');
const LANGS = ['ko', 'en'];
const DEFAULT_LANG = 'ko';
const TOPICS = readJson(path.join(ROOT, 'topics.json'));
const RESERVED_SLUGS = ['topic', 'posts', 'assets', 'img'];
const PHOTO = 'assets/img/yuho-w320.webp';

const LEVELS = {
  beginner: { ko: '초급', en: 'Beginner', order: 1 },
  intermediate: { ko: '중급', en: 'Intermediate', order: 2 },
  advanced: { ko: '고급', en: 'Advanced', order: 3 },
};
const LEVEL_ALIAS = { '초급': 'beginner', '중급': 'intermediate', '고급': 'advanced', beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' };

// 글 틀의 절 이름 → 절 종류(다시 확인은 체크 목록, 함정은 호박색 칸으로 그린다)
const SEC_KIND = { '증상': 'symptom', 'symptom': 'symptom', '원인·원리': 'cause', 'cause and principle': 'cause', '고침': 'fix', 'fix': 'fix', '다시 확인': 'check', 'check again': 'check', '함정': 'trap', 'pitfalls': 'trap' };
const LANG_NAME = { powershell: 'PowerShell', ps1: 'PowerShell', pwsh: 'PowerShell', bash: 'Terminal', sh: 'Terminal', shell: 'Terminal', console: 'Terminal', python: 'Python', py: 'Python', json: 'JSON', js: 'JavaScript', javascript: 'JavaScript' };

const T = {
  ko: {
    name: 'SYNK Tips', tagline: '유호가 SYNK를 만들며 모은 개발 꿀팁', by: 'by yuhobuilds', author: '유호',
    nav: { start: '처음이면 여기부터', topics: '주제', latest: '최근 글' },
    heroEyebrow: 'Tips · by yuhobuilds', heroA: '막혔던 자리에서', heroB: '바로 적은 개발 꿀팁',
    heroLead: 'Claude 앱과 윈도우에서 AI 도구를 쓰다 막힌 순간을 그대로 적었습니다.',
    heroLead2: '글마다 바로 답부터 드리고, 왜 그런지와 다음부터 막는 법을 같이 둡니다.',
    findPlaceholder: '막힌 증상을 그대로 적어 보세요', findGo: '찾기', often: '많이 찾는 증상',
    featured: '이번에 쓴 글', readGo: '읽기', coverSymptom: '막힌 화면',
    startLead: '순서대로 읽으면 AI 도구를 처음 쓸 때 막히는 고비를 하나씩 넘습니다.', startTotal: (n) => `모두 읽는 데 약 ${n}분`,
    topicsTitle: '주제로 찾기', soon: '준비 중', latestTitle: '최근 글', seeAll: '전체 보기',
    allTitle: '모든 글', allLead: (n) => `지금까지 쓴 글 ${n}편입니다. 새 글부터 놓았습니다.`,
    topicLead: (name, n) => `${name}에서 막힌 일 ${n}편입니다.`,
    bylineTitle: '유호가 직접 막혀 보고 적습니다', bylineLead: '개발을 하나도 몰랐던 사람이 AI로 회사를 만들고 있습니다. 같은 이야기를 영상으로도 올려요.',
    search: '검색', searchPlaceholder: '증상이나 도구 이름으로 찾기', noResults: '맞는 글이 없어요',
    copy: '복사', toc: '이 글의 차례', mtoc: '차례', readTime: (n) => `읽는 데 ${n}분`,
    next: { start: (i, n) => `처음이면 여기부터 · ${i} / ${n}`, topic: '같은 주제의 다른 글', latest: '최근 글' },
    otherLang: 'EN', thisLang: 'KR', otherLangTitle: 'English version', home: '첫 화면', feed: 'RSS',
    footerLine: '유호가 SYNK를 만들며 막힌 자리마다 적어 두는 개발 꿀팁입니다. 글은 마크다운 파일 하나로 올라갑니다.',
    site: 'SYNK', edit: '글 고치기 제안', notFound: '그 주소에는 글이 없어요', notFoundLead: '주소가 바뀌었거나 아직 안 쓴 글입니다.',
    levelLegend: { beginner: '처음이어도 따라 할 수 있는 글', intermediate: '도구를 조금 써 본 사람', advanced: '원리까지 파는 글' },
    menu: '메뉴', skip: '본문으로 바로 가기',
    head: { answer: '바로 답', why: '왜 이런가', prevent: '다음부터 막기', takeaway: '가져갈 것', for: '이런 분께', read: '읽는 데', min: (n) => `${n}분`, level: '난이도' },
  },
  en: {
    name: 'SYNK Tips', tagline: 'Dev tips Yuho collected while building SYNK', by: 'by yuhobuilds', author: 'Yuho',
    nav: { start: 'Start here', topics: 'Topics', latest: 'Latest' },
    heroEyebrow: 'Tips · by yuhobuilds', heroA: 'Dev tips written', heroB: 'right where I got stuck',
    heroLead: 'Moments I got stuck using Claude and other AI tools on Windows, written down as they happened.',
    heroLead2: 'Every post opens with the quick answer, then why it happens and how to stop it next time.',
    findPlaceholder: 'Type the symptom as you saw it', findGo: 'Search', often: 'Common symptoms',
    featured: 'Newest post', readGo: 'Read', coverSymptom: 'What you see',
    startLead: 'Read these in order to get past the first walls people hit with AI tools.', startTotal: (n) => `About ${n} min in total`,
    topicsTitle: 'Browse by topic', soon: 'Coming soon', latestTitle: 'Latest posts', seeAll: 'See all',
    allTitle: 'All posts', allLead: (n) => `${n} post${n === 1 ? '' : 's'} so far, newest first.`,
    topicLead: (name, n) => `${n} post${n === 1 ? '' : 's'} on ${name}.`,
    bylineTitle: 'Yuho gets stuck first, then writes it down', bylineLead: 'Someone who knew nothing about code, building a company with AI. The same stories go up as videos too.',
    search: 'Search', searchPlaceholder: 'Search by symptom or tool', noResults: 'No matching posts',
    copy: 'Copy', toc: 'On this page', mtoc: 'Contents', readTime: (n) => `${n} min read`,
    next: { start: (i, n) => `Start here · ${i} / ${n}`, topic: 'More on this topic', latest: 'Latest' },
    otherLang: 'KR', thisLang: 'EN', otherLangTitle: '한국어판', home: 'Home', feed: 'RSS',
    footerLine: 'Dev tips Yuho writes down at every spot where building SYNK got stuck. Each post is one Markdown file.',
    site: 'SYNK', edit: 'Suggest an edit', notFound: 'Nothing lives at that address', notFoundLead: 'The link may have changed, or the post is not written yet.',
    levelLegend: { beginner: 'Follow along on day one', intermediate: 'You have used the tool a bit', advanced: 'Digs into how it works' },
    menu: 'Menu', skip: 'Skip to content',
    head: { answer: 'Quick answer', why: 'Why it happens', prevent: 'Stop it next time', takeaway: 'Take this with you', for: 'For', read: 'Reading time', min: (n) => `${n} min`, level: 'Level' },
  },
};

const CHANNELS = [
  { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@yuhobuilds' },
  { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/yuhobuilds/' },
  { key: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@yuhobuilds' },
];

/* ---------- 작은 도우미 ---------- */
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } }
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;
const hash8 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
const dotDate = (iso) => iso.replace(/-/g, '.');
const pad2 = (n) => String(n).padStart(2, '0');
const fail = (msg) => { console.error('✗ ' + msg); process.exit(1); };

function slugify(text) {
  const s = String(text).trim().toLowerCase().replace(/[\s]+/g, '-').replace(/[^\p{L}\p{N}\-_]/gu, '');
  return s || 'section';
}

/* ---------- 앞머리(front matter) ---------- */
function parseFrontMatter(raw, file) {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) fail(`${file}: 앞머리(---)가 없다`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) fail(`${file}: 앞머리 줄을 못 읽는다 → ${line}`);
    let v = kv[2].trim();
    // 목록은 tools 만. 머리 상자 칸(answer_code 등)에는 [Environment]::… 처럼 대괄호로 시작하는 명령이 들어간다.
    if (kv[1] === 'tools' && /^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean);
    else v = v.replace(/^(["'])(.*)\1$/, '$2'); // 양 끝이 같은 따옴표로 감싸였을 때만 벗긴다
    meta[kv[1]] = v;
  }
  return { meta, body: m[2] };
}

/* ---------- 마크다운 → HTML ---------- */
function makeRenderer(rel, lang) {
  const used = new Set();
  const toc = [];
  const fixHref = (href) => (href && href.startsWith('/') && !href.startsWith('//')) ? rel + href.slice(1) : href;
  const renderer = {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = tokens.map((t) => t.text ?? t.raw ?? '').join('');
      let id = slugify(plain);
      let n = 2; while (used.has(id)) id = `${slugify(plain)}-${n++}`;
      used.add(id);
      const anchor = `<a class="anchor" href="#${attr(id)}" aria-hidden="true" tabindex="-1">#</a>`;
      if (depth !== 2) return `<h${depth} id="${attr(id)}">${text}${anchor}</h${depth}>\n`;
      // H2 = 글 틀의 절. 번호를 붙이고, 뒤에서 sectionize() 가 절마다 <section> 으로 묶는다.
      const num = pad2(toc.length + 1);
      toc.push({ id, text: plain, n: num });
      const kind = SEC_KIND[plain.trim().toLowerCase()] || '';
      return `\n<!--SEC ${kind}-->\n<div class="sec-h"><span class="n" aria-hidden="true">${num}</span><h2 id="${attr(id)}">${text}${anchor}</h2></div>\n`;
    },
    code({ text, lang: l }) {
      const language = (l || '').trim().split(/\s+/)[0];
      const cls = language ? ` class="language-${attr(language)}"` : '';
      return `<div class="code"><div class="code-bar"><span class="code-lang">${esc(language || 'text')}</span>`
        + `<button class="copy" type="button" data-copy aria-label="${attr(T[lang].copy)}">${esc(T[lang].copy)}</button></div>`
        + `<pre><code${cls}>${esc(text)}\n</code></pre></div>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const h = fixHref(href);
      const ext = /^https?:\/\//i.test(h) && !h.startsWith(SITE_URL);
      return `<a href="${attr(h)}"${title ? ` title="${attr(title)}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
    },
    image({ href, title, text }) {
      return `<img src="${attr(fixHref(href))}" alt="${attr(text)}"${title ? ` title="${attr(title)}"` : ''} loading="lazy" decoding="async">`;
    },
    table({ header, rows }) {
      const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</${tag}>`;
      const head = `<thead><tr>${header.map((c) => cell(c, 'th')).join('')}</tr></thead>`;
      const body = `<tbody>${rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody>`;
      return `<div class="table-wrap"><table>${head}${body}</table></div>\n`;
    },
  };
  return { renderer, toc };
}

/* H2 표식(<!--SEC kind-->) 사이를 <section class="sec sec-kind"> 로 묶는다 */
function sectionize(html) {
  const parts = html.split(/\n?<!--SEC (\w*)-->\n/);
  let outHtml = parts[0].trim() ? `<div class="sec sec-intro">\n${parts[0]}</div>\n` : '';
  for (let i = 1; i < parts.length; i += 2) outHtml += `<section class="sec${parts[i] ? ' sec-' + parts[i] : ''}">${parts[i + 1]}</section>\n`;
  return outHtml;
}

function renderMarkdown(md, rel, lang) {
  const { renderer, toc } = makeRenderer(rel, lang);
  const m = new Marked({ gfm: true, breaks: false, renderer });
  const html = sectionize(m.parse(md));
  return { html, toc };
}

const stripHtml = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/* 표지: ```lang cover 로 고른 블록 → 증상 절의 첫 코드 블록 → 글의 첫 코드 블록 */
function findCover(md) {
  const tokens = new Marked({ gfm: true }).lexer(md);
  let kind = '', first = null, inSymptom = null;
  for (const tk of tokens) {
    if (tk.type === 'heading' && tk.depth === 2) { kind = SEC_KIND[String(tk.text).trim().toLowerCase()] || ''; continue; }
    if (tk.type !== 'code') continue;
    const info = String(tk.lang || '').trim().split(/\s+/);
    const c = { lang: info[0] || 'text', text: tk.text, symptom: kind === 'symptom' };
    if (info.includes('cover')) return c;
    if (kind === 'symptom' && !inSymptom) inSymptom = c;
    if (!first) first = c;
  }
  return inSymptom || first;
}

/* ---------- 글 모으기 ---------- */
function loadPosts() {
  if (!fs.existsSync(POSTS)) fail('posts/ 폴더가 없다');
  const bySlug = new Map();
  for (const file of fs.readdirSync(POSTS).sort()) {
    const m = file.match(/^(.+)\.(ko|en)\.md$/);
    if (!m) continue;
    const [, slug, lang] = m;
    if (RESERVED_SLUGS.includes(slug)) fail(`${file}: slug "${slug}"는 사이트 경로로 쓴다 (${RESERVED_SLUGS.join(', ')} 말고)`);
    const raw = fs.readFileSync(path.join(POSTS, file), 'utf8');
    const { meta, body } = parseFrontMatter(raw, file);
    for (const k of ['title', 'date', 'level', 'topic', 'summary']) if (!meta[k]) fail(`${file}: 앞머리에 ${k}가 없다`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) fail(`${file}: date는 YYYY-MM-DD 로 쓴다 → ${meta.date}`);
    const level = LEVEL_ALIAS[String(meta.level).toLowerCase()] || LEVEL_ALIAS[meta.level];
    if (!level) fail(`${file}: level은 초급|중급|고급 (beginner|intermediate|advanced) 중 하나 → ${meta.level}`);
    if (!TOPICS[meta.topic]) fail(`${file}: topic "${meta.topic}"이 topics.json에 없다 (있는 것: ${Object.keys(TOPICS).join(', ')})`);
    const tools = Array.isArray(meta.tools) ? meta.tools : String(meta.tools || '').split(',').map((x) => x.trim()).filter(Boolean);
    const start = meta.start ? Number(meta.start) : 0;
    if (!bySlug.has(slug)) bySlug.set(slug, {});
    // 글 머리 틀(선택): hook · for · answer · answer_code · answer_lang · why · prevent · takeaway — 한 줄씩
    const head = {};
    for (const k of ['hook', 'for', 'answer', 'answer_code', 'answer_lang', 'why', 'prevent', 'takeaway']) if (meta[k]) head[k] = meta[k];
    if (head.answer && !(head.why && head.prevent && head.takeaway)) fail(`${file}: answer 를 쓰면 why · prevent · takeaway 도 같이 쓴다`);
    bySlug.get(slug)[lang] = {
      slug, lang, file, title: meta.title, date: meta.date, level, topic: meta.topic, tools, summary: meta.summary, start, body, head,
      short: meta.short || '', featured: meta.featured === 'true', draft: meta.draft === 'true',
    };
  }
  const posts = [];
  for (const [, langs] of bySlug) for (const lang of LANGS) if (langs[lang] && !langs[lang].draft) posts.push({ ...langs[lang], alt: LANGS.filter((l) => l !== lang && langs[l] && !langs[l].draft) });
  if (!posts.length) fail('글이 하나도 없다 (posts/<slug>.ko.md)');
  return posts;
}

/* 글마다 한 번: 본문 HTML · 차례 · 읽는 시간 · 표지 · 검색 글. 글 페이지는 늘 dist/<lang>/<slug>/ 라 rel 이 같다. */
function preparePost(p) {
  p.rendered = renderMarkdown(p.body, '../../', p.lang);
  p.minutes = readMinutes(p.rendered.html);
  p.cover = findCover(p.body);
  const headText = ['hook', 'answer', 'answer_code', 'why', 'prevent', 'takeaway'].map((k) => p.head[k] || '').join(' ');
  p.text = (headText + ' ' + stripHtml(p.rendered.html)).trim();
  // short(짧은 이름)는 「많이 찾는 증상」 칩의 검색어가 된다 — 그 말로 찾으면 이 글이 나와야 한다(app.js score 와 같은 규칙)
  if (p.short) {
    const hay = [p.title, p.summary, TOPICS[p.topic][p.lang], LEVELS[p.level][p.lang], p.tools.join(' '), p.text.slice(0, 2000)].join(' \n ').toLowerCase();
    const miss = p.short.toLowerCase().split(/\s+/).filter((x) => x && !hay.includes(x));
    if (miss.length) fail(`${p.file}: short 「${p.short}」로 찾으면 이 글이 안 나온다 (글에 없는 낱말: ${miss.join(', ')})`);
  }
}

/* 글 정렬은 로캘·OS 와 무관하게 같은 결과가 나와야 한다(localeCompare 금지) */
const bySlugBytes = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const startRank = (p) => (p.start > 0 ? p.start : 1e6);
// RSS: 날짜 내림차순, 같은 날짜는 slug 바이트 순
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : bySlugBytes(a, b));
// 화면: 날짜 내림차순, 같은 날짜는 「처음이면 여기부터」 순서 → slug
const byNewest = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (startRank(a) - startRank(b)) || bySlugBytes(a, b));
const startPathOf = (list) => list.filter((p) => p.start > 0).sort((a, b) => a.start - b.start || bySlugBytes(a, b));

/* ---------- 조각(HTML 부품) ---------- */
const levelBadge = (lang, level) => `<span class="lv lv-${level}" title="${attr(T[lang].levelLegend[level])}"><i aria-hidden="true"></i>${esc(LEVELS[level][lang])}</span>`;
const topicTag = (lang, topic) => `<span class="tag">${esc(TOPICS[topic][lang] || topic)}</span>`;
const timeTag = (date) => `<time class="d" datetime="${attr(date)}">${esc(dotDate(date))}</time>`;
const postHref = (p, rel) => `${rel}${p.lang}/${p.slug}/`;
const searchIco = (size) => `<svg class="search-ico" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const logo = (lang, rel) => `<a class="logo" href="${rel}${lang}/" aria-label="${attr(T[lang].name)}"><span class="mark" aria-hidden="true">tip</span><b>SYNK</b><span>tips</span></a>`;

/* 표지(증상 화면): 첫 줄 몇 개만, 프롬프트(PS>, $)는 흐리게 */
function coverHtml(p, { big = false } = {}) {
  const c = p.cover, t = T[p.lang];
  if (!c) return `<div class="cover-none" aria-hidden="true">${esc(TOPICS[p.topic][p.lang])}</div>`;
  const name = LANG_NAME[c.lang.toLowerCase()] || TOPICS[p.topic][p.lang];
  const label = c.symptom ? `${t.coverSymptom} · ${name}` : name;
  const max = big ? 5 : 4; // 「…」 줄까지 친 줄 수 — 카드 표지 높이를 같게 둔다
  const lines = c.text.replace(/\s+$/, '').split('\n');
  const more = lines.length > max;
  const shown = lines.slice(0, more ? max - 1 : max).map((l) => {
    const m = l.match(/^(PS[^>\n]*>|\$|>)(\s.*)?$/);
    return `<span class="ln">${m ? `<span class="p">${esc(m[1])}</span>${esc(m[2] || '')}` : (esc(l) || ' ')}</span>`;
  });
  if (more) shown.push('<span class="ln p">…</span>');
  return `<div class="term${big ? ' term-big' : ''}" aria-hidden="true"><div class="term-bar"><i></i><i></i><i></i><span>${esc(label)}</span></div><pre>${shown.join('')}</pre></div>`;
}

function card(p, rel, { h = 'h3' } = {}) {
  return `<a class="card" href="${attr(postHref(p, rel))}"><div class="cover">${coverHtml(p)}</div>`
    + `<div class="body"><span class="meta">${levelBadge(p.lang, p.level)}${topicTag(p.lang, p.topic)}${timeTag(p.date)}</span>`
    + `<${h} class="ttl">${esc(p.title)}</${h}><p>${esc(p.summary)}</p></div></a>`;
}

/* 주제 목록: 글이 있는 주제 먼저(topics.json 순서), 없는 주제는 「준비 중」으로 끝에 */
function topicList(lang, mine) {
  const t = T[lang];
  const rows = Object.keys(TOPICS).map((k) => ({ k, name: TOPICS[k][lang], n: mine.filter((p) => p.topic === k).length }));
  return [...rows.filter((r) => r.n), ...rows.filter((r) => !r.n)].map((r) => ({ ...r, soonLabel: t.soon }));
}

function layout({ lang, rel, title, description, pathFromRoot, alternates, body, assetVer, bodyClass = '', kind = 'page' }) {
  const t = T[lang];
  const canonical = `${SITE_URL}/${pathFromRoot}`;
  const alt = (alternates || {});
  const altLinks = LANGS.filter((l) => alt[l]).map((l) => `<link rel="alternate" hreflang="${l}" href="${attr(SITE_URL + '/' + alt[l])}">`).join('');
  const xDefault = alt[DEFAULT_LANG] ? `<link rel="alternate" hreflang="x-default" href="${attr(SITE_URL + '/' + alt[DEFAULT_LANG])}">` : '';
  const other = LANGS.find((l) => l !== lang);
  const otherHref = alt[other] ? rel + alt[other] : rel + other + '/';
  const fullTitle = kind === 'home' ? `${t.name} — ${t.tagline}` : `${title} — ${t.name}`;
  const home = kind === 'home' ? '' : `${rel}${lang}/`;
  return `<!DOCTYPE html>
<html lang="${lang}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#08090c" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${altLinks}${xDefault}
<meta property="og:type" content="${kind === 'post' ? 'article' : 'website'}"><meta property="og:url" content="${attr(canonical)}"><meta property="og:title" content="${attr(fullTitle)}"><meta property="og:description" content="${attr(description)}"><meta property="og:site_name" content="${attr(t.name)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${rel}assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${attr(t.name)} (${lang})" href="${rel}${lang}/feed.xml">
<link rel="preload" href="${rel}assets/fonts/SUIT-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/style.css?v=${assetVer.css}">
<script>document.documentElement.classList.replace('no-js','js')</script>
</head>
<body class="${attr(bodyClass)}" data-lang="${lang}" data-rel="${attr(rel)}">
<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="bar"><div class="bar-inner">
${logo(lang, rel)}
<nav class="nav" aria-label="${attr(t.menu)}"><a href="${home}#start">${esc(t.nav.start)}</a><a href="${home}#topics">${esc(t.nav.topics)}</a><a href="${home}#latest">${esc(t.nav.latest)}</a></nav>
<div class="search bar-search" data-search>
<label class="sr-only" for="q">${esc(t.search)}</label>
${searchIco(16)}<input id="q" type="search" autocomplete="off" placeholder="${attr(t.searchPlaceholder)}" data-index="${rel}${lang}/search.json" data-empty="${attr(t.noResults)}"><kbd aria-hidden="true">/</kbd>
<div class="search-panel" data-search-panel hidden></div>
</div>
<div class="lang"><a href="${rel}${lang}/" hreflang="${lang}" lang="${lang}" aria-current="true">${esc(t.thisLang)}</a><a href="${attr(otherHref)}" hreflang="${other}" lang="${other}" title="${attr(t.otherLangTitle)}">${esc(t.otherLang)}</a></div>
<button class="icon-btn" type="button" data-search-open aria-expanded="false" aria-label="${attr(t.search)}">${searchIco(18)}</button>
<a class="cta" href="${attr(CHANNELS[0].url)}" target="_blank" rel="noopener"><img src="${rel}${PHOTO}" alt="" width="28" height="28">${esc(t.by)}</a>
</div></header>
<main id="main" class="main">
${body}
</main>
<footer class="foot"><div class="wrap">
<div class="foot-grid">
<div class="foot-brand">${logo(lang, rel)}<p>${esc(t.footerLine)}</p></div>
<div class="foot-col"><h2>${esc(t.by)}</h2><ul>${CHANNELS.map((c) => `<li><a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a></li>`).join('')}</ul></div>
<div class="foot-col"><h2>${esc(t.site)}</h2><ul><li><a href="https://synk.im/" target="_blank" rel="noopener">synk.im</a></li><li><a href="${rel}${lang}/feed.xml">${esc(t.feed)}</a></li>${REPO_URL ? `<li><a href="${attr(REPO_URL)}" target="_blank" rel="noopener">GitHub</a></li>` : ''}<li><a href="${attr(otherHref)}" hreflang="${other}" lang="${other}">${esc(t.otherLangTitle)}</a></li></ul></div>
</div>
<div class="foot-bottom"><span>© 2026 SYNK · ${esc(t.by)}</span><span class="mono">tips.synk.im</span></div>
</div></footer>
<script src="${rel}assets/app.js?v=${assetVer.js}" defer></script>
${beaconTag()}</body>
</html>
`;
}

/* ---------- 페이지들 ---------- */
function homePage(lang, posts, rel, assetVer) {
  const t = T[lang];
  const mine = posts.filter((p) => p.lang === lang);
  const startPath = startPathOf(mine);
  const newest = [...mine].sort(byNewest);
  const featured = mine.find((p) => p.featured) || newest[0];
  const latest = newest.filter((p) => p !== featured).slice(0, 4);
  const chips = mine.filter((p) => p.short).sort((a, b) => ((a.start > 0) - (b.start > 0)) || (startRank(a) - startRank(b)) || byNewest(a, b)).slice(0, 3);
  const topics = topicList(lang, mine);
  const body = `<div class="wrap">
<section class="hero">
<div>
<p class="eyebrow"><span class="dot" aria-hidden="true"></span>${esc(t.heroEyebrow)}</p>
<h1><span>${esc(t.heroA)}</span><span class="tone">${esc(t.heroB)}</span></h1>
<p class="lead">${esc(t.heroLead)} <span class="m-hide">${esc(t.heroLead2)}</span></p>
<div class="find search" data-search data-search-main>
${searchIco(20)}<label class="sr-only" for="q-hero">${esc(t.search)}</label>
<input id="q-hero" type="search" autocomplete="off" placeholder="${attr(t.findPlaceholder)}" data-index="${rel}${lang}/search.json" data-empty="${attr(t.noResults)}">
<button class="btn btn-dark" type="button" data-search-go>${esc(t.findGo)}</button>
<div class="search-panel" data-search-panel hidden></div>
</div>
${chips.length ? `<p class="often"><span class="kicker">${esc(t.often)}</span>${chips.map((p) => `<a href="${attr(postHref(p, rel))}" data-q="${attr(p.short)}">${esc(p.short)}</a>`).join('')}</p>` : ''}
</div>
<div class="feature">
<p class="label"><span class="kicker">${esc(t.featured)}</span><span class="meta">${timeTag(featured.date)}</span></p>
${coverHtml(featured, { big: true })}
<a class="feature-card" href="${attr(postHref(featured, rel))}"><span class="meta">${levelBadge(lang, featured.level)}${topicTag(lang, featured.topic)}</span><h2>${esc(featured.title)}</h2><p>${esc(featured.summary)}</p><span class="go">${esc(t.readGo)} <span class="arr" aria-hidden="true">→</span></span></a>
</div>
</section>
${startPath.length ? `<section class="path" id="start" aria-labelledby="start-title">
<div><p class="eyebrow"><span class="dot" aria-hidden="true"></span>Start here</p><h2 class="sec-title" id="start-title">${esc(t.nav.start)}</h2><p class="sec-lead">${esc(t.startLead)}</p><p class="meta">${esc(t.startTotal(startPath.reduce((s, p) => s + p.minutes, 0)))}</p></div>
<ol class="steps">${startPath.map((p, i) => `<li><a class="step" href="${attr(postHref(p, rel))}"><span class="n" aria-hidden="true">${pad2(i + 1)}</span><span class="meta">${levelBadge(lang, p.level)}${topicTag(lang, p.topic)}</span><h3>${esc(p.title)}</h3><span class="time">${esc(t.readTime(p.minutes))}<span class="arr" aria-hidden="true">→</span></span></a></li>`).join('')}</ol>
</section>` : ''}
<section class="browse">
<div id="topics">
<p class="eyebrow"><span class="dot" aria-hidden="true"></span>Topics</p>
<h2 class="sec-title">${esc(t.topicsTitle)}</h2>
<ul class="topics">${topics.map((r) => (r.n ? `<li><a href="${attr(rel + lang + '/topic/' + r.k + '/')}">${esc(r.name)}<span class="c">${r.n}</span></a></li>` : `<li><span class="soon">${esc(r.name)}<span class="c">${esc(r.soonLabel)}</span></span></li>`)).join('')}</ul>
<ul class="legend">${Object.keys(LEVELS).map((l) => `<li>${levelBadge(lang, l)}<span>${esc(t.levelLegend[l])}</span></li>`).join('')}</ul>
</div>
<div id="latest">
<div class="latest-head"><div><p class="eyebrow"><span class="dot" aria-hidden="true"></span>Latest</p><h2 class="sec-title">${esc(t.latestTitle)}</h2></div><a href="${rel}${lang}/posts/">${esc(t.seeAll)} <span class="arr" aria-hidden="true">→</span></a></div>
<div class="cards">${latest.map((p) => card(p, rel)).join('')}</div>
</div>
</section>
<section class="byline" aria-labelledby="by-title">
<img src="${rel}${PHOTO}" alt="${attr(t.author)}" width="72" height="72" loading="lazy">
<div><h2 id="by-title">${esc(t.bylineTitle)}</h2><p>${esc(t.bylineLead)}</p></div>
<div class="ch">${CHANNELS.map((c) => `<a class="btn btn-line" href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.label)} <span class="arr" aria-hidden="true">↗</span></a>`).join('')}</div>
</section>
</div>`;
  return layout({ lang, rel, title: t.name, description: t.tagline, pathFromRoot: `${lang}/`, alternates: Object.fromEntries(LANGS.map((l) => [l, `${l}/`])), body, assetVer, bodyClass: 'home', kind: 'home' });
}

/* 목록 화면: 주제 하나 · 전체 글 */
function listPage(lang, posts, rel, assetVer, { list, eyebrow, title, lead, pathFromRoot, current, description }) {
  const t = T[lang];
  const mine = posts.filter((p) => p.lang === lang);
  const topics = topicList(lang, mine);
  const body = `<div class="wrap">
<section class="list-head"><p class="eyebrow"><span class="dot" aria-hidden="true"></span>${esc(eyebrow)}</p><h1>${esc(title)}</h1><p class="sec-lead">${esc(lead)}</p></section>
<section class="list-body">
<div class="cards cards-3">${list.map((p) => card(p, rel, { h: 'h2' })).join('')}</div>
<nav class="more-topics" aria-label="${attr(t.topicsTitle)}"><p class="kicker">${esc(t.topicsTitle)}</p><ul>
<li><a href="${rel}${lang}/posts/"${current === '*' ? ' aria-current="page"' : ''}>${esc(t.allTitle)}<span class="c">${mine.length}</span></a></li>
${topics.map((r) => (r.n ? `<li><a href="${attr(rel + lang + '/topic/' + r.k + '/')}"${current === r.k ? ' aria-current="page"' : ''}>${esc(r.name)}<span class="c">${r.n}</span></a></li>` : `<li><span class="soon">${esc(r.name)}<span class="c">${esc(r.soonLabel)}</span></span></li>`)).join('\n')}
</ul></nav>
</section>
</div>`;
  return layout({ lang, rel, title, description, pathFromRoot: pathFromRoot(lang), alternates: Object.fromEntries(LANGS.map((l) => [l, pathFromRoot(l)])), body, assetVer, bodyClass: 'list' });
}

function topicPage(lang, topic, posts, rel, assetVer) {
  const t = T[lang];
  const list = posts.filter((p) => p.lang === lang && p.topic === topic).sort(byNewest);
  const name = TOPICS[topic][lang];
  return listPage(lang, posts, rel, assetVer, { list, eyebrow: 'Topics', title: name, lead: t.topicLead(name, list.length), pathFromRoot: (l) => `${l}/topic/${topic}/`, current: topic, description: `${t.topicLead(name, list.length)} — ${t.tagline}` });
}

function allPage(lang, posts, rel, assetVer) {
  const t = T[lang];
  const list = posts.filter((p) => p.lang === lang).sort(byNewest);
  return listPage(lang, posts, rel, assetVer, { list, eyebrow: 'Posts', title: t.allTitle, lead: t.allLead(list.length), pathFromRoot: (l) => `${l}/posts/`, current: '*', description: `${t.allTitle} — ${t.tagline}` });
}

/* 다음 글: 「처음이면 여기부터」 다음 편 → 같은 주제(길잡이 밖의 글 먼저) → 최근 글 */
function nextPost(p, mine) {
  const t = T[p.lang];
  const startPath = startPathOf(mine);
  const si = startPath.findIndex((x) => x.slug === p.slug);
  if (si >= 0 && si < startPath.length - 1) return { post: startPath[si + 1], label: t.next.start(pad2(si + 2), pad2(startPath.length)) };
  const others = mine.filter((x) => x.slug !== p.slug).sort(byNewest);
  const same = others.filter((x) => x.topic === p.topic);
  const pick = same.find((x) => !x.start) || same[0];
  if (pick) return { post: pick, label: t.next.topic };
  return others[0] ? { post: others[0], label: t.next.latest } : null;
}

function postPage(p, posts, rel, assetVer) {
  const lang = p.lang, t = T[lang];
  const { html, toc } = p.rendered;
  const mine = posts.filter((x) => x.lang === lang);
  const startPath = startPathOf(mine);
  const topics = topicList(lang, mine);
  const next = nextPost(p, mine);
  const alternates = { [lang]: `${lang}/${p.slug}/` };
  for (const l of p.alt) alternates[l] = `${l}/${p.slug}/`;
  const altLinks = p.alt.map((l) => `<a href="${attr(rel + l + '/' + p.slug + '/')}" hreflang="${l}" lang="${l}">${esc(t.otherLangTitle)} <span class="arr" aria-hidden="true">→</span></a>`).join('');
  const editLink = REPO_URL ? `<a href="${attr(REPO_URL + '/edit/main/posts/' + p.file)}" target="_blank" rel="noopener">${esc(t.edit)} <span class="arr" aria-hidden="true">↗</span></a>` : '';
  const tocItems = toc.map((h) => `<li><a href="#${attr(h.id)}"><span class="n">${h.n}</span><span>${esc(h.text)}</span></a></li>`).join('');
  const mtoc = toc.length ? `<div class="mtoc" data-mtoc>
<button class="mtoc-btn" type="button" aria-expanded="false" aria-controls="mtoc-list"><span class="mtoc-cur"><span class="n" data-mtoc-n>${toc[0].n}</span><span data-mtoc-label>${esc(toc[0].text)}</span></span><span class="mtoc-prog" aria-hidden="true"><i data-mtoc-prog></i></span><span class="mtoc-more">${esc(t.mtoc)} <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
<ol class="mtoc-list" id="mtoc-list" hidden>${tocItems}</ol>
</div>` : '';
  const body = `<div class="wrap">
${mtoc}
<div class="doc">
<aside class="side" aria-label="${attr(t.nav.start + ' · ' + t.nav.topics)}">
${startPath.length ? `<p class="kicker">${esc(t.nav.start)}</p><ol>${startPath.map((x, i) => `<li><a href="${attr(postHref(x, rel))}"${x.slug === p.slug ? ' class="on" aria-current="page"' : ''}><span class="n">${pad2(i + 1)}</span><span>${esc(x.short || x.title)}</span></a></li>`).join('')}</ol>` : ''}
<p class="kicker">${esc(t.nav.topics)}</p><ul>${topics.map((r) => (r.n ? `<li><a href="${attr(rel + lang + '/topic/' + r.k + '/')}"${r.k === p.topic ? ' class="on"' : ''}><span>${esc(r.name)}</span><span class="c">${r.n}</span></a></li>` : `<li><span class="soon"><span>${esc(r.name)}</span><span class="c">${esc(r.soonLabel)}</span></span></li>`)).join('')}</ul>
</aside>
<article class="post">
<p class="crumb"><a href="${rel}${lang}/">${esc(t.home)}</a><span aria-hidden="true">›</span><a href="${attr(rel + lang + '/topic/' + p.topic + '/')}"><b>${esc(TOPICS[p.topic][lang])}</b></a></p>
<h1>${esc(p.title)}</h1>
<p class="sum">${p.head.hook ? inlineMd(p.head.hook) : esc(p.summary)}</p>
${headBox(p)}
<p class="author"><img src="${rel}${PHOTO}" alt="" width="32" height="32"><b>${esc(t.author)}</b><a class="by" href="${attr(CHANNELS[0].url)}" target="_blank" rel="noopener">${esc(t.by)}</a><span class="sep" aria-hidden="true">·</span>${timeTag(p.date)}${p.head.answer ? '' : `<span class="sep" aria-hidden="true">·</span><span>${esc(t.readTime(p.minutes))}</span>${levelBadge(lang, p.level)}`}</p>
<div class="prose">
${html}</div>
${next ? `<a class="next" href="${attr(postHref(next.post, rel))}"><div><p class="k">${esc(next.label)}</p><p class="t">${esc(next.post.title)}</p></div><span class="go" aria-hidden="true">→</span></a>` : ''}
<p class="post-links">${p.tools.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}${altLinks}${editLink}</p>
</article>
<aside class="toc" data-toc aria-label="${attr(t.toc)}">
${toc.length ? `<p class="kicker">${esc(t.toc)}</p><ol>${tocItems}</ol>` : ''}
${p.tools.length ? `<div class="tools">${p.tools.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
<div class="links">${altLinks}${editLink}</div>
</aside>
</div>
</div>`;
  return layout({ lang, rel, title: p.title, description: p.summary, pathFromRoot: `${lang}/${p.slug}/`, alternates, body, assetVer, bodyClass: 'post-page', kind: 'post' });
}

/* 글 머리 상자: 바로 답 · 왜 · 다음부터 막기 · 가져갈 것 + 이런 분께 · 읽는 시간 · 난이도 */
const inlineMd = (s) => new Marked({ gfm: true }).parseInline(String(s));
function readMinutes(html) {
  const text = stripHtml(html);
  const hangul = (text.match(/[가-힣]/g) || []).length;
  const words = text.replace(/[가-힣]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(hangul / 500 + words / 220)); // 한글 분당 500자, 영어 분당 220낱말 남짓
}
function headBox(p) {
  const h = p.head;
  if (!h.answer) return '';
  const t = T[p.lang].head;
  const code = h.answer_code
    ? `<div class="code head-code"><div class="code-bar"><span class="code-lang">${esc(h.answer_lang || 'powershell')}</span><button class="copy" type="button" data-copy aria-label="${attr(T[p.lang].copy)}">${esc(T[p.lang].copy)}</button></div><pre><code>${esc(h.answer_code)}\n</code></pre></div>`
    : '';
  const row = (k, label) => `<div class="head-row head-${k}"><p class="head-k">${esc(label)}</p><p class="head-v">${inlineMd(h[k])}</p></div>`;
  return `<section class="head-box" aria-label="${attr(t.answer)}">
<div class="head-main">
<div class="head-row head-answer"><p class="head-k">${esc(t.answer)}</p><p class="head-v">${inlineMd(h.answer)}</p>${code}</div>
${row('why', t.why)}
${row('prevent', t.prevent)}
${row('takeaway', t.takeaway)}
</div>
<dl class="head-side">
${h.for ? `<div><dt>${esc(t.for)}</dt><dd>${inlineMd(h.for)}</dd></div>` : ''}
<div><dt>${esc(t.read)}</dt><dd>${esc(t.min(p.minutes))}</dd></div>
<div><dt>${esc(t.level)}</dt><dd>${levelBadge(p.lang, p.level)}</dd></div>
</dl>
</section>`;
}

function rootRedirect() {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SYNK Tips</title>
<link rel="canonical" href="${SITE_URL}/ko/"><link rel="alternate" hreflang="ko" href="${SITE_URL}/ko/"><link rel="alternate" hreflang="en" href="${SITE_URL}/en/"><link rel="alternate" hreflang="x-default" href="${SITE_URL}/ko/">
<meta http-equiv="refresh" content="0; url=ko/"><link rel="stylesheet" href="assets/style.css">
</head><body class="redirect"><main class="wrap main"><p class="lead">SYNK Tips — <a href="ko/">한국어</a> · <a href="en/">English</a></p></main></body></html>
`;
}

function notFoundPage() {
  const t = T.ko, e = T.en;
  // GitHub Pages 는 뿌리의 404.html 을 어느 깊이의 없는 주소에나 돌려주므로 상대 경로를 못 쓴다.
  // 그래서 이 페이지만 절대 경로를 쓰고, *.github.io/<저장소>/ 기본 주소에서는 첫 칸을 앞에 붙인다(스타일은 인라인).
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>404 — SYNK Tips</title>
<style>body{margin:0;font-family:'SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#fff;color:#0b0b0d;padding:clamp(48px,12vh,120px) 20px}main{max-width:40rem;margin:0 auto}h1{font-size:clamp(28px,6vw,40px);font-weight:680;letter-spacing:-.035em;margin:0 0 12px}p{font-size:16px;line-height:1.7;color:#3f3f46;margin:0 0 8px}a{color:inherit}.mono{font-family:'DM Mono',ui-monospace,monospace;font-size:12.5px;letter-spacing:.06em;color:#6b6b74}@media(prefers-color-scheme:dark){body{background:#08090c;color:#fafaf9}p{color:rgba(250,250,249,.76)}}</style>
</head><body><main><p class="mono">404</p><h1>${esc(t.notFound)}</h1><p>${esc(t.notFoundLead)} <a data-root href="/ko/">${esc(t.home)} →</a></p><p lang="en">${esc(e.notFoundLead)} <a data-root href="/en/">${esc(e.home)} →</a></p></main>
<script>(function(){if(!/\\.github\\.io$/.test(location.hostname))return;var seg=location.pathname.split('/')[1];if(!seg)return;document.querySelectorAll('a[data-root]').forEach(function(a){a.setAttribute('href','/'+seg+a.getAttribute('href'));});})();</script>
</body></html>
`;
}

function rss(lang, posts) {
  const t = T[lang];
  const items = posts.filter((p) => p.lang === lang).sort(byDateDesc).map((p) => {
    const url = `${SITE_URL}/${lang}/${p.slug}/`;
    const pub = new Date(`${p.date}T09:00:00+09:00`).toUTCString();
    return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${pub}</pubDate><description>${esc(p.summary)}</description><category>${esc(TOPICS[p.topic][lang])}</category><category>${esc(LEVELS[p.level][lang])}</category></item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(t.name)} (${lang})</title><link>${SITE_URL}/${lang}/</link><description>${esc(t.tagline)}</description><language>${lang}</language><atom:link href="${SITE_URL}/${lang}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>
`;
}

/* ---------- 파일 쓰기 ---------- */
function out(p, content) {
  const full = path.join(DIST, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function build() {
  const posts = loadPosts();
  for (const p of posts) preparePost(p);
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 자산
  copyDir(path.join(SITE, 'assets'), path.join(DIST, 'assets'));
  copyDir(path.join(POSTS, 'img'), path.join(DIST, 'img'));
  const css = fs.readFileSync(path.join(SITE, 'assets', 'style.css'));
  const js = fs.readFileSync(path.join(SITE, 'assets', 'app.js'));
  const assetVer = { css: hash8(css), js: hash8(js) };
  for (const extra of ['CNAME', '.nojekyll']) {
    const src = path.join(ROOT, extra);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, extra));
  }
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  const urls = [];
  out('index.html', rootRedirect());
  out('404.html', notFoundPage());
  for (const lang of LANGS) {
    out(`${lang}/index.html`, homePage(lang, posts, '../', assetVer));
    urls.push(`${lang}/`);
    out(`${lang}/posts/index.html`, allPage(lang, posts, '../../', assetVer));
    urls.push(`${lang}/posts/`);
    const index = [];
    for (const p of posts.filter((x) => x.lang === lang)) {
      out(`${lang}/${p.slug}/index.html`, postPage(p, posts, '../../', assetVer));
      urls.push(`${lang}/${p.slug}/`);
      index.push({ u: `${p.slug}/`, t: p.title, s: p.summary, l: LEVELS[p.level][lang], lv: p.level, p: TOPICS[p.topic][lang], k: p.tools, d: p.date, b: p.text.slice(0, 2000) });
    }
    for (const topic of Object.keys(TOPICS)) {
      if (!posts.some((x) => x.lang === lang && x.topic === topic)) continue;
      out(`${lang}/topic/${topic}/index.html`, topicPage(lang, topic, posts, '../../../', assetVer));
      urls.push(`${lang}/topic/${topic}/`);
    }
    out(`${lang}/search.json`, JSON.stringify(index));
    out(`${lang}/feed.xml`, rss(lang, posts));
  }
  out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  out('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  const n = posts.length;
  console.log(`✓ dist/ — 글 ${n}개(${LANGS.map((l) => `${l} ${posts.filter((p) => p.lang === l).length}`).join(', ')}), 페이지 ${urls.length}개, 자산 css ${assetVer.css} js ${assetVer.js}`);
}

build();
