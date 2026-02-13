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
    host = urlObj.hostname;
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
  return `https://${remote.host}/${remote.owner}/${remote.repo}/commit/${hash}`;
}

export function buildIssueUrl(remote: RemoteInfo, issue: string): string {
  return `https://${remote.host}/${remote.owner}/${remote.repo}/issues/${issue}`;
}

export function buildPullRequestUrl(remote: RemoteInfo, pr: string): string {
  return `https://${remote.host}/${remote.owner}/${remote.repo}/pull/${pr}`;
}
