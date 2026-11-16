type RepositoryCardProps = {
  name: string;
  description: string;
  hasReadme: boolean | null;
  url: string;
};

function RepositoryCard({
  name,
  description,
  hasReadme,
  url,
}: RepositoryCardProps) {
  return (
    <div className="repository-card">
      <h3>{name}</h3>
      <p>{description}</p>

      <span>
        {hasReadme === null
          ? "Not checked"
          : hasReadme
            ? "README Found"
            : "Missing README"}
      </span>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on GitHub
      </a>
    </div>
  );
}

export default RepositoryCard;