import { useRef, useState } from 'react';
import AuditDashboard from './components/AuditDashboard.js';
import type { AuditFilter } from './components/AuditDashboard.js';
import ReadmeResults from './components/ReadmeResults.js';
import { GitHubClient, parseRepositoryUrl } from './services/github.js';
import { cachedScan, saveScan, scanRepositories } from './services/audit.js';
import { analyzeRepository, clearAnalysisCache } from './services/analyze.js';
import type { Analysis } from './services/analyze.js';
import type { Scan } from './types.js';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'audit' | 'readme'>('audit');
  const [username, setUsername] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [scan, setScan] = useState<Scan | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [operation, setOperation] = useState<'audit' | 'readme' | null>(null);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);

  async function handleSearch(continueScan = false, fresh = false) {
    if (controller.current) return;
    const account = continueScan && scan ? scan.username : username.trim();
    if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(account)) {
      setError('Enter a valid GitHub username.');
      return;
    }
    setError('');
    setNotice('');
    setFilter('all');
    const previous = fresh ? null : continueScan ? scan : cachedScan(account);
    if (previous && !continueScan) {
      setScan(previous);
      setNotice('Showing cached session results. Continue any unfinished checks or start a fresh scan.');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setIsLoading(true);
    setOperation('audit');
    setScan(previous ?? {
      username: account,
      repos: [],
      nextPage: 1,
      updatedAt: new Date().toISOString(),
      message: '',
    });
    try {
      await scanRepositories(account, new GitHubClient(abort.signal), previous, setScan);
    } finally {
      controller.current = null;
      setIsLoading(false);
      setOperation(null);
    }
  }

  async function handleReadmeSearch(value = repoUrl, fresh = false) {
    if (controller.current) return;
    const repository = parseRepositoryUrl(value);
    if (!repository) {
      setError('Enter a public GitHub repository URL, such as https://github.com/owner/project.');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setIsLoading(true);
    setOperation('readme');
    setError('');
    setNotice('');
    setAnalysis(null);
    setAnalyzedUrl(value);
    setRepoUrl(value);
    setActiveTab('readme');
    if (fresh) clearAnalysisCache(repository.owner, repository.repo);
    try {
      const result = await analyzeRepository(repository.owner, repository.repo, new GitHubClient(abort.signal, 25));
      setAnalysis(result);
      if (scan) {
        const updated: Scan = {
          ...scan,
          repos: scan.repos.map(repo => {
            const matches = repo.owner.login.toLowerCase() === repository.owner.toLowerCase()
              && repo.name.toLowerCase() === repository.repo.toLowerCase();
            return matches ? {
              ...repo,
              hasReadme: true,
              checkError: undefined,
              findings: result.findings,
              analysis: { analyzedAt: result.analyzedAt, summary: result.summary },
            } : repo;
          }),
        };
        saveScan(updated);
        setScan(updated);
      }
    } catch (err) {
      setError(abort.signal.aborted
        ? 'Analysis cancelled. You can try again when ready.'
        : err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      controller.current = null;
      setIsLoading(false);
      setOperation(null);
    }
  }
  const repos = scan?.repos ?? [];
  const checked = repos.filter(repo => repo.hasReadme !== null).length;

  const progressLabel = operation === 'readme'
    ? 'Reading README and verifying referenced files…'
    : scan?.nextPage !== null
      ? `Discovering repositories… ${repos.length} found`
      : `Checking ${checked} of ${repos.length} repositories`;

  return (
    <main className="app">
      <header>
        <h1>DocDrift</h1>
        <p>Keep your GitHub repositories documented.</p>
      </header>
      <section className="dashboard">
        <div className="tabs" aria-label="Analysis mode">
          <button
            aria-pressed={activeTab === 'audit'}
            className={activeTab === 'audit' ? 'active' : ''}
            onClick={() => { setActiveTab('audit'); setError(''); }}
          >
            Repository Audit
          </button>
          <button
            aria-pressed={activeTab === 'readme'}
            className={activeTab === 'readme' ? 'active' : ''}
            onClick={() => { setActiveTab('readme'); setError(''); }}
          >
            README Analyzer
          </button>
        </div>
        <h2>{activeTab === 'audit' ? 'Analyze your GitHub repositories' : 'Check your README documentation'}</h2>
        <form
          className="search-form"
          onSubmit={event => {
            event.preventDefault();
            if (activeTab === 'audit') void handleSearch();
            else void handleReadmeSearch();
          }}
        >
          <label htmlFor="repository-search">
            {activeTab === 'audit' ? 'GitHub username' : 'Public GitHub repository URL'}
          </label>
          <div className="search-controls">
            <input
              id="repository-search"
              required
              value={activeTab === 'audit' ? username : repoUrl}
              placeholder={activeTab === 'audit' ? 'Enter GitHub username' : 'https://github.com/owner/project'}
              onChange={event => activeTab === 'audit' ? setUsername(event.target.value) : setRepoUrl(event.target.value)}
            />
            <button disabled={isLoading}>{isLoading ? 'Analyzing...' : 'Analyze'}</button>
            {isLoading && (
              <button type="button" className="secondary" onClick={() => controller.current?.abort()}>
                Cancel scan
              </button>
            )}
          </div>
        </form>
        <p className="scope-note">
          No login required. Public repositories only. GitHub usually permits 60 unauthenticated requests per hour per IP;
          other activity shares this allowance.
        </p>
        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message" role="status">{notice}</p>}
        {isLoading && (
          <div className="progress-panel" role="status" aria-live="polite">
            <strong>{progressLabel}</strong>
            {operation === 'audit' && scan?.nextPage === null && (
              <progress aria-label="README checks completed" max={Math.max(repos.length, 1)} value={checked} />
            )}
            <p>Completed checks are retained if you cancel or reach a request limit.</p>
          </div>
        )}
        {activeTab === 'audit' && !scan && (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">⌕</div>
            <h3>Ready to audit your repositories?</h3>
            <p>Enter a GitHub username above to scan public repositories and discover missing README files.</p>
            <span>No GitHub login required</span>
          </div>
        )}
        {activeTab === 'audit' && scan && (
          <AuditDashboard
            scan={scan}
            filter={filter}
            setFilter={setFilter}
            isLoading={isLoading}
            onFresh={() => { void handleSearch(true, true); }}
            onContinue={() => { void handleSearch(true); }}
            onAnalyze={repo => { void handleReadmeSearch(repo.html_url); }}
          />
        )}
        {activeTab === 'readme' && analysis && (
          <ReadmeResults
            analysis={analysis}
            url={analyzedUrl}
            isLoading={isLoading}
            onRefresh={() => { void handleReadmeSearch(analyzedUrl, true); }}
          />
        )}
        {activeTab === 'readme' && !analysis && !isLoading && (
          <p className="empty-state">
            Analyze a README for section suggestions, npm/Yarn/pnpm script mismatches, and local file references.
            Python checks are limited to static file references.
          </p>
        )}
      </section>
    </main>
  );
}
export default App;
