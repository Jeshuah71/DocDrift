import type { Repository } from '../types.js';
import { readmeStatus } from '../services/audit.js';
import Findings from './Findings.js';

type Props = { repo: Repository; onAnalyze: () => void; disabled: boolean };
export default function RepositoryCard({ repo, onAnalyze, disabled }: Props) {
  const status = repo.hasReadme === null ? 'unknown' : repo.hasReadme ? 'success' : 'mismatch';
  return (
    <article className="repository-card">
      <h3>{repo.name}</h3>
      <p>{repo.description || 'No repository description provided.'}</p>
      <span className={`status ${status}`}>{readmeStatus(repo.hasReadme)}</span>
      <a href={repo.html_url} target="_blank" rel="noopener noreferrer">View on GitHub ↗</a>
      {repo.checkError && repo.hasReadme === null && <p className="check-error">{repo.checkError}</p>}
      {repo.hasReadme && <button className="secondary" onClick={onAnalyze} disabled={disabled}>Analyze README</button>}
      {repo.analysis && <p className="scope-note">Content analysis: {new Date(repo.analysis.analyzedAt).toLocaleString()}. Findings are included in exports.</p>}
      {repo.findings.length > 0 && (
        <details>
          <summary>{repo.findings.length} available finding(s)</summary>
          <Findings findings={repo.findings} />
        </details>
      )}
    </article>
  );
}
