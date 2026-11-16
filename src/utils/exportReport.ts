import type { Scan } from '../types.js';
import { readmeStatus } from '../services/audit.js';
export function reportRows(scan: Scan) {
  return scan.repos.map(repo => ({ repository: repo.name, url: repo.html_url, readmeStatus: readmeStatus(repo.hasReadme), checkError: repo.checkError ?? '', analysisScope: repo.analysis?.summary ?? 'README presence only; content analysis not performed.', analyzedAt: repo.analysis?.analyzedAt ?? null, findings: repo.findings }));
}
export function csvCell(value: string): string {
  // Prevent spreadsheet formula execution in user-controlled repository text.
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function toCSV(scan: Scan): string {
  const header = ['Repository', 'GitHub URL', 'README status', 'Check error', 'Analysis findings', 'Analysis scope', 'Content analyzed at'];
  return [header, ...reportRows(scan).map(r => [r.repository, r.url, r.readmeStatus, r.checkError, r.findings.map(f => `${f.severity}: ${f.problem} Cause: ${f.cause} Recommendation: ${f.recommendation} ${f.url}`).join('\n'), r.analysisScope, r.analyzedAt ?? ''])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function toJSON(scan: Scan): string {
  return JSON.stringify({ username: scan.username, exportedAt: new Date().toISOString(), scanUpdatedAt: scan.updatedAt, discoveryComplete: scan.nextPage === null, discovered: scan.repos.length, checked: scan.repos.filter(r => r.hasReadme !== null).length, scope: 'README presence only unless content findings are attached. Unchecked repositories have not been verified.', repositories: reportRows(scan) }, null, 2);
}
export function downloadReport(scan: Scan, format: 'csv' | 'json') {
  const blob = new Blob([format === 'csv' ? '\uFEFF' + toCSV(scan) : toJSON(scan)], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `docdrift-${scan.username}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
