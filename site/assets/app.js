/* tips.synk.im — 복사 단추 · 페이지 안 검색(메뉴 칸 · 첫 화면 큰 칸) · 증상 칩 · 이 글의 차례 현재 위치 (서버 없음) */
(function () {
  'use strict';

  /* ---------- 코드 복사 ---------- */
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }
  function copyText(text) {
    // 새 API 가 막히면(권한·비보안 주소·내장 브라우저) 옛 방식으로 한 번 더
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    return legacyCopy(text);
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
  var rel = document.body.getAttribute('data-rel') || './';
  var lang = document.documentElement.lang || 'ko';
  var index = null, loading = null;

  function load(url) {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch(url).then(function (r) { return r.json(); }).then(function (j) { index = j; return j; });
    return loading;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  // 모든 낱말이 들어 있는 글만, 제목·요약·도구에 들어 있으면 위로 (build.mjs preparePost 의 short 검사와 같은 규칙)
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

  var boxes = [];
  function closeAll(except) {
    boxes.forEach(function (b) { if (b !== except) b.panel.hidden = true; });
  }

  function setupSearch(box) {
    var input = box.querySelector('input');
    var panel = box.querySelector('[data-search-panel]');
    if (!input || !panel) return null;
    var api = { box: box, input: input, panel: panel };
    function render(q) {
      var terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) { panel.hidden = true; panel.innerHTML = ''; return; }
      load(input.getAttribute('data-index')).then(function (items) {
        var hits = items.map(function (p) { return { p: p, sc: score(p, terms) }; }).filter(function (h) { return h.sc > 0; })
          .sort(function (a, b) { return b.sc - a.sc || (a.p.d < b.p.d ? 1 : a.p.d > b.p.d ? -1 : 0); }).slice(0, 12);
        closeAll(api);
        if (!hits.length) { panel.innerHTML = '<p class="empty">' + esc(input.getAttribute('data-empty')) + '</p>'; panel.hidden = false; return; }
        panel.innerHTML = hits.map(function (h) {
          var p = h.p;
          return '<a class="hit" href="' + esc(rel + lang + '/' + p.u) + '">'
            + '<span class="hit-title">' + mark(p.t, terms) + '</span>'
            + '<span class="hit-sum">' + mark(snippet(p, terms), terms) + '</span>'
            + '<span class="hit-meta"><span class="lv lv-' + esc(p.lv) + '"><i aria-hidden="true"></i>' + esc(p.l) + '</span><span class="tag">' + esc(p.p) + '</span></span>'
            + '</a>';
        }).join('');
        panel.hidden = false;
      }).catch(function () { panel.innerHTML = '<p class="empty">…</p>'; panel.hidden = false; });
    }
    api.render = render;
    var timer = null;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { render(input.value); }, 120); });
    input.addEventListener('focus', function () { load(input.getAttribute('data-index')); if (input.value.trim()) render(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; panel.hidden = true; input.blur(); if (closeMobileSearch) closeMobileSearch(); }
      if (e.key === 'ArrowDown') { var first = panel.querySelector('a'); if (first) { e.preventDefault(); first.focus(); } }
      if (e.key === 'Enter') { var top = panel.querySelector('a'); if (top) { e.preventDefault(); location.href = top.href; } else render(input.value); }
    });
    panel.addEventListener('keydown', function (e) {
      var links = Array.prototype.slice.call(panel.querySelectorAll('a'));
      var i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : input).focus(); }
      if (e.key === 'Escape') { panel.hidden = true; input.focus(); }
    });
    var go = box.querySelector('[data-search-go]');
    if (go) go.addEventListener('click', function () {
      if (!input.value.trim()) { input.focus(); return; }
      var top = !panel.hidden && panel.querySelector('a');
      if (top) { location.href = top.href; return; }
      render(input.value); input.focus();
    });
    return api;
  }

  document.querySelectorAll('[data-search]').forEach(function (box) { var api = setupSearch(box); if (api) boxes.push(api); });
  if (boxes.length) {
    var openerBtn = document.querySelector('[data-search-open]');
    var closeMobileSearch = function () { document.body.classList.remove('search-open'); if (openerBtn) openerBtn.setAttribute('aria-expanded', 'false'); };
    var main = boxes.filter(function (b) { return b.box.hasAttribute('data-search-main'); })[0];
    var bar = boxes.filter(function (b) { return !b.box.hasAttribute('data-search-main'); })[0];

    document.addEventListener('click', function (e) {
      boxes.forEach(function (b) { if (!b.box.contains(e.target) && !e.target.closest('[data-search-open]') && !e.target.closest('[data-q]')) b.panel.hidden = true; });
      if (bar && !bar.box.contains(e.target) && !e.target.closest('[data-search-open]')) closeMobileSearch();
    });

    // 휴대폰: 돋보기 단추가 메뉴 칸을 화면 위에 펼친다
    var opener = document.querySelector('[data-search-open]');
    if (opener && bar) opener.addEventListener('click', function () {
      var open = document.body.classList.toggle('search-open');
      opener.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { bar.input.focus(); if (bar.input.value.trim()) bar.render(bar.input.value); } else { bar.panel.hidden = true; }
    });

    // 「많이 찾는 증상」 칩: 큰 검색 칸에 그 말을 넣고 결과를 펼친다(스크립트가 없으면 그 글로 바로 간다)
    document.querySelectorAll('[data-q]').forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        var target = main || bar;
        if (!target) return;
        e.preventDefault();
        target.input.value = chip.getAttribute('data-q');
        target.input.focus({ preventScroll: true });
        target.render(target.input.value);
      });
    });

    // '/' 로 검색 칸으로 — 첫 화면은 큰 칸, 그 밖은 메뉴 칸(휴대폰이면 펼쳐서)
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
      var target = main && main.input.offsetParent !== null ? main : bar;
      if (!target) return;
      e.preventDefault();
      if (target === bar && bar.input.offsetParent === null) { document.body.classList.add('search-open'); if (openerBtn) openerBtn.setAttribute('aria-expanded', 'true'); }
      target.input.focus();
    });
  }

  /* ---------- 이 글의 차례: 읽는 절 표시 · 휴대폰 차례 막대 ---------- */
  var heads = Array.prototype.slice.call(document.querySelectorAll('.prose .sec-h h2[id]'));
  if (!heads.length) return;
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('[data-toc] ol a, .mtoc-list a'));
  var mtoc = document.querySelector('[data-mtoc]');
  var mBtn = mtoc && mtoc.querySelector('.mtoc-btn');
  var mList = mtoc && mtoc.querySelector('.mtoc-list');
  var mN = mtoc && mtoc.querySelector('[data-mtoc-n]');
  var mLabel = mtoc && mtoc.querySelector('[data-mtoc-label]');
  var mProg = mtoc && mtoc.querySelector('[data-mtoc-prog]');
  var article = document.querySelector('.post');
  var current = -1;

  function setOpen(open) {
    if (!mList) return;
    mList.hidden = !open;
    mBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (mBtn) mBtn.addEventListener('click', function () { setOpen(mList.hidden); });
  if (mList) mList.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('click', function (e) { if (mtoc && !mtoc.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mList && !mList.hidden) { setOpen(false); mBtn.focus(); } });

  function update() {
    var line = 140; // 메뉴 막대 + 휴대폰 차례 막대 아래
    var i = 0;
    for (var k = 0; k < heads.length; k++) if (heads[k].getBoundingClientRect().top - line <= 0) i = k;
    if (i !== current) {
      current = i;
      var id = heads[i].id;
      tocLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + id); });
      if (mN) {
        var a = mList.querySelector('a[href="#' + id + '"]');
        mN.textContent = a ? a.querySelector('.n').textContent : String(i + 1);
        mLabel.textContent = a ? a.lastElementChild.textContent : heads[i].textContent;
      }
    }
    if (mProg && article) {
      var r = article.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var done = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      mProg.style.width = (done * 100).toFixed(1) + '%';
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
