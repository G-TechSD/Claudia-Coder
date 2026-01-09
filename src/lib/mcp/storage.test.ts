import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMCPServers, addMCPServer, saveMCPServers } from './storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('MCP Storage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getMCPServers', () => {
    it('returns an array', () => {
      const servers = getMCPServers();
      expect(Array.isArray(servers)).toBe(true);
    });

    it('returns empty array when no servers stored', () => {
      const servers = getMCPServers();
      expect(servers).toEqual([]);
    });
  });

  describe('addMCPServer', () => {
    it('creates server with ID', () => {
      const serverData = {
        name: 'Test Server',
        command: 'node',
        args: ['server.js'],
        enabled: true,
        scope: 'global' as const,
      };

      const server = addMCPServer(serverData);

      expect(server).toHaveProperty('id');
      expect(typeof server.id).toBe('string');
      expect(server.id.length).toBeGreaterThan(0);
      expect(server.name).toBe('Test Server');
    });

    it('adds server to storage', () => {
      const serverData = {
        name: 'Test Server',
        command: 'node',
        args: ['server.js'],
        enabled: true,
        scope: 'global' as const,
      };

      addMCPServer(serverData);
      const servers = getMCPServers();

      expect(servers.length).toBe(1);
      expect(servers[0].name).toBe('Test Server');
    });
  });

  describe('saveMCPServers', () => {
    it('persists data to localStorage', () => {
      const now = new Date().toISOString();
      const servers = [
        {
          id: '1',
          name: 'Server 1',
          command: 'node',
          args: [],
          enabled: true,
          scope: 'global' as const,
          status: 'stopped' as const,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2',
          name: 'Server 2',
          command: 'python',
          args: [],
          enabled: true,
          scope: 'global' as const,
          status: 'stopped' as const,
          createdAt: now,
          updatedAt: now,
        },
      ];

      saveMCPServers(servers);

      expect(localStorageMock.setItem).toHaveBeenCalled();

      const savedServers = getMCPServers();
      expect(savedServers.length).toBe(2);
      expect(savedServers[0].name).toBe('Server 1');
      expect(savedServers[1].name).toBe('Server 2');
    });
  });
});
