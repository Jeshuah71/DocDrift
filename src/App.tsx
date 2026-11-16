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

function App() {
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

  async function handleReadmeSearch() {
    const repository = parseRepositoryUrl(repoUrl);

    if (!repository) {
      setReadmeError("Please enter a valid GitHub repository URL.");
      setReadmeContent("");
      return;
      
    }

    setReadmeError("");
    setReadmeContent("");

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
        `https://api.github/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/contents/package.json`,
        {
          headers: {
            Accept: "application/vnd.github.raw.json",
          },
        }
      );

      if (packageResponse.status === 404) {
        console.log("No root package.json found");
      } else if (!packageResponse.ok) {
        console.error("Failed to fetch package.json");
      } else {
        const packageJson = JSON.parse (await packageResponse.text());

        console.log("Available sripts:", [packageJson.scripts ?? {}]);
      }
      console.log("README retrieved successfully");
    } catch (error) {
      setReadmeError(
        error instanceof Error ? error.message : "Unexpected error"
      );
    }
  }


  async function checkReadme(
    owner: string,
    repo: string
  ) : Promise<boolean | null> {
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
    if (!username.trim()) {
      alert("Please enter a GitHub username");
      return;
    }

    try {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username.trim())}/repos?per_page=5&sort=updated`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }

      const data: GitHubRepository[] = await response.json();

      setRepos(data);
      
      const checkedRepos = await Promise.all(
        data.map(async (repo) => ({
          ...repo,
          hasReadme: await checkReadme(username.trim(), repo.name),
        }))
      );

      setRepos(checkedRepos)
    } catch (error) {
      console.error("Error:", error);
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
          <button onClick={() => setActiveTab("audit")}>
            Repository Audit
          </button>

          <button onClick={() => setActiveTab("readme")}>
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
        >
          Analyze
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
          </div>
        )}
        <div className="stats">
          <div className="stat-card">
            <h3>{totalRepos}</h3>
            <p>Repositories Scanned</p>
          </div>
            
          <div className="stat-card">
            <h3>{documentRepos}</h3>
            <p>README</p>
          </div>

          <div className="stat-card">
            <h3>{missingReadmes}</h3>
            <p>Missing README</p>
          </div>

        </div>

        <div className="filters">
          <button onClick={() => setFilter("all")}>
            All
          </button>

          <button onClick={() => setFilter("missing")}>
            Missing README
          </button>

          <button onClick={() => setFilter("documented")}>
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
      </section>
    </main>
  );
}

export default App;