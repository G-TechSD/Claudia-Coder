/**
 * Claude Code Integration Library
 *
 * Provides utilities for integrating with Claude Code CLI,
 * including sub-agent tracking and terminal output parsing.
 */

// Sub-agent tracking
export {
  createSubAgent,
  updateSubAgentStatus,
  getSubAgents,
  getSubAgent,
  getSubAgentsByStatus,
  getActiveSubAgentCount,
  getCompletedSubAgentCount,
  getFailedSubAgentCount,
  clearSubAgents,
  removeSubAgent,
  serializeSubAgent,
  deserializeSubAgent,
  getSubAgentStats,
  type SubAgent,
  type SubAgentSerialized,
  type SubAgentStatus
} from "./sub-agents"

// Output parsing
export {
  stripAnsi,
  createParserState,
  parseOutputChunk,
  parseToolInvocation,
  parseFullOutput,
  createStreamingParser,
  type ParsedEvent,
  type ParserState
} from "./output-parser"
