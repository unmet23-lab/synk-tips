import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../site/assets/app.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const entry = { t: '검색 회복', s: '회선 복구 뒤 다시 찾기', p: '도구', l: '기초', lv: 'beginner', k: [], b: '검색', d: '2026-10-23', u: 'recover/' };

// Run the complete browser script and dispatch its public events. The fixture
// only supplies the DOM capabilities used by the two search fields.
function fixture(fetch) {
  const timers = new Map();
  let timerId = 0;
  function node(attributes = {}) {
    const events = new Map();
    return {
      value: '', hidden: true, innerHTML: '', tagName: 'INPUT', offsetParent: {},
      classList: { add() {}, remove() {}, toggle() {} },
      getAttribute: key => attributes[key] ?? null,
      hasAttribute: key => Object.hasOwn(attributes, key),
      setAttribute: (key, value) => { attributes[key] = value; },
      addEventListener(type, listener) { events.set(type, listener); },
      emit(type, event = {}) { events.get(type)?.({ preventDefault() {}, ...event }); },
      querySelector() { return null; }, querySelectorAll() { return []; },
      contains() { return false; }, focus() {}, blur() {},
    };
  }
  const boxes = [false, true].map(main => {
    const input = node({ 'data-index': '/search.json', 'data-empty': '검색 결과 없음' });
    const panel = node();
    const go = node();
    const box = node(main ? { 'data-search-main': '' } : {});
    box.querySelector = selector => ({ input, '[data-search-panel]': panel, '[data-search-go]': go })[selector] || null;
    return { box, input, panel, go };
  });
  const document = {
    body: node({ 'data-rel': '/' }), documentElement: { lang: 'ko' },
    querySelectorAll: selector => selector === '[data-search]' ? boxes.map(b => b.box) : [],
    querySelector: () => null, addEventListener() {}, activeElement: null,
  };
  vm.runInNewContext(script, {
    document, fetch, navigator: {}, window: {}, location: {},
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  return {
    boxes,
    async input(value, index = 0) {
      boxes[index].input.value = value;
      boxes[index].input.emit('input');
      const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn());
      await flush();
    },
    async focus(index = 0) { boxes[index].input.emit('focus'); await flush(); },
  };
}

for (const [name, fail] of [
  ['network rejection', () => Promise.reject(new Error('offline'))],
  ['HTTP failure', () => Promise.resolve({ ok: false, status: 503, json: async () => [entry] })],
  ['invalid JSON', () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } })],
  ['non-array response', () => Promise.resolve({ ok: true, json: async () => ({ error: 'temporary' }) })],
]) {
  test(`${name} can recover on the next input without a page reload`, async () => {
    let calls = 0;
    const page = fixture(() => ++calls === 1 ? fail() : Promise.resolve({ ok: true, json: async () => [entry] }));
    await page.input('검색');
    assert.doesNotMatch(page.boxes[0].panel.innerHTML, /class="hit"/);
    await page.input('검색 회복');
    assert.equal(calls, 2);
    assert.match(page.boxes[0].panel.innerHTML, /class="hit"/);
    assert.match(page.boxes[0].panel.innerHTML, /\/ko\/recover\//);
  });
}

test('failed focus preload is handled and the next focus retries', async () => {
  let calls = 0;
  const page = fixture(() => ++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, json: async () => [entry] }));
  await page.focus();
  await page.focus();
  await page.input('검색');
  assert.equal(calls, 2);
  assert.match(page.boxes[0].panel.innerHTML, /class="hit"/);
});

test('both search fields share an in-flight request and reuse a successful index', async () => {
  let resolveFetch;
  let calls = 0;
  const page = fixture(() => { calls++; return new Promise(resolve => { resolveFetch = resolve; }); });
  await page.focus(0);
  await page.focus(1);
  assert.equal(calls, 1);
  resolveFetch({ ok: true, json: async () => [entry] });
  await flush();
  await page.input('검색', 0);
  assert.match(page.boxes[0].panel.innerHTML, /class="hit"/);
  await page.input('검색', 1);
  assert.match(page.boxes[1].panel.innerHTML, /class="hit"/);
  assert.equal(page.boxes[0].panel.hidden, true);
  assert.equal(calls, 1);
});

test('empty index is cached and the existing no-results message is preserved', async () => {
  let calls = 0;
  const page = fixture(() => { calls++; return Promise.resolve({ ok: true, json: async () => [] }); });
  await page.input('검색');
  assert.match(page.boxes[0].panel.innerHTML, /검색 결과 없음/);
  await page.input('다른 검색');
  assert.equal(calls, 1);
});
