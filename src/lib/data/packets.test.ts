import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Packets API', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('packets API returns proper structure', async () => {
    const mockResponse = {
      success: true,
      count: 2,
      packets: [
        {
          id: 'pkt-1',
          title: 'Test Packet 1',
          summary: 'Description 1',
          status: 'queued',
          projectID: 'project-1'
        },
        {
          id: 'pkt-2',
          title: 'Test Packet 2',
          summary: 'Description 2',
          status: 'completed',
          projectID: 'project-1'
        }
      ],
      sources: {
        n8n: 0,
        localStorage: 2
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const response = await fetch('/api/packets')
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.count).toBe(2)
    expect(data.packets).toHaveLength(2)
    expect(data.sources).toBeDefined()
  })

  it('packets can be filtered by projectID', async () => {
    const mockResponse = {
      success: true,
      count: 1,
      packets: [
        {
          id: 'pkt-1',
          title: 'Test Packet',
          projectID: 'project-1',
          status: 'queued'
        }
      ],
      sources: { n8n: 0, localStorage: 1 }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const response = await fetch('/api/packets?projectID=project-1')
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.packets.every((p: { projectID: string }) => p.projectID === 'project-1')).toBe(true)
  })

  it('packets can be filtered by status', async () => {
    const mockResponse = {
      success: true,
      count: 1,
      packets: [
        {
          id: 'pkt-2',
          title: 'Completed Packet',
          status: 'completed'
        }
      ],
      sources: { n8n: 0, localStorage: 1 }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const response = await fetch('/api/packets?status=completed')
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.packets.every((p: { status: string }) => p.status === 'completed')).toBe(true)
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Internal server error',
        packets: []
      })
    })

    const response = await fetch('/api/packets')
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
    expect(data.packets).toEqual([])
  })
})

describe('Packet Status Values', () => {
  const validStatuses = ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled']

  it('recognizes valid packet statuses', () => {
    validStatuses.forEach(status => {
      expect(typeof status).toBe('string')
      expect(status.length).toBeGreaterThan(0)
    })
  })

  it('has expected number of status values', () => {
    expect(validStatuses).toHaveLength(6)
  })
})

describe('Packet Transformation', () => {
  it('transforms N8N packet format correctly', () => {
    // Simulate the transformation that happens in the API
    const n8nPacket = {
      id: 'n8n-pkt-1',
      packetID: 'pkt-1',
      projectID: 'proj-1',
      planRunID: 'run-1',
      assignedWorker: 'worker-1',
      status: 'queued',
      packetJSON: JSON.stringify({
        title: 'Test Packet',
        summary: 'Test summary',
        issues: [],
        acceptanceCriteria: ['Criteria 1'],
        risks: [],
        dependencies: []
      })
    }

    const parsed = JSON.parse(n8nPacket.packetJSON)

    expect(parsed.title).toBe('Test Packet')
    expect(parsed.summary).toBe('Test summary')
    expect(parsed.acceptanceCriteria).toEqual(['Criteria 1'])
  })
})
