import ts from 'typescript';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const output = mkdtempSync(join(tmpdir(), 'docdrift-tests-'));
function compile(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) compile(path);
    else if (/\.tsx?$/.test(path)) {
      const target = join(output, relative('src', path).replace(/\.tsx?$/, '.js'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, ts.transpileModule(readFileSync(path, 'utf8').replace(/import ['"][^'"]+\.css['"];?/g, ''), { fileName: path, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText);
    }
  }
}
try {
  compile('src'); symlinkSync(resolve('node_modules'), join(output, 'node_modules')); writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  const result = spawnSync(process.execPath, ['--test', ...readdirSync('tests').filter(f => f.endsWith('.test.mjs')).map(f => join('tests', f))], { stdio: 'inherit', env: { ...process.env, DOCDRIFT_TEST_BUILD: output } });
  process.exitCode = result.status ?? 1;
} finally { rmSync(output, { recursive: true, force: true }); }
