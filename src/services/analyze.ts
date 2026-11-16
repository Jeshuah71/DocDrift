import { GitHubClient, repositoryPath } from './github.js';
import { fileFinding, localReferences, missingScriptFindings, sectionFindings, detectScriptCommands } from '../utils/readmeAnalyzer.js';
import type { Finding, ReadmeDocument } from '../types.js';
export type Analysis = {
  document: ReadmeDocument;
  findings: Finding[];
  summary: string;
  checkedPaths: number;
  totalPaths: number;
  analyzedAt: string;
};
const cache = new Map<string, Analysis>();
export async function analyzeRepository(owner: string, repo: string, client: GitHubClient): Promise<Analysis> {
  const key = `${owner}/${repo}`.toLowerCase();
  const cached = cache.get(key);
  if (cached)
    return structuredClone(cached);
  const base = repositoryPath(owner, repo);
  const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const document = await client.readme(owner, repo);
  if (!document)
    throw new Error('No public README was found for this repository.');
  const findings = sectionFindings(document.content, url);
  let limited = false;
  let scripts: Record<string, string> | null = null;
  let checkedPaths = 0;
  const refs = localReferences(document.content, document.path);
  const paths = [...new Set(['package.json', 'requirements.txt', 'pyproject.toml', 'setup.py', ...refs])];
  const existence = new Map<string, boolean | null>();
  // Keep detailed analysis bounded: at most 20 file checks, sequential to respect cooldowns.
  for (const path of paths) {
    if (checkedPaths >= 20 || limited || client.signal.aborted) {
      existence.set(path, null);
      continue;
    }
    try {
      const file = await client.json<{
        content?: string;
        encoding?: string;
      }>(`${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`);
      existence.set(path, file !== null);
      checkedPaths++;
      if (path === 'package.json' && file) {
        if (file.encoding !== 'base64' || !file.content)
          throw new Error('Root package.json could not be decoded.');
        const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('Invalid package.json.');
        const value = (parsed as {
          scripts?: unknown;
        }).scripts;
        if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || !Object.values(value).every(v => typeof v === 'string')))
          throw new Error('Invalid scripts in package.json.');
        scripts = (value ?? {}) as Record<string, string>;
      }
    }
    catch (error) {
      if (client.signal.aborted)
        throw error;
      existence.set(path, null);
      limited = true;
      findings.push({ id: 'request-error', severity: 'warning', problem: 'Some repository files could not be checked.', cause: error instanceof Error ? error.message : 'Request failed.', recommendation: 'Review unchecked paths manually or retry after the request limit resets.', url });
    }
  }
  if (scripts)
    findings.push(...missingScriptFindings(document.content, scripts, url));
  else if (detectScriptCommands(document.content).length)
    findings.push({ id: 'scripts-unverified', severity: 'warning', problem: 'Documented JavaScript commands were not compared with scripts.', cause: 'A valid root package.json was not available. Commands may belong to a subdirectory.', recommendation: 'Check the intended package directory manually.', url });
  for (const path of refs) {
    const finding = fileFinding(path, existence.get(path) ?? null, url);
    if (finding)
      findings.push(finding);
  }
  const python = ['requirements.txt', 'pyproject.toml', 'setup.py'].some(p => existence.get(p) === true);
  const summary = `${checkedPaths} of ${paths.length} file paths checked. ${scripts ? 'Root npm/Yarn/pnpm scripts compared.' : 'Root JavaScript scripts not compared.'} ${python ? 'Python project files detected; only local installation file references checked.' : 'Python project files not detected or unavailable.'} Commands, package installation, and runtime behavior are not executed. Other frameworks: Not supported by this analyzer.`;
  const result = { document, findings, summary, checkedPaths, totalPaths: paths.length, analyzedAt: new Date().toISOString() };
  if (!limited && !client.signal.aborted)
    cache.set(key, structuredClone(result));
  return result;
}
export function clearAnalysisCache(owner: string, repo: string) { cache.delete(`${owner}/${repo}`.toLowerCase()); }
