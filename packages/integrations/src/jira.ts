// Package jira provides Jira integration for creating issues from accessibility scans.
import { API_VERSIONS, type JiraClientConfig, type JiraIssue, type CreateIssuePayload } from './types';

/**
 * Create a Jira issue from an accessibility finding
 */
export async function createIssue(
  config: JiraClientConfig,
  payload: CreateIssuePayload
): Promise<JiraIssue> {
  const { baseUrl, email, apiToken, projectKey } = config;
  
  const issueData = {
    fields: {
      project: { key: projectKey },
      summary: `[Accessibility] ${payload.title}`,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: payload.description }
            ]
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '**Details:**' }
            ]
          },
          ...payload.details.map(d => ({
            type: 'paragraph',
            content: [
              { type: 'text', text: `- ${d.label}: ${d.value}` }
            ]
          }))
        ]
      },
      issuetype: { name: payload.issueType || 'Bug' },
      priority: { name: payload.priority || 'Medium' },
      labels: ['accessibility', 'a11y', 'wcag'],
      ...(payload.assignee && { assignee: { name: payload.assignee } })
    }
  };

  const response = await fetch(`${baseUrl}/rest/api/${API_VERSIONS[0]}/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(issueData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Jira issue: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Search for existing issues related to a URL
 */
export async function findRelatedIssues(
  config: JiraClientConfig,
  url: string
): Promise<JiraIssue[]> {
  const { baseUrl, email, apiToken } = config;
  
  const jql = encodeURIComponent(
    `project = ${config.projectKey} AND labels = accessibility AND text ~ "${url}"`
  );

  const response = await fetch(
    `${baseUrl}/rest/api/${API_VERSIONS[0]}/search?jql=${jql}&maxResults=10`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search Jira: ${response.status}`);
  }

  const data = await response.json();
  return data.issues || [];
}

/**
 * Add a comment to an existing issue
 */
export async function addComment(
  config: JiraClientConfig,
  issueKey: string,
  comment: string
): Promise<void> {
  const { baseUrl, email, apiToken } = config;

  const response = await fetch(
    `${baseUrl}/rest/api/${API_VERSIONS[0]}/issue/${issueKey}/comment`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to add comment: ${response.status}`);
  }
}
