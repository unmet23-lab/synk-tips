/* tips.synk.im — 복사 단추 · 페이지 안 검색 · 휴대폰 검색 열기 (서버 없음) */
(function () {
  'use strict';

  /* ---------- 코드 복사 ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    var done = document.documentElement.lang === 'en' ? 'Copied' : '복사됨';
    btn.addEventListener('click', function () {
      var code = btn.closest('.code').querySelector('pre code');
      var text = code.textContent.replace(/\n$/, '');
      copyText(text).then(function () {
        btn.textContent = done + ' ✓'; btn.classList.add('done');
        setTimeout(function () { btn.textContent = label; btn.classList.remove('done'); }, 1600);
      }, function () { btn.textContent = '✗'; setTimeout(function () { btn.textContent = label; }, 1600); });
    });
  });

  /* ---------- 검색 ---------- */
  var box = document.querySelector('[data-search]');
  if (!box) return;
  var input = box.querySelector('input');
  var panel = box.querySelector('[data-search-panel]');
  var rel = document.body.getAttribute('data-rel') || './';
  var lang = document.documentElement.lang || 'ko';
  var index = null, loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch(input.getAttribute('data-index')).then(function (r) { return r.json(); }).then(function (j) { index = j; return j; });
    return loading;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  function score(p, terms) {
    var hay = [p.t, p.s, p.p, p.l, (p.k || []).join(' '), p.b].join(' \n ').toLowerCase();
    var sc = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (hay.indexOf(t) < 0) return 0;
      if (p.t.toLowerCase().indexOf(t) >= 0) sc += 6;
      if (p.s.toLowerCase().indexOf(t) >= 0) sc += 4;
      if ((p.k || []).join(' ').toLowerCase().indexOf(t) >= 0) sc += 3;
      sc += 1;
    }
    return sc;
  }
  function snippet(p, terms) {
    var body = p.b || '';
    var low = body.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length && at < 0; i++) at = low.indexOf(terms[i]);
    if (at < 0) return p.s;
    var start = Math.max(0, at - 40);
    return (start > 0 ? '…' : '') + body.slice(start, start + 120) + '…';
  }
  function render(q) {
    var terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { panel.hidden = true; panel.innerHTML = ''; return; }
    load().then(function (items) {
      var hits = items.map(function (p) { return { p: p, sc: score(p, terms) }; }).filter(function (h) { return h.sc > 0; })
        .sort(function (a, b) { return b.sc - a.sc || (a.p.d < b.p.d ? 1 : -1); }).slice(0, 12);
      if (!hits.length) { panel.innerHTML = '<p class="empty">' + esc(input.getAttribute('data-empty')) + '</p>'; panel.hidden = false; return; }
      panel.innerHTML = hits.map(function (h) {
        var p = h.p;
        return '<a class="hit" href="' + esc(rel + lang + '/' + p.u) + '">'
          + '<span class="hit-title">' + mark(p.t, terms) + '</span>'
          + '<span class="hit-sum">' + mark(snippet(p, terms), terms) + '</span>'
          + '<span class="hit-meta"><span class="lv lv-' + esc(p.lv) + '"><i aria-hidden="true"></i>' + esc(p.l) + '</span><span class="chip chip-flat">' + esc(p.p) + '</span></span>'
          + '</a>';
      }).join('');
      panel.hidden = false;
    }).catch(function () { panel.innerHTML = '<p class="empty">…</p>'; panel.hidden = false; });
  }
  var timer = null;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(input.value); }, 120); });
  input.addEventListener('focus', function () { load(); if (input.value.trim()) render(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; panel.hidden = true; input.blur(); document.body.classList.remove('search-open'); }
    if (e.key === 'ArrowDown') { var first = panel.querySelector('a'); if (first) { e.preventDefault(); first.focus(); } }
    if (e.key === 'Enter') { var top = panel.querySelector('a'); if (top) { e.preventDefault(); location.href = top.href; } }
  });
  panel.addEventListener('keydown', function (e) {
    var links = Array.prototype.slice.call(panel.querySelectorAll('a'));
    var i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
    if (e.key === 'Escape') { panel.hidden = true; input.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!box.contains(e.target) && !e.target.closest('[data-search-open]')) { panel.hidden = true; document.body.classList.remove('search-open'); }
  });
  var opener = document.querySelector('[data-search-open]');
  if (opener) opener.addEventListener('click', function () {
    var open = document.body.classList.toggle('search-open');
    if (open) { input.focus(); if (input.value.trim()) render(input.value); } else { panel.hidden = true; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); document.body.classList.add('search-open'); input.focus(); }
  });
})();
