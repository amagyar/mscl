export interface RemoteInfo {
  host: string;
  owner: string;
  repo: string;
}

export function parseRemoteUrl(url: string): RemoteInfo | null {
  let host: string;
  let path: string;

  if (url.startsWith("git@")) {
    const match = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (!match) return null;
    host = match[1];
    path = match[2];
  } else if (url.startsWith("https://") || url.startsWith("http://")) {
    const urlObj = new URL(url);
    host = urlObj.host;
    path = urlObj.pathname.slice(1).replace(/\.git$/, "");
  } else {
    return null;
  }

  const [owner, ...repoParts] = path.split("/");
  const repo = repoParts.join("/");

  if (!owner || !repo) return null;

  return { host, owner, repo };
}

export function buildCommitUrl(remote: RemoteInfo, hash: string): string {
  const prefix = isGitLab(remote) ? "-/" : "";
  return `${getBaseUrl(remote)}/${prefix}commit/${hash}`;
}

export function buildIssueUrl(remote: RemoteInfo, issue: string): string {
  const prefix = isGitLab(remote) ? "-/" : "";
  return `${getBaseUrl(remote)}/${prefix}issues/${issue}`;
}

export function buildPullRequestUrl(remote: RemoteInfo, pr: string): string {
  const path = isGitLab(remote) ? "-/merge_requests" : "pull";
  return `${getBaseUrl(remote)}/${path}/${pr}`;
}

export function buildCompareUrl(remote: RemoteInfo, base: string, head: string): string {
  const path = isGitLab(remote) ? "-/compare" : "compare";
  return `${getBaseUrl(remote)}/${path}/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
}

export function buildReleaseUrl(remote: RemoteInfo, tag: string): string {
  const path = isGitLab(remote) ? "-/tags" : "releases/tag";
  return `${getBaseUrl(remote)}/${path}/${encodeURIComponent(tag)}`;
}

function getBaseUrl(remote: RemoteInfo): string {
  const encodedPath = [remote.owner, ...remote.repo.split("/")].map(encodeURIComponent).join("/");
  return `https://${remote.host}/${encodedPath}`;
}

function isGitLab(remote: RemoteInfo): boolean {
  return remote.host === "gitlab.com" || remote.host.toLowerCase().includes("gitlab");
}
