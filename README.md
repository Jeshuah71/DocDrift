# DocDrift

**Find missing documentation. Detect outdated commands. Keep your GitHub repositories documented.**

DocDrift is an open-source web application that helps developers identify missing README files and potential inconsistencies between project documentation and configuration.

As projects evolve, documentation can easily fall behind. DocDrift provides a simple way to review repository documentation and identify issues worth fixing.

Built with **React, TypeScript, Vite, and the GitHub REST API**.

## Features

### 1. Repository Health Audit

Enter a GitHub username to analyze public repositories and identify missing README files.

- Scan up to 20 recently updated public repositories.
- Detect repositories with and without README documentation.
- View a summary of scanned repositories.
- Filter results by documentation status.
- Open repositories directly on GitHub to make improvements.

### 2. README Analyzer

Paste a public GitHub repository URL to inspect its documentation.

- Retrieve and preview the repository's README.
- Read npm scripts from its root `package.json`.
- Identify `npm run` commands referenced in the README that are not defined in `package.json`.
- Display detected inconsistencies.
- Handle repositories without a root `package.json`.

### 3. Responsive Interface

- Clean, mobile-friendly design.
- Simple navigation between analysis modes.
- Loading indicators and error messages.
- No GitHub login required.

## How It Works

**Repository Audit**

1. Enter a GitHub username.
2. DocDrift retrieves public repositories using the GitHub API.
3. Each repository is checked for README documentation.
4. Results are displayed with documentation status and filtering options.

**README Analyzer**

1. Paste a GitHub repository URL.
2. DocDrift retrieves its README and root `package.json`, when available.
3. It extracts `npm run` commands from the README.
4. It compares those commands against the scripts defined in `package.json`.
5. Any unmatched commands are reported.

For example, if a README contains:

```bash
npm run start
```

But `package.json` defines only:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

DocDrift identifies `start` as a missing script.

## Tech Stack

| Technology | Purpose |
|---|---|
| React | User interface |
| TypeScript | Type-safe application logic |
| Vite | Development and build tooling |
| GitHub REST API | Repository and documentation retrieval |
| CSS | Responsive interface and styling |

## Getting Started

**Prerequisites:** Node.js and npm.

Clone the repository:

```bash
git clone https://github.com/Jeshuah71/DocDrift.git
cd DocDrift
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash