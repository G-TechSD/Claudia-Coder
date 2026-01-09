export { n8nApi, N8NApiService } from "./n8n"
export type { N8NWebhookPayload, N8NWorkflow, N8NExecution, UserN8NCredentials } from "./n8n"

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
  // n8n hooks (global/shared instance)
  useGitAction,
  usePacketAction,
  useAgentControl,
  useN8NHealth,
  useWorkflows,
  // n8n hooks (user-specific with isolation)
  useUserWorkflows,
  useUserExecutions,
  useUserN8NConfig,
  // GitLab hooks
  useGitLabProjects,
  useGitLabCommits,
  useGitLabBranches,
  useGitLabTree,
  useGitLabMergeRequests,
  useGitLabPipelines
} from "./hooks"
