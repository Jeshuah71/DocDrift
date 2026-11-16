import { useState } from "react";
import RepositoryCard from "./components/RepositoryCard";
import "./App.css";

type GitHubRepository = {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  hasReadme?: boolean | null;
};

function parseRepositoryUrl(value: string) {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" || url.hostname !== "github.com") {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length !== 2) {
      return null;
    }

    return {
      owner: parts[0],
      repo: parts[1],
    };
  } catch {
    return null;
  }
}

function findMissingScripts(
  readme: string,
  scripts: Record<string, string>
): string[] {

  const commands = [
    ...readme.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)
  ].map((match) => match[1]);

  const uniqueCommands = [...new Set(commands)];

  return uniqueCommands.filter(
    (command) => !Object.hasOwn(scripts, command)
  );
}

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState("audit");
  const [repos, setRepos] = useState<GitHubRepository[]>([]);

  const totalRepos = repos.length;

  const documentRepos = repos.filter(
    (repo) => repo.hasReadme === true
  ).length;

  const missingReadmes = repos.filter(
    (repo) => repo.hasReadme === false
  ).length;

  const [filter, setFilter] = useState("all");

  const filteredRepos = repos.filter((repo) => {
    if (filter === "missing") {
      return repo.hasReadme === false;
    }

    if (filter === "documented") {
      return repo.hasReadme === true;
    }

    return true;
  });

  const [repoUrl, setRepoUrl] = useState("");

  const [readmeContent, setReadmeContent] = useState("");
  const [readmeError, setReadmeError] = useState("");

  const [missingScripts, setMissingScript] = useState<string[] | null>(null);

  const [packageStatus, setPackageStatus] = useState<
    "idle" | "ready" | "missing" | "error"
  >("idle");
  async function handleReadmeSearch() {
    if (isLoading) return;
    setIsLoading(true);

    const repository = parseRepositoryUrl(repoUrl);

    if (!repository) {
      setReadmeError("Please enter a valid GitHub repository URL.");
      setReadmeContent("");
      setIsLoading(false);
      return;

    }

    setReadmeError("");
    setReadmeContent("");
    setPackageStatus("idle");
    setMissingScript(null);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/readme`,
        {
          headers: {
            Accept: "Application/vnd.github.raw+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`README request failed: ${response.status}`);
      }

      const content = await response.text();

      setReadmeContent(content);

      const packageResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/contents/package.json`,
        {
          headers: {
            Accept: "application/vnd.github.raw+json",
          },
        }
      );

      if (packageResponse.status === 404) {
        setPackageStatus("missing");
      } else if (!packageResponse.ok) {
        setPackageStatus("error");
      } else {
        const packageJson = JSON.parse(await packageResponse.text());

        const missing = findMissingScripts(
          content,
          packageJson.scripts ?? {}
        );
        setMissingScript(missing);
        setPackageStatus("ready");

      }
      console.log("README retrieved successfully");
    } catch (error) {
      setReadmeError(
        error instanceof Error ? error.message : "Unexpected error"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function checkReadme(
    owner: string,
    repo: string
  ): Promise<boolean | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`
      );

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        console.warn(`Could not check ${repo}: ${response.status}`);
        return null;
      }

      return true;
    } catch (error) {
      console.error("README check failed", error);
      return null;
    }
  }

  async function handleSearch() {
    if (isLoading) return;

    if (!username.trim()) {
      alert("Please enter a GitHub username");
      return;
    }

    setHasSearched(false);
    setRepos([]);
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username.trim())}/repos?per_page=20&sort=updated`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }

      const data: GitHubRepository[] = await response.json();

      const checkedRepos = await Promise.all(
        data.map(async (repo) => ({
          ...repo,
          hasReadme: await checkReadme(username.trim(), repo.name),
        }))
      );

      setRepos(checkedRepos);
      setHasSearched(true);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app">
      <header>
        <h1>DocDrift</h1>
        <p>Keep your GitHub repositories documented.</p>
      </header>

      <section className="dashboard">
        <div className="tabs">
          <button
            className={activeTab === "audit" ? "active" : ""}
            onClick={() => setActiveTab("audit")}
          >
            Repository Audit
          </button>

          <button
            className={activeTab === "readme" ? "active" : ""}
            onClick={() => setActiveTab("readme")}
          >
            README Analyzer
          </button>
        </div>

        <h2>
          {activeTab === "audit"
            ? "Analyze your GitHub repositories"
            : "Check your README documentation"}
        </h2>

        <input
          type="text"
          placeholder={
            activeTab === "audit"
              ? "Enter GitHub username"
              : "Enter GitHub repository URL"
          }

          value={activeTab === "audit" ? username : repoUrl}

          onChange={(e) =>
            activeTab === "audit"
              ? setUsername(e.target.value)
              : setRepoUrl(e.target.value)
          }
        />

        <button
          onClick={
            activeTab === "audit"
              ? handleSearch
              : handleReadmeSearch
          }
          disabled={isLoading}
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </button>

        {activeTab === "readme" && (
          <div className="readme-result">
            {readmeError && <p role="alert">{readmeError}</p>}

            {readmeContent && (
              <>
                <h3>README Content Preview</h3>
                <pre>{readmeContent.slice(0, 15000)}</pre>
              </>
            )}

            {missingScripts !== null && (
              <div className="analysis-results">
                <h3>Analysis Results</h3>

                {missingScripts.length === 0 ? (
                  <p>No missing npm scripts detected.</p>
                ) : (
                  <ul>
                    {missingScripts.map((script) => (
                      <li key={script}>
                        Missing script: {script}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {packageStatus === "missing" && (
              <p>
                No root package.json found.
                npm script analysis is not available
              </p>
            )}

            {packageStatus === "error" && (
              <p>
                Could not retrieve package.json.
                Please ty again.
              </p>
            )}
          </div>
        )}

        {activeTab === "audit" && !hasSearched && (
          <div className="empty-state">
            <div className="empty-state-icon">⌕</div>

            <h3>
              {isLoading
                ? "Scanning repositories..."
                : "Ready to audit your repositories?"}
            </h3>

            <p>
              {isLoading
                ? "Checking your public GitHub repositories."
                : "Enter a GitHub username above to scan public repositories and discover missing README files."}
            </p>

            <span>No GitHub login required</span>
          </div>
        )}

        {activeTab === "audit" && hasSearched && (
          <>
            <div className="stats">
              <div className="stat-card">
                <h3>{totalRepos}</h3>
                <p>Repositories Scanned</p>
              </div>

              <div className="stat-card">
                <h3>{documentRepos}</h3>
                <p>With README</p>
              </div>

              <div className="stat-card">
                <h3>{missingReadmes}</h3>
                <p>Missing README</p>
              </div>

            </div>

            <div className="filters">
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All
              </button>

              <button
                className={filter === "missing" ? "active" : ""}
                onClick={() => setFilter("missing")}
              >
                Missing README
              </button>

              <button
                className={filter === "documented" ? "active" : ""}
                onClick={() => setFilter("documented")}
              >
                Documented
              </button>
            </div>

            <div className="repository-list">
              {filteredRepos.map((repo) => (
                <RepositoryCard
                  key={repo.id}
                  name={repo.name}
                  description={repo.description ?? "No description provided"}
                  hasReadme={repo.hasReadme ?? null}
                  url={repo.html_url}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
