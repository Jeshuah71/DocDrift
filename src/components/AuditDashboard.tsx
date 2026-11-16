import RepositoryCard from './RepositoryCard.js';
import type { Repository, Scan } from '../types.js';
import { downloadReport } from '../utils/exportReport.js';

export type AuditFilter = 'all' | 'documented' | 'missing' | 'unchecked';
type Props = {
  scan: Scan;
  filter: AuditFilter;
  setFilter: (value: AuditFilter) => void;
  isLoading: boolean;
  onFresh: () => void;
  onContinue: () => void;
  onAnalyze: (repo: Repository) => void;
};

export default function AuditDashboard({ scan, filter, setFilter, isLoading, onFresh, onContinue, onAnalyze }: Props) {
  const repos = scan.repos;
  const checked = repos.filter(repo => repo.hasReadme !== null).length;
  const documented = repos.filter(repo => repo.hasReadme === true).length;
  const missing = repos.filter(repo => repo.hasReadme === false).length;
  const filtered = repos.filter(repo => filter === 'all' || (
    filter === 'unchecked' ? repo.hasReadme === null :
      filter === 'missing' ? repo.hasReadme === false : repo.hasReadme === true
  ));
  const unfinished = scan.nextPage !== null || checked < repos.length;
  const statistics = [
    { value: repos.length, label: 'Discovered' },
    { value: checked, label: 'README checks completed' },
    { value: documented, label: 'With README' },
    { value: missing, label: 'Missing README' },
    { value: repos.length - checked, label: 'Not checked' },
  ];

  return (
    <>
      <div className="section-heading">
        <div>
          <h3>Audit for {scan.username}</h3>
          <p>
            Snapshot: {new Date(scan.updatedAt).toLocaleString()}.{' '}
            {scan.nextPage !== null ? 'Repository discovery is incomplete.' : 'All repository pages discovered.'}
          </p>
        </div>
        <div className="actions">
          <button className="secondary" disabled={isLoading} onClick={onFresh}>Fresh scan</button>
          {unfinished && <button disabled={isLoading} onClick={onContinue}>Continue scan</button>}
        </div>
      </div>
      {scan.message && <p className="message" role="status">{scan.message}</p>}
      <div className="stats">
        {statistics.map(({ value, label }) => (
          <div className="stat-card" key={label}>
            <h3>{value}</h3>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <p className="scope-note">
        Presence checks do not analyze README quality. Use “Analyze README” for individual content findings.
        Not checked includes failed or deferred requests.
      </p>
      <div className="report-toolbar">
        <div className="filters">
          {(['all', 'documented', 'missing', 'unchecked'] as AuditFilter[]).map(value => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value === 'documented' ? 'Documented' : value === 'missing' ? 'Missing README' : 'Not checked'}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="secondary" disabled={!repos.length} onClick={() => downloadReport(scan, 'csv')}>Export CSV</button>
          <button className="secondary" disabled={!repos.length} onClick={() => downloadReport(scan, 'json')}>Export JSON</button>
        </div>
      </div>
      {!isLoading && !filtered.length && (
        <p className="empty-state">
          {repos.length ? 'No repositories match this filter.' : scan.nextPage === null ?
            'This account has no public repositories.' : 'No repositories discovered yet. Check the scan message and try again.'}
        </p>
      )}
      <div className="repository-list">
        {filtered.map(repo => (
          <RepositoryCard key={repo.id} repo={repo} disabled={isLoading} onAnalyze={() => onAnalyze(repo)} />
        ))}
      </div>
    </>
  );
}
