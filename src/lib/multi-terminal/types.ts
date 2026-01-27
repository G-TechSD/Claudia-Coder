/**
 * Multi-Terminal Dashboard Types
 * Supports up to 16 concurrent Claude Code terminal sessions
 */

export type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'

export interface MultiTerminalSession {
  id: string
  label: string
  projectId: string | null
  projectName: string
  workingDirectory: string
  groupId: string | null
  isCollapsed: boolean
  isPoppedOut: boolean
  status: TerminalStatus
  createdAt: string
  lastActiveAt: string
  // Tmux session persistence
  useTmux?: boolean
  tmuxSessionName?: string
}

export interface TerminalGroup {
  id: string
  name: string
  color: string  // Tailwind color class (e.g., 'blue', 'green', 'purple')
  isExpanded: boolean
  terminalOrder: string[]  // Ordered terminal IDs within this group
}

export interface MultiTerminalLayout {
  version: 1
  gridColumns: 1 | 2 | 3 | 4
  terminals: MultiTerminalSession[]
  groups: TerminalGroup[]
  ungroupedOrder: string[]  // Ordered terminal IDs not in any group
}

// State management types
export type MultiTerminalAction =
  | { type: 'ADD_TERMINAL'; payload: { id?: string; projectId?: string; projectName?: string; workingDirectory: string; label?: string } }
  | { type: 'REMOVE_TERMINAL'; payload: { terminalId: string } }
  | { type: 'UPDATE_LABEL'; payload: { terminalId: string; label: string } }
  | { type: 'UPDATE_STATUS'; payload: { terminalId: string; status: TerminalStatus } }
  | { type: 'UPDATE_PROJECT'; payload: { terminalId: string; projectId: string; projectName: string; workingDirectory: string } }
  | { type: 'UPDATE_TMUX_SESSION'; payload: { terminalId: string; tmuxSessionName: string } }
  | { type: 'TOGGLE_COLLAPSE'; payload: { terminalId: string } }
  | { type: 'COLLAPSE_ALL'; payload?: { groupId?: string } }
  | { type: 'EXPAND_ALL'; payload?: { groupId?: string } }
  | { type: 'POP_OUT'; payload: { terminalId: string } }
  | { type: 'POP_IN'; payload: { terminalId: string } }
  | { type: 'CREATE_GROUP'; payload: { name: string; color: string } }
  | { type: 'DELETE_GROUP'; payload: { groupId: string } }
  | { type: 'RENAME_GROUP'; payload: { groupId: string; name: string } }
  | { type: 'TOGGLE_GROUP'; payload: { groupId: string } }
  | { type: 'MOVE_TO_GROUP'; payload: { terminalId: string; groupId: string | null } }
  | { type: 'REORDER'; payload: { terminalId: string; newIndex: number; groupId?: string | null } }
  | { type: 'SET_GRID_COLUMNS'; payload: { columns: 1 | 2 | 3 | 4 } }
  | { type: 'LOAD_LAYOUT'; payload: MultiTerminalLayout }
  | { type: 'CLEAR_ALL' }

// Context types
export interface MultiTerminalContextValue {
  layout: MultiTerminalLayout
  dispatch: React.Dispatch<MultiTerminalAction>
  // Convenience getters
  terminals: MultiTerminalSession[]
  groups: TerminalGroup[]
  gridColumns: 1 | 2 | 3 | 4
  // Convenience actions
  addTerminal: (options: { projectId?: string; projectName?: string; workingDirectory: string; label?: string }) => string
  removeTerminal: (terminalId: string) => void
  updateStatus: (terminalId: string, status: TerminalStatus) => void
  updateProject: (terminalId: string, projectId: string, projectName: string, workingDirectory: string) => void
  toggleCollapse: (terminalId: string) => void
  popOut: (terminalId: string) => void
  popIn: (terminalId: string) => void
  createGroup: (name: string, color: string) => void
  deleteGroup: (groupId: string) => void
  moveToGroup: (terminalId: string, groupId: string | null) => void
  setGridColumns: (columns: 1 | 2 | 3 | 4) => void
}

// BroadcastChannel message types for cross-window communication
export type BroadcastMessageType =
  | 'session-update'
  | 'pop-in-request'
  | 'window-closed'
  | 'session-status-change'
  | 'sync-layout'

export interface BroadcastMessage {
  type: BroadcastMessageType
  terminalId: string
  payload?: unknown
  timestamp: number
}

// Pop-out window tracking
export interface PoppedOutWindow {
  terminalId: string
  windowRef: Window | null
  openedAt: string
}

// Default layout
export const DEFAULT_LAYOUT: MultiTerminalLayout = {
  version: 1,
  gridColumns: 2,
  terminals: [],
  groups: [],
  ungroupedOrder: []
}

// Available group colors
export const GROUP_COLORS = [
  'blue',
  'green',
  'purple',
  'orange',
  'pink',
  'cyan',
  'yellow',
  'red'
] as const

export type GroupColor = typeof GROUP_COLORS[number]

// Maximum terminals allowed
export const MAX_TERMINALS = 16

// Terminal tile heights
export const TILE_COLLAPSED_HEIGHT = 48
export const TILE_EXPANDED_MIN_HEIGHT = 300
