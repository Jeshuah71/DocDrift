export type Severity = 'info' | 'warning' | 'mismatch';
export type Finding = {
  id: string;
  severity: Severity;
  problem: string;
  cause: string;
  recommendation: string;
  url: string;
};
export type Repository = {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  owner: {
    login: string;
  };
  default_branch: string;
  archived?: boolean;
  hasReadme: boolean | null;
  checkError?: string;
  findings: Finding[];
  analysis?: {
    analyzedAt: string;
    summary: string;
  };
};
export type Scan = {
  username: string;
  repos: Repository[];
  nextPage: number | null;
  updatedAt: string;
  message: string;
};
export type ReadmeDocument = {
  content: string;
  path: string;
  sha: string;
};
