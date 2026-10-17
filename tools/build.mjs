#!/usr/bin/env node
// tools/build.mjs — posts/*.md → dist/  (의존: marked 하나)
//
//   posts/<slug>.ko.md + posts/<slug>.en.md  →  dist/ko/<slug>/  dist/en/<slug>/
//   첫 화면·주제 페이지·검색 색인(search.json)·RSS(feed.xml)·sitemap 을 같이 만든다.
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
const LANGS = ['ko', 'en'];
const DEFAULT_LANG = 'ko';
const TOPICS = readJson(path.join(ROOT, 'topics.json'));

const LEVELS = {
  beginner: { ko: '초급', en: 'Beginner', order: 1 },
  intermediate: { ko: '중급', en: 'Intermediate', order: 2 },
  advanced: { ko: '고급', en: 'Advanced', order: 3 },
};
const LEVEL_ALIAS = { '초급': 'beginner', '중급': 'intermediate', '고급': 'advanced', beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' };

const T = {
  ko: {
    name: 'SYNK Tips', tagline: '유호가 SYNK를 만들며 모은 개발 꿀팁', by: 'by yuhobuilds',
    heroA: '유호가 SYNK를 만들며', heroB: '모은 개발 꿀팁',
    heroLead: '막혔던 자리에서 바로 적습니다. 글마다 같은 틀입니다 — 증상 → 원인·원리 → 고침 → 다시 확인 → 함정. 초보도 따라 할 수 있게 복붙 명령과 원리를 같이 둡니다.',
    start: '처음이면 여기부터', startLead: '순서대로 읽으면 됩니다. 하나 끝날 때마다 다음으로.',
    recent: '최근 글', topics: '주제', topicLead: '도구별로 모았습니다. 난이도는 글마다 배지로 붙습니다.',
    search: '검색', searchPlaceholder: '증상이나 도구 이름으로 찾기', searchHint: '예: 세션, PowerShell, 한글', noResults: '맞는 글이 없어요',
    copy: '복사', copied: '복사됨', toc: '이 글의 차례', tools: '도구', level: '난이도', date: '쓴 날',
    posts: (n) => `글 ${n}개`, otherLang: 'EN', thisLang: 'KR', otherLangTitle: 'English version',
    sameTopic: '같은 주제의 다른 글', home: '첫 화면', feed: 'RSS', footerLine: '유호가 SYNK를 만들며 막힌 자리마다 적어 두는 개발 꿀팁입니다. 글은 마크다운 파일 하나로 올라갑니다.',
    channels: '채널', site: 'SYNK', edit: '이 글 고치기 제안', notFound: '그 주소에는 글이 없어요', notFoundLead: '주소가 바뀌었거나 아직 안 쓴 글입니다.',
    levelLegend: { beginner: '처음이어도 따라 할 수 있는 글', intermediate: '도구를 조금 써 본 사람', advanced: '원리까지 파는 글' },
    menu: '메뉴', skip: '본문으로 바로 가기', postsIn: (t) => `${t} 글`,
  },
  en: {
    name: 'SYNK Tips', tagline: 'Dev tips Yuho collected while building SYNK', by: 'by yuhobuilds',
    heroA: 'Dev tips Yuho collected', heroB: 'while building SYNK',
    heroLead: 'Written right where I got stuck. Every post follows the same shape — symptom → cause → fix → check again → pitfalls — with copy-paste commands and the reasoning behind them, so you can follow along even on day one.',
    start: 'Start here', startLead: 'Read in order. Finish one, move to the next.',
    recent: 'Latest', topics: 'Topics', topicLead: 'Grouped by tool. The difficulty is a badge on each post, not a menu.',
    search: 'Search', searchPlaceholder: 'Search by symptom or tool', searchHint: 'e.g. session, PowerShell, Korean', noResults: 'No matching posts',
    copy: 'Copy', copied: 'Copied', toc: 'On this page', tools: 'Tools', level: 'Level', date: 'Written',
    posts: (n) => `${n} post${n === 1 ? '' : 's'}`, otherLang: 'KR', thisLang: 'EN', otherLangTitle: '한국어판',
    sameTopic: 'More on this topic', home: 'Home', feed: 'RSS', footerLine: 'Dev tips Yuho writes down wherever he gets stuck while building SYNK. Each post is one Markdown file.',
    channels: 'Channels', site: 'SYNK', edit: 'Suggest an edit', notFound: 'Nothing lives at that address', notFoundLead: 'The link may have changed, or the post is not written yet.',
    levelLegend: { beginner: 'Follow along on day one', intermediate: 'You have used the tool a bit', advanced: 'Digs into how it works' },
    menu: 'Menu', skip: 'Skip to content', postsIn: (t) => `Posts on ${t}`,
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
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, '');
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
      if (depth === 2) toc.push({ id, text: plain });
      return `<h${depth} id="${attr(id)}">${text}<a class="anchor" href="#${attr(id)}" aria-hidden="true" tabindex="-1">#</a></h${depth}>\n`;
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

function renderMarkdown(md, rel, lang) {
  const { renderer, toc } = makeRenderer(rel, lang);
  const m = new Marked({ gfm: true, breaks: false, renderer });
  const html = m.parse(md);
  return { html, toc };
}

const stripHtml = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/* ---------- 글 모으기 ---------- */
function loadPosts() {
  if (!fs.existsSync(POSTS)) fail('posts/ 폴더가 없다');
  const bySlug = new Map();
  for (const file of fs.readdirSync(POSTS).sort()) {
    const m = file.match(/^(.+)\.(ko|en)\.md$/);
    if (!m) continue;
    const [, slug, lang] = m;
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
    bySlug.get(slug)[lang] = { slug, lang, file, title: meta.title, date: meta.date, level, topic: meta.topic, tools, summary: meta.summary, start, body, draft: meta.draft === 'true' };
  }
  const posts = [];
  for (const [slug, langs] of bySlug) for (const lang of LANGS) if (langs[lang] && !langs[lang].draft) posts.push({ ...langs[lang], alt: LANGS.filter((l) => l !== lang && langs[l] && !langs[l].draft) });
  if (!posts.length) fail('글이 하나도 없다 (posts/<slug>.ko.md)');
  return posts;
}

/* ---------- 조각(HTML 부품) ---------- */
const levelBadge = (lang, level) => `<span class="lv lv-${level}" title="${attr(T[lang].levelLegend[level])}"><i aria-hidden="true"></i>${esc(LEVELS[level][lang])}</span>`;
const topicChip = (lang, topic, rel) => `<a class="chip" href="${attr(rel + lang + '/topic/' + topic + '/')}">${esc(TOPICS[topic][lang] || topic)}</a>`;
const timeTag = (date) => `<time class="mono" datetime="${attr(date)}">${esc(dotDate(date))}</time>`;

function postRow(p, rel, { number } = {}) {
  const lang = p.lang;
  return `<li class="row"><a class="row-link" href="${attr(rel + lang + '/' + p.slug + '/')}">`
    + (number ? `<span class="row-num mono">${String(number).padStart(2, '0')}</span>` : '')
    + `<span class="row-body"><span class="row-meta">${levelBadge(lang, p.level)}<span class="chip chip-flat">${esc(TOPICS[p.topic][lang])}</span>${timeTag(p.date)}</span>`
    + `<span class="row-title">${esc(p.title)}</span><span class="row-sum">${esc(p.summary)}</span></span>`
    + `<span class="row-arr mono" aria-hidden="true">→</span></a></li>`;
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
<header class="bar" data-bar>
<div class="bar-inner">
<a class="bar-logo" href="${rel}${lang}/" aria-label="${attr(t.name)}"><b>SYNK</b><span>tips</span></a>
<nav class="bar-nav" aria-label="${attr(t.menu)}"><a href="${rel}${lang}/#start">${esc(t.start)}</a><a href="${rel}${lang}/#topics">${esc(t.topics)}</a></nav>
<div class="search" data-search>
<label class="sr-only" for="q">${esc(t.search)}</label>
<input id="q" type="search" autocomplete="off" placeholder="${attr(t.searchPlaceholder)}" data-index="${rel}${lang}/search.json" data-empty="${attr(t.noResults)}">
<svg class="search-ico" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
<div class="search-panel" data-search-panel hidden></div>
</div>
<button class="bar-search" type="button" data-search-open aria-label="${attr(t.search)}"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
<div class="bar-lang"><a href="${rel}${lang}/" hreflang="${lang}" lang="${lang}" aria-current="true">${esc(t.thisLang)}</a><a href="${attr(otherHref)}" hreflang="${other}" lang="${other}" title="${attr(t.otherLangTitle)}">${esc(t.otherLang)}</a></div>
</div>
</header>
<main id="main" class="main">
${body}
</main>
<footer class="foot">
<div class="wrap foot-grid">
<div class="foot-brand"><a class="bar-logo foot-logo" href="${rel}${lang}/"><b>SYNK</b><span>tips</span></a><p>${esc(t.footerLine)}</p></div>
<div class="foot-col"><h2>${esc(t.by)}</h2><ul>${CHANNELS.map((c) => `<li><a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a></li>`).join('')}</ul></div>
<div class="foot-col"><h2>${esc(t.site)}</h2><ul><li><a href="https://synk.im/" target="_blank" rel="noopener">synk.im</a></li><li><a href="${rel}${lang}/feed.xml">${esc(t.feed)}</a></li>${REPO_URL ? `<li><a href="${attr(REPO_URL)}" target="_blank" rel="noopener">GitHub</a></li>` : ''}<li><a href="${attr(otherHref)}" hreflang="${other}" lang="${other}">${esc(t.otherLangTitle)}</a></li></ul></div>
</div>
<div class="wrap foot-bottom"><span>© 2026 SYNK · ${esc(t.by)}</span><span class="mono">tips.synk.im</span></div>
</footer>
<script src="${rel}assets/app.js?v=${assetVer.js}" defer></script>
</body>
</html>
`;
}

/* ---------- 페이지들 ---------- */
function homePage(lang, posts, rel, assetVer) {
  const t = T[lang];
  const mine = posts.filter((p) => p.lang === lang);
  const startPath = mine.filter((p) => p.start > 0).sort((a, b) => a.start - b.start);
  const recent = [...mine].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
  const topicCounts = Object.keys(TOPICS).map((k) => ({ k, n: mine.filter((p) => p.topic === k).length })).filter((x) => x.n > 0);
  const body = `
<section class="hero wrap">
<p class="eyebrow"><span class="dot" aria-hidden="true"></span>TIPS · ${esc(t.by).toUpperCase()}</p>
<h1 class="display"><span>${esc(t.heroA)}</span><span class="tone">${esc(t.heroB)}</span></h1>
<p class="lead">${esc(t.heroLead)}</p>
<p class="hero-channels">${CHANNELS.map((c) => `<a class="chip" href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.label)} ↗</a>`).join('')}</p>
</section>
${startPath.length ? `<section class="section wrap" id="start" aria-labelledby="start-title">
<div class="sec-head"><p class="eyebrow"><span class="dot" aria-hidden="true"></span>01 / START</p><h2 class="h2" id="start-title">${esc(t.start)}</h2><p class="sec-lead">${esc(t.startLead)}</p></div>
<ol class="rows rows-start">${startPath.map((p, i) => postRow(p, rel, { number: i + 1 })).join('')}</ol>
</section>` : ''}
<section class="section wrap" id="recent" aria-labelledby="recent-title">
<div class="sec-head"><p class="eyebrow"><span class="dot" aria-hidden="true"></span>02 / LATEST</p><h2 class="h2" id="recent-title">${esc(t.recent)}</h2></div>
<ul class="rows">${recent.map((p) => postRow(p, rel)).join('')}</ul>
</section>
<section class="section wrap" id="topics" aria-labelledby="topics-title">
<div class="sec-head"><p class="eyebrow"><span class="dot" aria-hidden="true"></span>03 / TOPICS</p><h2 class="h2" id="topics-title">${esc(t.topics)}</h2><p class="sec-lead">${esc(t.topicLead)}</p></div>
<ul class="topic-grid">${topicCounts.map(({ k, n }) => `<li><a class="topic-card" href="${attr(rel + lang + '/topic/' + k + '/')}"><span class="topic-name">${esc(TOPICS[k][lang])}</span><span class="topic-count mono">${esc(t.posts(n))}</span><span class="row-arr mono" aria-hidden="true">→</span></a></li>`).join('')}</ul>
<ul class="legend">${Object.keys(LEVELS).map((l) => `<li>${levelBadge(lang, l)}<span>${esc(t.levelLegend[l])}</span></li>`).join('')}</ul>
</section>`;
  return layout({ lang, rel, title: t.name, description: t.tagline, pathFromRoot: `${lang}/`, alternates: Object.fromEntries(LANGS.map((l) => [l, `${l}/`])), body, assetVer, bodyClass: 'home', kind: 'home' });
}

function topicPage(lang, topic, posts, rel, assetVer) {
  const t = T[lang];
  const mine = posts.filter((p) => p.lang === lang && p.topic === topic).sort((a, b) => (a.date < b.date ? 1 : -1));
  const name = TOPICS[topic][lang];
  const body = `
<section class="hero hero-small wrap">
<p class="eyebrow"><span class="dot" aria-hidden="true"></span>${esc(t.topics).toUpperCase()} / ${esc(topic).toUpperCase()}</p>
<h1 class="display">${esc(name)}</h1>
<p class="lead">${esc(t.postsIn(name))} · ${esc(t.posts(mine.length))}</p>
</section>
<section class="section wrap"><ul class="rows">${mine.map((p) => postRow(p, rel)).join('')}</ul></section>`;
  return layout({ lang, rel, title: name, description: `${t.postsIn(name)} — ${t.tagline}`, pathFromRoot: `${lang}/topic/${topic}/`, alternates: Object.fromEntries(LANGS.map((l) => [l, `${l}/topic/${topic}/`])), body, assetVer, bodyClass: 'topic' });
}

function postPage(p, posts, rel, assetVer) {
  const lang = p.lang, t = T[lang];
  const { html, toc } = renderMarkdown(p.body, rel, lang);
  const same = posts.filter((x) => x.lang === lang && x.topic === p.topic && x.slug !== p.slug).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  const alternates = { [lang]: `${lang}/${p.slug}/` };
  for (const l of p.alt) alternates[l] = `${l}/${p.slug}/`;
  const body = `
<article class="post wrap">
<header class="post-head">
<p class="post-meta">${levelBadge(lang, p.level)}${topicChip(lang, p.topic, rel)}${timeTag(p.date)}</p>
<h1 class="post-title">${esc(p.title)}</h1>
<p class="lead post-sum">${esc(p.summary)}</p>
<p class="byline"><span class="mono">${esc(t.by).toUpperCase()}</span>${CHANNELS.map((c) => `<a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join('<span class="sep" aria-hidden="true">·</span>')}</p>
${p.tools.length ? `<p class="tools"><span class="tools-label mono">${esc(t.tools).toUpperCase()}</span>${p.tools.map((x) => `<span class="chip chip-flat">${esc(x)}</span>`).join('')}</p>` : ''}
${toc.length ? `<nav class="toc" aria-label="${attr(t.toc)}"><span class="toc-label mono">${esc(t.toc).toUpperCase()}</span><ol>${toc.map((h) => `<li><a href="#${attr(h.id)}">${esc(h.text)}</a></li>`).join('')}</ol></nav>` : ''}
</header>
<div class="prose">
${html}
</div>
<footer class="post-foot">
<p class="byline"><span class="mono">${esc(t.by).toUpperCase()}</span>${CHANNELS.map((c) => `<a href="${attr(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join('<span class="sep" aria-hidden="true">·</span>')}${REPO_URL ? `<span class="sep" aria-hidden="true">·</span><a href="${attr(REPO_URL + '/edit/main/posts/' + p.file)}" target="_blank" rel="noopener">${esc(t.edit)}</a>` : ''}</p>
${p.alt.length ? `<p class="alt-lang">${p.alt.map((l) => `<a class="btn btn-line" href="${attr(rel + l + '/' + p.slug + '/')}" hreflang="${l}" lang="${l}">${esc(T[lang].otherLangTitle)} <span class="arr" aria-hidden="true">→</span></a>`).join('')}</p>` : ''}
${same.length ? `<section class="same" aria-labelledby="same-title"><h2 class="h3" id="same-title">${esc(t.sameTopic)}</h2><ul class="rows">${same.map((x) => postRow(x, rel)).join('')}</ul></section>` : ''}
</footer>
</article>`;
  const page = layout({ lang, rel, title: p.title, description: p.summary, pathFromRoot: `${lang}/${p.slug}/`, alternates, body, assetVer, bodyClass: 'post-page', kind: 'post' });
  return { page, text: stripHtml(html) };
}

function rootRedirect() {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SYNK Tips</title>
<link rel="canonical" href="${SITE_URL}/ko/"><link rel="alternate" hreflang="ko" href="${SITE_URL}/ko/"><link rel="alternate" hreflang="en" href="${SITE_URL}/en/"><link rel="alternate" hreflang="x-default" href="${SITE_URL}/ko/">
<meta http-equiv="refresh" content="0; url=ko/"><link rel="stylesheet" href="assets/style.css">
</head><body class="redirect"><main class="wrap main"><p class="lead">SYNK Tips — <a href="ko/">한국어</a> · <a href="en/">English</a></p></main></body></html>
`;
}

function notFoundPage(assetVer) {
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
  const items = posts.filter((p) => p.lang === lang).sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => {
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
  out('404.html', notFoundPage(assetVer));
  for (const lang of LANGS) {
    out(`${lang}/index.html`, homePage(lang, posts, '../', assetVer));
    urls.push(`${lang}/`);
    const index = [];
    for (const p of posts.filter((x) => x.lang === lang)) {
      const { page, text } = postPage(p, posts, '../../', assetVer);
      out(`${lang}/${p.slug}/index.html`, page);
      urls.push(`${lang}/${p.slug}/`);
      index.push({ u: `${p.slug}/`, t: p.title, s: p.summary, l: LEVELS[p.level][lang], lv: p.level, p: TOPICS[p.topic][lang], k: p.tools, d: p.date, b: text.slice(0, 2000) });
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
