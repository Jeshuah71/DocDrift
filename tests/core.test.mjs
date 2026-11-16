import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const load = path => import(pathToFileURL(`${process.env.DOCDRIFT_TEST_BUILD}/${path}.js`));
const { parseRepositoryUrl } = await load('services/github');
const { detectScriptCommands, missingScriptFindings, localReferences, fileFinding, sectionFindings } = await load('utils/readmeAnalyzer');
const { toCSV, toJSON, csvCell } = await load('utils/exportReport');
const { readmeStatus } = await load('services/audit');

test('repository URLs validate host, protocol, credentials and path', () => {
  assert.deepEqual(parseRepositoryUrl(' https://github.com/user/repo.git/ '), { owner: 'user', repo: 'repo' });
  for (const url of ['http://github.com/a/b', 'https://github.com.evil.com/a/b', 'https://github.com/a/b/tree/main', 'https://me@github.com/a/b', 'garbage', 'https://github.com/a/a%2Fb']) assert.equal(parseRepositoryUrl(url), null);
});
test('npm, Yarn, pnpm syntaxes and duplicates', () => {
  const commands = detectScriptCommands('npm run dev and npm run start\nnpm run dev\nyarn build\nyarn run test\npnpm run lint\npnpm build\nnpm test\nnpm install\nyarn add react\npnpm exec vite');
  assert.deepEqual(commands.map(c => `${c.manager}:${c.script}`), ['npm:dev','npm:start','yarn:build','yarn:test','pnpm:lint','pnpm:build','npm:test']);
  assert.deepEqual(detectScriptCommands('We use yarn for dependencies and pnpm for other tools.'), []);
  assert.deepEqual(detectScriptCommands('npm --prefix client run dev\nyarn workspace web build\npnpm run dev --dir client\nnpm run optional --if-present\n```sh\ncd frontend\nnpm run dev\n```'), []);
});
test('script mismatches only use defined root script names, with npm lifecycle exceptions', () => {
  const findings = missingScriptFindings('npm run dev\nyarn build\npnpm run absent\nnpm start', { dev: 'vite', build: 'vite build' }, 'https://github.com/a/b');
  assert.equal(findings.length, 1); assert.match(findings[0].problem, /absent/); assert.equal(findings[0].severity, 'mismatch');
});
test('local references normalize README-relative paths, Python requirements, and external exclusions', () => {
  const paths = localReferences('[Guide](../docs/guide.md#intro) ![x](./image.png) [Web](https://example.com/a)\npip install -r requirements-dev.txt\n`pyproject.toml`\n`setup.py`\npip install -e .', 'docs/README.md');
  assert.deepEqual(paths, ['docs/guide.md', 'docs/image.png', 'requirements-dev.txt', 'pyproject.toml', 'setup.py']);
  assert.deepEqual(localReferences('[requirements.txt](config/requirements.txt)', 'README.md'), ['config/requirements.txt']);
  assert.equal(fileFinding('requirements.txt', true, 'url'), null);
  assert.equal(fileFinding('requirements.txt', false, 'url').severity, 'mismatch');
  assert.equal(fileFinding('requirements.txt', null, 'url').severity, 'info');
});
test('section findings are recommendations, not confirmed mismatches', () => {
  const findings = sectionFindings('# Project\nSmall.', 'url');
  assert.equal(findings.length, 6); assert.ok(findings.every(f => f.severity !== 'mismatch' && f.recommendation && f.cause));
});
test('presence has three distinct states', () => {
  assert.deepEqual([true, false, null].map(readmeStatus), ['README Found', 'Missing README', 'Not checked']);
});
test('CSV escapes multiline quotes, formulas, and JSON preserves unknown and findings', () => {
  const scan = { username: 'a', updatedAt: 'now', nextPage: 2, repos: [{ name: '=CMD,"test"\nnext', html_url: 'https://github.com/a/b', hasReadme: null, checkError: 'network', findings: [{ severity: 'info', problem: 'Check', cause: 'limited', recommendation: 'review', url: 'url' }] }] };
  assert.match(toCSV(scan), /"'=CMD,""test""\nnext"/); assert.match(toCSV(scan), /Not checked/);
  assert.equal(csvCell('  +SUM(1)'), '"\'  +SUM(1)"');
  const report = JSON.parse(toJSON(scan));
  assert.equal(report.checked, 0); assert.equal(report.discoveryComplete, false); assert.equal(report.repositories[0].findings.length, 1);
});
