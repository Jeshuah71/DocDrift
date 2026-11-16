import type { Finding } from '../types.js';

export default function Findings({ findings }: { findings: Finding[] }) {
  return (
    <div className="finding-list">
      {findings.map(finding => (
        <article key={finding.id} className={`finding ${finding.severity}`}>
          <span className={`status ${finding.severity}`}>
            {finding.severity === 'mismatch' ? 'Confirmed mismatch' : finding.severity === 'warning' ? 'Warning' : 'Suggestion'}
          </span>
          <h4>{finding.problem}</h4>
          <p>{finding.cause}</p>
          <p><strong>Recommendation:</strong> {finding.recommendation}</p>
          <a href={finding.url} target="_blank" rel="noopener noreferrer">Review repository ↗</a>
        </article>
      ))}
    </div>
  );
}
