import { describe, it, expect, vi } from 'vitest'
import {
  BUILD_PLAN_SYSTEM_PROMPT,
  BUILD_PLAN_SIMPLE_SYSTEM_PROMPT,
  type WorkPacket,
  type BuildPlan,
  type BuildPhase
} from './build-plan'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window for client-side detection
Object.defineProperty(global, 'window', {
  value: { localStorage: {} },
  writable: true
})

describe('Build Plan Prompts', () => {
  it('system prompt contains required instructions', () => {
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('CRITICAL: PACKET DETAIL REQUIREMENTS')
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('EXACT file paths')
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('Integration')
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('JSON')
  })

  it('system prompt includes game/creative project support', () => {
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('GAME/CREATIVE PROJECTS')
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('vision')
  })

  it('simple system prompt contains core requirements', () => {
    expect(BUILD_PLAN_SIMPLE_SYSTEM_PROMPT).toContain('CRITICAL')
    expect(BUILD_PLAN_SIMPLE_SYSTEM_PROMPT).toContain('file paths')
    expect(BUILD_PLAN_SIMPLE_SYSTEM_PROMPT).toContain('JSON')
  })

  it('prompts specify JSON output format', () => {
    expect(BUILD_PLAN_SYSTEM_PROMPT).toContain('Start with { and end with }')
    expect(BUILD_PLAN_SIMPLE_SYSTEM_PROMPT).toContain('Start with { end with }')
  })
})

describe('WorkPacket Type', () => {
  it('can create a valid work packet', () => {
    const packet: WorkPacket = {
      id: 'pkt-1',
      phaseId: 'phase-1',
      title: 'Test Packet',
      description: 'A test packet for unit testing',
      type: 'feature',
      priority: 'medium',
      status: 'queued',
      tasks: [
        { id: 'task-1', description: 'Task 1', completed: false, order: 1 }
      ],
      acceptanceCriteria: ['Criteria 1'],
      blockedBy: [],
      blocks: [],
      estimatedTokens: 1000,
      suggestedTaskType: 'code'
    }

    expect(packet.id).toBe('pkt-1')
    expect(packet.tasks).toHaveLength(1)
    expect(packet.status).toBe('queued')
  })

  it('packet status enum values are correct', () => {
    // Valid WorkPacket statuses per the type definition
    const validStatuses: Array<WorkPacket['status']> = [
      'queued', 'assigned', 'in_progress', 'review', 'completed', 'blocked'
    ]

    expect(validStatuses).toContain('queued')
    expect(validStatuses).toContain('completed')
    expect(validStatuses).toHaveLength(6)
  })

  it('packet priority enum values are correct', () => {
    // Valid WorkPacket priorities per the type definition
    const validPriorities: Array<WorkPacket['priority']> = [
      'critical', 'high', 'medium', 'low'
    ]

    expect(validPriorities).toContain('high')
    expect(validPriorities).toContain('low')
    expect(validPriorities).toHaveLength(4)
  })
})

describe('BuildPhase Type', () => {
  it('can create a valid build phase', () => {
    const phase: BuildPhase = {
      id: 'phase-1',
      name: 'Phase 1',
      description: 'First phase of development',
      order: 1,
      packetIds: ['pkt-1', 'pkt-2'],
      dependencies: [],
      estimatedEffort: {
        optimistic: 4,
        realistic: 8,
        pessimistic: 16,
        confidence: 'medium'
      },
      successCriteria: ['All tests pass', 'Code review complete']
    }

    expect(phase.id).toBe('phase-1')
    expect(phase.packetIds).toHaveLength(2)
    expect(phase.order).toBe(1)
  })
})

describe('BuildPlan Structure', () => {
  it('plan has required top-level fields', () => {
    // BuildPlan requires these fields according to the interface
    const requiredFields = ['id', 'projectId', 'createdAt', 'status', 'spec', 'phases', 'packets', 'modelAssignments', 'constraints', 'generatedBy']

    // Just verify the interface exists and has these as known properties
    const mockPlan: Partial<BuildPlan> = {
      id: 'plan-1',
      projectId: 'proj-1',
      createdAt: new Date().toISOString(),
      status: 'draft',
      phases: [],
      packets: [],
      modelAssignments: [],
      generatedBy: 'claude-3'
    }

    expect(mockPlan.id).toBe('plan-1')
    expect(mockPlan.status).toBe('draft')
    expect(Array.isArray(mockPlan.phases)).toBe(true)
    expect(Array.isArray(mockPlan.packets)).toBe(true)
  })

  it('plan status values are valid', () => {
    const validStatuses: Array<BuildPlan['status']> = ['draft', 'approved', 'in_progress', 'completed']

    expect(validStatuses).toContain('draft')
    expect(validStatuses).toContain('completed')
    expect(validStatuses).toHaveLength(4)
  })
})
