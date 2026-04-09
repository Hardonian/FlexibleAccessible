// Integration types for Jira, GitHub, and Slack

export const API_VERSIONS = ['3'] as const;

/**
 * Jira client configuration
 */
export interface JiraClientConfig {
  baseUrl: string;    // e.g., https://your-domain.atlassian.net
  email: string;       // Your Jira email
  apiToken: string;    // API token from id.atlassian.com
  projectKey: string;  // Target project key
}

/**
 * Jira issue response
 */
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: any;
    issuetype: { name: string };
    priority?: { name: string };
    status: { name: string };
    labels: string[];
    created: string;
    updated: string;
  };
  self: string;
}

/**
 * Payload for creating a new issue
 */
export interface CreateIssuePayload {
  title: string;
  description: string;
  details: Array<{ label: string; value: string }>;
  issueType?: 'Bug' | 'Task' | 'Story';
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  assignee?: string;
  url?: string;
  wcagCriteria?: string[];
}

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string; // GitHub personal access token
}

/**
 * GitHub issue payload
 */
export interface CreateGitHubIssuePayload {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

/**
 * GitHub issue response
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string }>;
  html_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Slack configuration
 */
export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

/**
 * Slack message payload
 */
export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

/**
 * Slack block for rich formatting
 */
export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: any[];
  accessory?: any;
}

/**
 * Slack attachment for color-coded sections
 */
export interface SlackAttachment {
  color: string; // hex color like '#ff0000'
  title: string;
  text: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  footer?: string;
  ts?: number;
}

/**
 * Accessibility finding for integrations
 */
export interface AccessibilityFinding {
  id: string;
  url: string;
  element?: string;
  wcagCriteria: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  impact: string;
  timestamp: string;
}

/**
 * Batch result for integrations
 */
export interface IntegrationResult {
  success: boolean;
  created: number;
  failed: number;
  errors: string[];
}
