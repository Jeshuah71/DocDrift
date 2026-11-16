import type { Analysis } from '../services/analyze.js';
import Findings from './Findings.js';

type Props = { analysis: Analysis; url: string; isLoading: boolean; onRefresh: () => void };
export default function ReadmeResults({ analysis, url, isLoading, onRefresh }: Props) {
  return (
    <div className="readme-result">
      <div className="section-heading">
        <div>
          <h3>README analysis summary</h3>
          <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        </div>
        <button className="secondary" disabled={isLoading} onClick={onRefresh}>Refresh analysis</button>
      </div>
      <p>
        {analysis.findings.filter(f => f.severity === 'mismatch').length} confirmed mismatch(es) ·{' '}
        {analysis.findings.filter(f => f.severity === 'warning').length} warning(s) ·{' '}
        {analysis.findings.filter(f => f.severity === 'info').length} suggestion(s)
      </p>
      <p className="message">{analysis.summary}</p>
      <p className="scope-note">
        Section suggestions may not apply to every project. Command checks assume the root package and default branch;
        subdirectory and workspace commands require manual review. npm lifecycle defaults are not reported as missing scripts.
        Snapshot: {new Date(analysis.analyzedAt).toLocaleString()}. Refresh to bypass the analysis cache.
      </p>
      {!analysis.findings.length && <p>No issues detected by these limited rules. This is not a full verification.</p>}
      <Findings findings={analysis.findings} />
      <h3>README Content Preview</h3>
      <p className="scope-note">Plain text preview, limited to 30,000 characters. Markdown and embedded HTML are not executed.</p>
      <pre>{analysis.document.content.slice(0, 30000)}</pre>
    </div>
  );
}
