import { GitHubClient, repositoryPath } from './github.js';
import type { Repository, Scan } from '../types.js';
const memory = new Map<string, Scan>();
export function saveScan(scan: Scan) {
  const copy = structuredClone(scan);
  memory.set(scan.username.toLowerCase(), copy);
  try {
    sessionStorage.setItem(`docdrift:v2:${scan.username.toLowerCase()}`, JSON.stringify(copy));
  }
  catch { /* Memory cache remains available when storage is blocked/full. */ }
}
export function cachedScan(username: string): Scan | null {
  const key = username.toLowerCase();
  if (memory.has(key))
    return structuredClone(memory.get(key)!);
  try {
    const data = JSON.parse(sessionStorage.getItem(`docdrift:v2:${key}`) ?? 'null') as Scan | null;
    if (data && data.username.toLowerCase() === key && Array.isArray(data.repos) && (data.nextPage === null || Number.isInteger(data.nextPage)))
      return data;
  }
  catch { /* Ignore inaccessible or malformed storage. */ }
  return null;
}
export function readmeStatus(value: boolean | null) { return value === true ? 'README Found' : value === false ? 'Missing README' : 'Not checked'; }
export async function scanRepositories(username: string, client: GitHubClient, previous: Scan | null, update: (scan: Scan) => void): Promise<Scan> {
  const scan: Scan = previous ? structuredClone(previous) : { username, repos: [], nextPage: 1, updatedAt: new Date().toISOString(), message: '' };
  scan.message = '';
  const publish = () => { scan.updatedAt = new Date().toISOString(); saveScan(scan); update(structuredClone(scan)); };
  try {
    while (scan.nextPage !== null) {
      const response = await client.request(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner&page=${scan.nextPage}`);
      if (response.status === 404)
        throw new Error('GitHub user not found. Check the username.');
      const page = await response.json() as Repository[];
      for (const repo of page)
        if (!scan.repos.some(r => r.id === repo.id))
          scan.repos.push({ ...repo, hasReadme: null, findings: [] });
      scan.nextPage = /rel="next"/.test(response.headers.get('link') ?? '') ? scan.nextPage + 1 : null;
      publish();
    }
    let cursor = 0;
    let stopped = false;
    const pending = scan.repos.filter(r => r.hasReadme === null);
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (!stopped && !client.signal.aborted) {
        const repo = pending[cursor++];
        if (!repo)
          return;
        try {
          const response = await client.request(`${repositoryPath(repo.owner.login, repo.name)}/readme`);
          repo.hasReadme = response.status !== 404;
          repo.checkError = undefined;
          repo.findings = repo.hasReadme ? [] : [{ id: 'missing-readme', severity: 'mismatch', problem: 'No README returned by GitHub.', cause: 'The public repository README endpoint returned 404.', recommendation: 'Add a README describing the project, setup, and usage.', url: repo.html_url }];
        }
        catch (error) {
          repo.checkError = client.signal.aborted ? 'Scan cancelled before this check completed.' : error instanceof Error ? error.message : 'Could not check README.';
          if (!client.signal.aborted)
            scan.message = repo.checkError;
          stopped = true;
        }
        publish();
      }
    }));
    if (client.signal.aborted)
      scan.message = 'Scan cancelled. Completed results are saved; unchecked repositories can be continued.';
    else if (!scan.message)
      scan.message = 'README presence checks completed for all discovered repositories. Content analysis is available separately.';
  }
  catch (error) {
    scan.message = client.signal.aborted ? 'Scan cancelled. Completed results are saved.' : error instanceof Error ? error.message : 'Scan failed.';
  }
  publish();
  return scan;
}
