import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const load = path => import(pathToFileURL(`${process.env.DOCDRIFT_TEST_BUILD}/${path}.js`));
const { GitHubClient, GitHubError } = await load('services/github');
const { scanRepositories, cachedScan } = await load('services/audit');
const { analyzeRepository } = await load('services/analyze');
const response = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const repo = id => ({ id, name: `repo-${id}`, owner: { login: 'account' }, html_url: `https://github.com/account/repo-${id}`, description: null, default_branch: 'main' });

test('pagination uses 100 per page, three workers, and retains presence states', async t => {
  let active = 0, peak = 0;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url);
    if (url.includes('/users/')) {
      assert.match(url, /per_page=100/);
      return new URL(url).searchParams.get('page') === '1' ? response([repo(1), repo(2)], 200, { link: '<https://api.github.com/users/account/repos?page=2>; rel="next"' }) : response([repo(3), repo(4)]);
    }
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return response({}, url.includes('repo-2/') ? 404 : 200);
  });
  const snapshots = [];
  const result = await scanRepositories('account', new GitHubClient(new AbortController().signal), null, s => snapshots.push(s));
  assert.equal(result.repos.length, 4); assert.equal(result.nextPage, null);
  assert.equal(result.repos[1].hasReadme, false); assert.equal(result.repos[0].hasReadme, true);
  assert.equal(peak, 3); assert.equal(calls.length, 6); assert.ok(snapshots.some(s => s.repos.some(r => r.hasReadme === null)));
  assert.deepEqual(cachedScan('ACCOUNT'), result);
});
test('network failure and request budget never mark unchecked repositories missing; continuation skips completed checks', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/users/')) return response([repo(11), repo(12), repo(13), repo(14)]);
    if (url.includes('repo-12')) throw new TypeError('offline');
    return response({});
  });
  const first = await scanRepositories('network', new GitHubClient(new AbortController().signal, 3), null, () => {});
  assert.equal(first.repos.find(r => r.id === 11).hasReadme, true);
  assert.equal(first.repos.find(r => r.id === 12).hasReadme, null);
  assert.equal(first.repos.find(r => r.id === 14).hasReadme, null);
  let checks = 0;
  t.mock.method(globalThis, 'fetch', async url => { assert.ok(!url.includes('/users/')); assert.ok(!url.includes('repo-11')); checks++; return response({}); });
  const second = await scanRepositories('network', new GitHubClient(new AbortController().signal), first, () => {});
  assert.equal(checks, 3); assert.ok(second.repos.every(r => r.hasReadme === true));
});
test('cancellation preserves completed results and stops scheduling new work', async t => {
  const abort = new AbortController();
  t.mock.method(globalThis, 'fetch', async url => url.includes('/users/') ? response([repo(21), repo(22), repo(23), repo(24)]) : response({}));
  const result = await scanRepositories('cancel', new GitHubClient(abort.signal), null, scan => { if (scan.repos.some(r => r.hasReadme === true)) abort.abort(); });
  assert.ok(result.repos.some(r => r.hasReadme === true)); assert.equal(result.repos[3].hasReadme, null); assert.match(result.message, /cancelled/);
});
test('HTTP errors, rate-limit headers, retry-after cooldown and exhausted-success handling', async t => {
  let now = 2_000_000_000_000;
  t.mock.method(Date, 'now', () => now);
  for (const status of [500, 403, 429]) {
    now += 3_600_000;
    t.mock.method(globalThis, 'fetch', async () => response({}, status, status === 500 ? {} : { 'retry-after': '120', 'x-ratelimit-remaining': '0' }));
    const client = new GitHubClient(new AbortController().signal);
    await assert.rejects(client.request('/test'), e => e instanceof GitHubError && e.status === status);
    if (status !== 500) {
      let called = false;
      t.mock.method(globalThis, 'fetch', async () => { called = true; return response({}); });
      await assert.rejects(client.request('/test'), /paused/); assert.equal(called, false);
    }
  }
  now += 3_600_000;
  t.mock.method(globalThis, 'fetch', async () => response({}, 200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String((now + 60_000) / 1000) }));
  const client = new GitHubClient(new AbortController().signal);
  assert.equal((await client.request('/test')).status, 200);
  await assert.rejects(client.request('/test'), /paused/);
  // Advance past all shared cooldowns before returning to real time.
  now += 3_600_000;
});
test('rate limiting during scan preserves completed results and leaves failures unknown', async t => {
  t.mock.method(Date, 'now', () => 3_000_000_000_000);
  t.mock.method(globalThis, 'fetch', async url => url.includes('/users/') ? response([repo(31), repo(32), repo(33), repo(34)]) : url.includes('repo-31') ? response({}) : response({}, 429, { 'retry-after': '1' }));
  const result = await scanRepositories('limited', new GitHubClient(new AbortController().signal), null, () => {});
  assert.equal(result.repos[0].hasReadme, true); assert.equal(result.repos[1].hasReadme, null); assert.equal(result.repos[3].hasReadme, null); assert.match(result.message, /GitHub/);
});
test('analyzer checks Python paths and scripts, preserves preview on partial failure, and caches complete analysis', async t => {
  t.mock.method(Date, 'now', () => 4_000_000_000_000);
  let requests = 0;
  const content = '# Project\nA project that provides useful examples for developers and explains its purpose clearly.\n## Install\npip install -r missing.txt\n## Usage\nnpm run absent\npnpm run dev\nyarn build\n[Guide](docs/missing.md)';
  t.mock.method(globalThis, 'fetch', async url => {
    requests++;
    if (url.endsWith('/readme')) return response({ path: 'README.md', sha: 'abc', encoding: 'base64', content: btoa(content) });
    if (url.endsWith('package.json')) return response({ encoding: 'base64', content: btoa(JSON.stringify({ scripts: { dev: 'vite', build: 'vite build' } })) });
    if (url.endsWith('pyproject.toml')) return response({});
    return response({}, 404);
  });
  const result = await analyzeRepository('a', 'complete', new GitHubClient(new AbortController().signal));
  assert.equal(result.document.content, content); assert.equal(result.findings.filter(f => f.id.startsWith('script:')).length, 1);
  assert.ok(result.findings.some(f => f.id === 'file:missing.txt' && f.severity === 'mismatch'));
  assert.match(result.summary, /Python project files detected/);
  const before = requests;
  await analyzeRepository('a', 'complete', new GitHubClient(new AbortController().signal)); assert.equal(requests, before);
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/readme') ? response({ path: 'README.md', sha: 'a', encoding: 'base64', content: btoa(content) }) : response({}, 500));
  const partial = await analyzeRepository('a', 'partial', new GitHubClient(new AbortController().signal));
  assert.equal(partial.document.content, content); assert.ok(partial.findings.some(f => f.id === 'request-error'));
  assert.ok(partial.findings.filter(f => f.id.startsWith('file:')).every(f => f.severity !== 'mismatch'));
});
