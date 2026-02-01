/**
 * Multi-Terminal State Management Hook
 * Uses useReducer for complex state with localStorage persistence
 */

import { useReducer, useCallback, useEffect, useRef } from 'react'
import {
  MultiTerminalLayout,
  MultiTerminalAction,
  MultiTerminalSession,
  TerminalGroup,
  TerminalStatus,
  DEFAULT_LAYOUT,
  MAX_TERMINALS
} from '@/lib/multi-terminal/types'
import { loadLayout, saveLayout, saveLayoutImmediate, generateId } from '@/lib/multi-terminal/storage'

/**
 * Reducer for multi-terminal state management
 */
function multiTerminalReducer(
  state: MultiTerminalLayout,
  action: MultiTerminalAction
): MultiTerminalLayout {
  switch (action.type) {
    case 'ADD_TERMINAL': {
      if (state.terminals.length >= MAX_TERMINALS) {
        console.warn(`[MultiTerminal] Maximum ${MAX_TERMINALS} terminals reached`)
        return state
      }

      const id = action.payload.id || generateId('term')
      const now = new Date().toISOString()

      const newTerminal: MultiTerminalSession = {
        id,
        label: action.payload.label || `Terminal ${state.terminals.length + 1}`,
        projectId: action.payload.projectId || null,
        projectName: action.payload.projectName || 'Untitled',
        workingDirectory: action.payload.workingDirectory,
        groupId: null,
        isCollapsed: false,
        isPoppedOut: false,
        status: 'idle',
        createdAt: now,
        lastActiveAt: now,
        // Set tmuxSessionName if reconnecting to existing tmux session
        tmuxSessionName: action.payload.reconnectToTmux
      }

      return {
        ...state,
        terminals: [...state.terminals, newTerminal],
        ungroupedOrder: [...state.ungroupedOrder, id]
      }
    }

    case 'REMOVE_TERMINAL': {
      const { terminalId } = action.payload
      const terminal = state.terminals.find(t => t.id === terminalId)

      if (!terminal) return state

      // Remove from terminals array
      const terminals = state.terminals.filter(t => t.id !== terminalId)

      // Remove from ungrouped order
      const ungroupedOrder = state.ungroupedOrder.filter(id => id !== terminalId)

      // Remove from any group's terminal order
      const groups = state.groups.map(g => ({
        ...g,
        terminalOrder: g.terminalOrder.filter(id => id !== terminalId)
      }))

      return {
        ...state,
        terminals,
        groups,
        ungroupedOrder
      }
    }

    case 'UPDATE_LABEL': {
      const { terminalId, label } = action.payload
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId ? { ...t, label } : t
        )
      }
    }

    case 'UPDATE_STATUS': {
      const { terminalId, status } = action.payload
      const now = new Date().toISOString()
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId ? { ...t, status, lastActiveAt: now } : t
        )
      }
    }

    case 'UPDATE_PROJECT': {
      const { terminalId, projectId, projectName, workingDirectory } = action.payload
      const now = new Date().toISOString()
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId
            ? { ...t, projectId, projectName, workingDirectory, lastActiveAt: now }
            : t
        )
      }
    }

    case 'UPDATE_TMUX_SESSION': {
      const { terminalId, tmuxSessionName } = action.payload
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId
            ? { ...t, tmuxSessionName, useTmux: true }
            : t
        )
      }
    }

    case 'TOGGLE_COLLAPSE': {
      const { terminalId } = action.payload
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId ? { ...t, isCollapsed: !t.isCollapsed } : t
        )
      }
    }

    case 'COLLAPSE_ALL': {
      const { groupId } = action.payload || {}
      return {
        ...state,
        terminals: state.terminals.map(t => {
          if (groupId !== undefined) {
            return t.groupId === groupId ? { ...t, isCollapsed: true } : t
          }
          return { ...t, isCollapsed: true }
        })
      }
    }

    case 'EXPAND_ALL': {
      const { groupId } = action.payload || {}
      return {
        ...state,
        terminals: state.terminals.map(t => {
          if (groupId !== undefined) {
            return t.groupId === groupId ? { ...t, isCollapsed: false } : t
          }
          return { ...t, isCollapsed: false }
        })
      }
    }

    case 'POP_OUT': {
      const { terminalId } = action.payload
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId ? { ...t, isPoppedOut: true } : t
        )
      }
    }

    case 'POP_IN': {
      const { terminalId } = action.payload
      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId ? { ...t, isPoppedOut: false } : t
        )
      }
    }

    case 'CREATE_GROUP': {
      const { name, color } = action.payload
      const id = generateId('group')

      const newGroup: TerminalGroup = {
        id,
        name,
        color,
        isExpanded: true,
        terminalOrder: []
      }

      return {
        ...state,
        groups: [...state.groups, newGroup]
      }
    }

    case 'DELETE_GROUP': {
      const { groupId } = action.payload
      const group = state.groups.find(g => g.id === groupId)

      if (!group) return state

      // Move all terminals in this group to ungrouped
      const terminalsInGroup = state.terminals.filter(t => t.groupId === groupId)

      return {
        ...state,
        groups: state.groups.filter(g => g.id !== groupId),
        terminals: state.terminals.map(t =>
          t.groupId === groupId ? { ...t, groupId: null } : t
        ),
        ungroupedOrder: [
          ...state.ungroupedOrder,
          ...terminalsInGroup.map(t => t.id)
        ]
      }
    }

    case 'RENAME_GROUP': {
      const { groupId, name } = action.payload
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === groupId ? { ...g, name } : g
        )
      }
    }

    case 'TOGGLE_GROUP': {
      const { groupId } = action.payload
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
        )
      }
    }

    case 'MOVE_TO_GROUP': {
      const { terminalId, groupId } = action.payload
      const terminal = state.terminals.find(t => t.id === terminalId)

      if (!terminal) return state

      // Remove from old location
      let ungroupedOrder = state.ungroupedOrder.filter(id => id !== terminalId)
      let groups = state.groups.map(g => ({
        ...g,
        terminalOrder: g.terminalOrder.filter(id => id !== terminalId)
      }))

      // Add to new location
      if (groupId === null) {
        ungroupedOrder = [...ungroupedOrder, terminalId]
      } else {
        groups = groups.map(g =>
          g.id === groupId
            ? { ...g, terminalOrder: [...g.terminalOrder, terminalId] }
            : g
        )
      }

      return {
        ...state,
        terminals: state.terminals.map(t =>
          t.id === terminalId ? { ...t, groupId } : t
        ),
        groups,
        ungroupedOrder
      }
    }

    case 'REORDER': {
      const { terminalId, newIndex, groupId } = action.payload

      if (groupId === undefined || groupId === null) {
        // Reorder within ungrouped
        const currentIndex = state.ungroupedOrder.indexOf(terminalId)
        if (currentIndex === -1) return state

        const newOrder = [...state.ungroupedOrder]
        newOrder.splice(currentIndex, 1)
        newOrder.splice(newIndex, 0, terminalId)

        return {
          ...state,
          ungroupedOrder: newOrder
        }
      } else {
        // Reorder within a group
        const group = state.groups.find(g => g.id === groupId)
        if (!group) return state

        const currentIndex = group.terminalOrder.indexOf(terminalId)
        if (currentIndex === -1) return state

        const newOrder = [...group.terminalOrder]
        newOrder.splice(currentIndex, 1)
        newOrder.splice(newIndex, 0, terminalId)

        return {
          ...state,
          groups: state.groups.map(g =>
            g.id === groupId ? { ...g, terminalOrder: newOrder } : g
          )
        }
      }
    }

    case 'SET_GRID_COLUMNS': {
      return {
        ...state,
        gridColumns: action.payload.columns
      }
    }

    case 'LOAD_LAYOUT': {
      return action.payload
    }

    case 'CLEAR_ALL': {
      return DEFAULT_LAYOUT
    }

    default:
      return state
  }
}

/**
 * Hook for managing multi-terminal state
 */
export function useMultiTerminalState() {
  const [layout, dispatch] = useReducer(multiTerminalReducer, DEFAULT_LAYOUT)
  const isInitialized = useRef(false)

  // Load layout from localStorage on mount
  useEffect(() => {
    if (!isInitialized.current) {
      const savedLayout = loadLayout()
      dispatch({ type: 'LOAD_LAYOUT', payload: savedLayout })
      isInitialized.current = true
    }
  }, [])

  // Save layout to localStorage on changes (with debouncing)
  useEffect(() => {
    if (isInitialized.current) {
      saveLayout(layout)
    }
  }, [layout])

  // Save immediately on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveLayoutImmediate(layout)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [layout])

  // Convenience actions
  const addTerminal = useCallback((options: {
    projectId?: string
    projectName?: string
    workingDirectory: string
    label?: string
  }): string => {
    const id = generateId('term')
    dispatch({
      type: 'ADD_TERMINAL',
      payload: { ...options, id }
    })
    return id
  }, [])

  const removeTerminal = useCallback((terminalId: string) => {
    dispatch({ type: 'REMOVE_TERMINAL', payload: { terminalId } })
  }, [])

  const updateStatus = useCallback((terminalId: string, status: TerminalStatus) => {
    dispatch({ type: 'UPDATE_STATUS', payload: { terminalId, status } })
  }, [])

  const updateProject = useCallback((
    terminalId: string,
    projectId: string,
    projectName: string,
    workingDirectory: string
  ) => {
    dispatch({
      type: 'UPDATE_PROJECT',
      payload: { terminalId, projectId, projectName, workingDirectory }
    })
  }, [])

  const toggleCollapse = useCallback((terminalId: string) => {
    dispatch({ type: 'TOGGLE_COLLAPSE', payload: { terminalId } })
  }, [])

  const popOut = useCallback((terminalId: string) => {
    dispatch({ type: 'POP_OUT', payload: { terminalId } })
  }, [])

  const popIn = useCallback((terminalId: string) => {
    dispatch({ type: 'POP_IN', payload: { terminalId } })
  }, [])

  const createGroup = useCallback((name: string, color: string) => {
    dispatch({ type: 'CREATE_GROUP', payload: { name, color } })
  }, [])

  const deleteGroup = useCallback((groupId: string) => {
    dispatch({ type: 'DELETE_GROUP', payload: { groupId } })
  }, [])

  const moveToGroup = useCallback((terminalId: string, groupId: string | null) => {
    dispatch({ type: 'MOVE_TO_GROUP', payload: { terminalId, groupId } })
  }, [])

  const setGridColumns = useCallback((columns: 1 | 2 | 3 | 4) => {
    dispatch({ type: 'SET_GRID_COLUMNS', payload: { columns } })
  }, [])

  return {
    layout,
    dispatch,
    // Convenience getters
    terminals: layout.terminals,
    groups: layout.groups,
    gridColumns: layout.gridColumns,
    // Convenience actions
    addTerminal,
    removeTerminal,
    updateStatus,
    updateProject,
    toggleCollapse,
    popOut,
    popIn,
    createGroup,
    deleteGroup,
    moveToGroup,
    setGridColumns
  }
}
