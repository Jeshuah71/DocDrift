import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const load = path => import(pathToFileURL(`${process.env.DOCDRIFT_TEST_BUILD}/${path}.js`));
const { default: App } = await load('App');
const { default: AuditDashboard } = await load('components/AuditDashboard');
const { default: ReadmeResults } = await load('components/ReadmeResults');

test('initial dashboard shows welcome and accessible input rather than zero statistic cards', () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /Ready to audit your repositories/);
  assert.match(html, /for="repository-search"/);
  assert.doesNotMatch(html, /stat-card/);
});
test('partial audit renders distinct unknown status, continuation, filters, and exports', () => {
  const scan = { username: 'a', nextPage: null, updatedAt: '2026-01-01', message: 'Partial scan', repos: [{ id: 1, name: 'unknown-project', description: null, owner: { login: 'a' }, html_url: 'https://github.com/a/unknown-project', hasReadme: null, findings: [] }] };
  const html = renderToStaticMarkup(createElement(AuditDashboard, { scan, filter: 'unchecked', setFilter() {}, isLoading: false, onFresh() {}, onContinue() {}, onAnalyze() {} }));
  assert.match(html, /Continue scan/); assert.match(html, /Export CSV/); assert.match(html, /Export JSON/);
  assert.match(html, /status unknown[^>]*>Not checked/); assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /status mismatch/);
});
test('analysis preview escapes embedded markup and displays limited verification scope', () => {
  const analysis = { document: { content: '<script>alert(1)</script>', path: 'README.md', sha: 'a' }, findings: [], summary: '1 of 4 file paths checked.', analyzedAt: '2026-01-01' };
  const html = renderToStaticMarkup(createElement(ReadmeResults, { analysis, url: 'https://github.com/a/b', isLoading: false, onRefresh() {} }));
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /1 of 4 file paths checked/); assert.match(html, /not a full verification/);
});
