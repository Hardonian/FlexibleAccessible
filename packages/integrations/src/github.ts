export interface PRInput {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
  title: string;
  body: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface PRResult {
  success: boolean;
  prUrl?: string;
  error?: string;
}

/**
 * Creates a GitHub pull request with the suggested fix files.
 * Uses the GitHub REST API directly.
 */
export async function createGitHubPR(input: PRInput): Promise<PRResult> {
  const { token, owner, repo, baseBranch, title, body, files } = input;
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    // 1. Get base branch SHA
    const refResponse = await fetch(`${apiBase}/git/ref/heads/${baseBranch}`, { headers });
    if (!refResponse.ok) {
      return { success: false, error: `Failed to get base branch: ${refResponse.status}` };
    }
    const refData = (await refResponse.json()) as { object?: { sha?: string } };
    const baseSha = refData.object?.sha;
    if (!baseSha) {
      return { success: false, error: 'Invalid ref response from GitHub' };
    }

    // 2. Create blobs for each file
    const blobs = [];
    for (const file of files) {
      const blobResponse = await fetch(`${apiBase}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
      });
      const blobData = (await blobResponse.json()) as { sha?: string };
      if (!blobData.sha) {
        return { success: false, error: `Failed to create blob for ${file.path}` };
      }
      blobs.push({ path: file.path, sha: blobData.sha, mode: '100644', type: 'blob' });
    }

    // 3. Create tree
    const treeResponse = await fetch(`${apiBase}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base_tree: baseSha, tree: blobs }),
    });
    const treeData = (await treeResponse.json()) as { sha?: string };
    if (!treeData.sha) {
      return { success: false, error: 'Failed to create git tree' };
    }

    // 4. Create commit
    const branchName = `aros/fix-${Date.now()}`;
    const commitResponse = await fetch(`${apiBase}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: title,
        tree: treeData.sha,
        parents: [baseSha],
      }),
    });
    const commitData = (await commitResponse.json()) as { sha?: string };
    if (!commitData.sha) {
      return { success: false, error: 'Failed to create commit' };
    }

    // 5. Create branch
    await fetch(`${apiBase}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commitData.sha }),
    });

    // 6. Create PR
    const prResponse = await fetch(`${apiBase}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: baseBranch,
      }),
    });
    const prData = (await prResponse.json()) as { html_url?: string };
    if (!prData.html_url) {
      return { success: false, error: 'Pull request created but response missing URL' };
    }

    return { success: true, prUrl: prData.html_url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
