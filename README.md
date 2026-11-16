# DocDrift

Find missing READMEs, review documentation, and export actionable reports. Built with React, TypeScript, Vite, CSS, and the public GitHub REST API. Everything runs in your browser: no backend, authentication, tokens, database, paid services, or AI APIs.

## Repository Audit

Enter a GitHub username to discover public repositories using pages of up to 100 repositories. DocDrift then checks README presence with at most three requests in flight.

- See discovered, checked, documented, missing, and unchecked counts separately.
- Watch live progress, cancel a scan, or continue unfinished work.
- Filter documented, missing, and unchecked repositories.
- Reuse session-cached results without repeating requests, or choose **Fresh scan**.
- Export all discovered repositories as CSV or JSON, including statuses, errors, and any available content findings. Exports include all results, regardless of the selected filter.
- Select **Analyze README** on an individual card to attach detailed content findings to that audit and its exports.

A successful README response counts as found; a 404 counts as missing. Network failures, permissions/rate-limit errors, cancelled checks, and deferred checks remain **Not checked**. A README presence check does not verify its content.

### Request limits and partial scans

GitHub normally permits 60 unauthenticated requests per hour per public IP, shared with other users and applications on that IP. DocDrift uses at most 50 requests per audit operation, pauses on 403/429 or exhausted quota, and respects rate-reset/retry headers. It does not automatically retry a throttled request.

Discovery runs before README checks. Large accounts may use an entire operation budget discovering repositories; **Continue scan** resumes at the saved page, then checks any unchecked repositories. Scans cannot bypass GitHub's hourly limit. Completed results remain exportable even if a scan stops early.

Results are snapshots and can become stale. Scan results are saved in `sessionStorage`, with a memory fallback when browser storage is unavailable. Closing the tab ends the stored session. Detailed analysis has a separate in-memory cache; **Refresh analysis** bypasses it. No results leave the browser except requests to GitHub and downloads you initiate.

## README Analyzer

Paste a public repository URL such as `https://github.com/owner/project`.

- Keep a plain text README preview without executing embedded markup.
- Receive optional suggestions for descriptions, installation, usage, technology/requirements, contribution guidance, and helpful resource links.
- Compare root `package.json` scripts with documented npm, Yarn, and pnpm script commands, removing duplicates.
- Check relative Markdown links/images and simple Python installation file references against repository contents.
- Detect common Python project files: `requirements.txt`, `pyproject.toml`, and `setup.py`.
- See each finding's severity, cause, suggested correction, and repository link.

For example, a documented `npm run start` becomes a confirmed mismatch if the root `package.json` was successfully read but contains no `start` script. A failed manifest request produces a warning instead.

### Analysis limits

This is rule-based, static analysis, not full verification. Sections are suggestions, not mandatory requirements. Heuristics may miss alternative wording. Script comparisons assume the root package on the default branch. Known package-manager built-ins, npm lifecycle defaults, optional scripts, workspace/directory flags, and detected shell directory changes are excluded to reduce false positives. Complex shell commands, monorepo package selection, and arbitrary command execution are not supported.

Detailed analysis checks at most 20 file paths, plus the README request. Unchecked paths are explicitly reported. Local Markdown paths are resolved relative to the README. Python installation file paths assume commands run from the checkout root. Python checks only verify local file references; they do not validate package installation, dependency resolution, arbitrary commands, or runtime behavior. Other ecosystems/frameworks are **not supported by this analyzer**. HTTP failures never become confirmed file mismatches.

Content findings are included in audit exports only after that repository has been analyzed. CSV fields are quoted and spreadsheet formula prefixes are neutralized.

## Development

Use a Node.js version supported by Vite 8 (Node 20.19+ or 22.12+) and npm.

```bash
npm install
npm run dev
```

Validate before committing:

```bash
npm test
npm run lint
npm run build
```

Tests use Node's built-in test runner and the existing TypeScript compiler; no additional dependencies are required. GitHub calls are mocked to cover pagination, concurrency, partial scans, cancellation, rate limiting, command detection, file references, and report serialization without consuming API quota.

## Source layout

- `src/services/github.ts`: public API client, URL validation, and cooldown handling.
- `src/services/audit.ts`: pagination, session caching, and controlled README checks.
- `src/services/analyze.ts`: bounded detailed analysis and cache.
- `src/utils/readmeAnalyzer.ts`: pure documentation/command/file rules.
- `src/utils/exportReport.ts`: browser downloads and report serialization.
- `src/components/`: audit dashboard, README results, findings, and repository cards.

No repositories are modified automatically. Review findings in GitHub and make any desired changes yourself.
