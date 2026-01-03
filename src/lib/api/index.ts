export { n8nApi } from "./n8n"
export type { N8NWebhookPayload, N8NWorkflow, N8NExecution } from "./n8n"

export { gitlabApi } from "./gitlab"
export type {
  GitLabProject,
  GitLabCommit,
  GitLabBranch,
  GitLabTreeItem,
  GitLabMergeRequest,
  GitLabPipeline
} from "./gitlab"

export {
  // n8n hooks
  useGitAction,
  usePacketAction,
  useAgentControl,
  useN8NHealth,
  useWorkflows,
  // GitLab hooks
  useGitLabProjects,
  useGitLabCommits,
  useGitLabBranches,
  useGitLabTree,
  useGitLabMergeRequests,
  useGitLabPipelines
} from "./hooks"
