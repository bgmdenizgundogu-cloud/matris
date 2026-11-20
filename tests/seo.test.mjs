import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const seoScript = html.match(/<script>\s*(\/\/ The calculator[\s\S]*?)<\/script>/)[1];
const detect = html.match(/function detectInitialLanguage\(\) \{[\s\S]*?\n\}/)[0];
const switchPrefix = html.match(/function setLanguage\(lang\) \{([\s\S]*?)\n  MAIN_TALENT_DATA/)[1];

function browser(search) {
  const links = [];
  const og = {};
  const location = new URL('https://www.destinychartmatrix.com/' + search);
  const context = vm.createContext({
    URL, URLSearchParams,
    window: { location },
    // These preferences must not change the content of a shared URL.
    localStorage: { getItem: () => 'en', setItem() {} },
    navigator: { languages: ['en-US'] },
    history: { state: { checkout: true }, replaceState(state, title, url) {
      assert.equal(state.checkout, true);
      location.href = url.href;
    } },
    document: {
      head: { appendChild: link => links.push(link) },
      createElement: () => ({}),
      querySelector: selector => selector === 'link[rel="canonical"]' ? links[0] : og,
    },
  });
  vm.runInContext(seoScript + '\n' + detect, context);
  return { context, links, og, location };
}

for (const [query, language, canonical] of [
  ['', 'tr', ''], ['?lang=tr', 'tr', ''], ['?lang=en', 'en', '?lang=en'],
  ['?lang=de&utm_source=test', 'tr', ''],
  ['?lang=en&utm_source=test#result', 'en', '?lang=en'],
]) {
  test('language and canonical for /' + query, () => {
    const { context, links, og } = browser(query);
    assert.equal(vm.runInContext('detectInitialLanguage()', context), language);
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'https://www.destinychartmatrix.com/' + canonical);
    assert.equal(og.content, links[0].href);
  });
}

test('language switch preserves checkout parameters, fragment and one canonical', () => {
  const { context, links, location } = browser('?payment_id=example#result');
  vm.runInContext('let currentLang; function switchAddress(lang) {' + switchPrefix + '\n}', context);
  vm.runInContext('switchAddress("en")', context);
  assert.equal(location.searchParams.get('lang'), 'en');
  assert.equal(links[0].href, 'https://www.destinychartmatrix.com/?lang=en');
  vm.runInContext('switchAddress("tr")', context);
  assert.equal(location.searchParams.has('lang'), false);
  assert.equal(location.searchParams.get('payment_id'), 'example');
  assert.equal(location.hash, '#result');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://www.destinychartmatrix.com/');
});

test('language alternatives match sitemap entries', () => {
  const sitemap = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  for (const language of ['tr', 'en', 'x-default']) {
    const href = html.match(new RegExp('hreflang="' + language + '" href="([^"]+)"'))[1];
    assert.ok(sitemap.includes('<loc>' + href + '</loc>'));
  }
});

test('all inline classic scripts parse', () => {
  for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=|application\/ld\+json|type=["']module/.test(attributes)) continue;
    new vm.Script(source);
  }
});
