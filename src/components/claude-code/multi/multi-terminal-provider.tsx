"use client"

import React, { createContext, useContext, useEffect, useCallback } from 'react'
import { useMultiTerminalState } from '@/hooks/useMultiTerminalState'
import {
  MultiTerminalContextValue,
  BroadcastMessage
} from '@/lib/multi-terminal/types'
import {
  subscribeToBroadcast,
  openPopOutWindow,
  closePopOutWindow,
  cleanup as cleanupWindowManager
} from '@/lib/multi-terminal/window-manager'

const MultiTerminalContext = createContext<MultiTerminalContextValue | null>(null)

interface MultiTerminalProviderProps {
  children: React.ReactNode
}

export function MultiTerminalProvider({ children }: MultiTerminalProviderProps) {
  const state = useMultiTerminalState()

  // Handle pop-out with window manager
  const handlePopOut = useCallback((terminalId: string) => {
    const windowRef = openPopOutWindow(terminalId)
    if (windowRef) {
      state.popOut(terminalId)
    }
  }, [state])

  // Handle pop-in
  const handlePopIn = useCallback((terminalId: string) => {
    closePopOutWindow(terminalId)
    state.popIn(terminalId)
  }, [state])

  // Listen for broadcast messages from pop-out windows
  useEffect(() => {
    const unsubscribe = subscribeToBroadcast((message: BroadcastMessage) => {
      switch (message.type) {
        case 'pop-in-request':
          handlePopIn(message.terminalId)
          break

        case 'window-closed':
          state.popIn(message.terminalId)
          break

        case 'session-status-change':
          if (message.payload && typeof message.payload === 'object' && 'status' in message.payload) {
            state.updateStatus(message.terminalId, message.payload.status as any)
          }
          break

        case 'sync-layout':
          // Pop-out windows requesting layout sync
          // This is handled by the pop-out page reading from localStorage
          break

        default:
          break
      }
    })

    return () => {
      unsubscribe()
    }
  }, [handlePopIn, state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupWindowManager()
    }
  }, [])

  const contextValue: MultiTerminalContextValue = {
    layout: state.layout,
    dispatch: state.dispatch,
    terminals: state.terminals,
    groups: state.groups,
    gridColumns: state.gridColumns,
    addTerminal: state.addTerminal,
    removeTerminal: state.removeTerminal,
    updateStatus: state.updateStatus,
    updateProject: state.updateProject,
    toggleCollapse: state.toggleCollapse,
    popOut: handlePopOut,
    popIn: handlePopIn,
    createGroup: state.createGroup,
    deleteGroup: state.deleteGroup,
    moveToGroup: state.moveToGroup,
    setGridColumns: state.setGridColumns
  }

  return (
    <MultiTerminalContext.Provider value={contextValue}>
      {children}
    </MultiTerminalContext.Provider>
  )
}

export function useMultiTerminal(): MultiTerminalContextValue {
  const context = useContext(MultiTerminalContext)
  if (!context) {
    throw new Error('useMultiTerminal must be used within a MultiTerminalProvider')
  }
  return context
}
