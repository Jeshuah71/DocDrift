import type { ReadmeDocument } from '../types.js';
export class GitHubError extends Error {
  status: number;
  retryAt?: number;
  constructor(message: string, status = 0, retryAt?: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.retryAt = retryAt;
  }
}
export const repositoryPath = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
export function parseRepositoryUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || parts.length !== 2 || !parts.every(p => /^[\w.-]+$/.test(p)) || parts.some(p => p === '.' || p === '..'))
      return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  }
  catch {
    return null;
  }
}
let blockedUntil = 0;
// One instance per operation; the browser session also shares rate-limit cooldowns.
export class GitHubClient {
  requests = 0;
  remaining: number | null = null;
  signal: AbortSignal;
  budget: number;
  constructor(signal: AbortSignal, budget = 50) { this.signal = signal; this.budget = budget; }
  async request(path: string): Promise<Response> {
    this.signal.throwIfAborted();
    if (Date.now() < blockedUntil)
      throw new GitHubError(`GitHub requests paused. Try again after ${new Date(blockedUntil).toLocaleTimeString()}.`, 429, blockedUntil);
    if (this.requests >= this.budget)
      throw new GitHubError('Request budget reached. Completed results are saved; use Continue scan for remaining work.');
    this.requests++;
    let response: Response;
    try {
      response = await fetch(`https://api.github.com${path}`, { signal: this.signal, headers: { Accept: 'application/vnd.github+json' } });
    }
    catch (error) {
      if (this.signal.aborted)
        throw error;
      throw new GitHubError('Network request failed. Check your connection and try again.');
    }
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining !== null)
      this.remaining = Number(remaining);
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    const retry = response.headers.get('retry-after');
    const retryAt = retry ? (/^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry)) : reset;
    if (remaining === '0' || response.status === 429 || response.status === 403) {
      blockedUntil = Math.max(blockedUntil, Number.isFinite(retryAt) && retryAt > Date.now() ? retryAt : Date.now() + 60000);
    }
    if (!response.ok && response.status !== 404) {
      throw new GitHubError(response.status === 403 || response.status === 429
        ? `GitHub refused further requests (${response.status}). Try again after ${new Date(blockedUntil).toLocaleTimeString()}. Completed results are preserved.`
        : `GitHub request failed (${response.status}). Try again later.`, response.status, blockedUntil || undefined);
    }
    return response;
  }
  async json<T>(path: string): Promise<T | null> {
    const response = await this.request(path);
    return response.status === 404 ? null : await response.json() as T;
  }
  async readme(owner: string, repo: string): Promise<ReadmeDocument | null> {
    const file = await this.json<{
      content?: string;
      encoding?: string;
      path: string;
      sha: string;
    }>(`${repositoryPath(owner, repo)}/readme`);
    if (!file)
      return null;
    if (file.encoding !== 'base64' || typeof file.content !== 'string')
      throw new GitHubError('README content is too large or unavailable for analysis.');
    return { content: new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))), path: file.path, sha: file.sha };
  }
}
