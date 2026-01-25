/**
 * Tests for project utilities
 */

import { describe, it, expect } from "vitest"
import { generateWorkingDirectoryPath, getEffectiveWorkingDirectory } from "./projects"

describe("Project Utilities", () => {
  describe("generateWorkingDirectoryPath", () => {
    it("generates a path with slug from project name", () => {
      const path = generateWorkingDirectoryPath("My Test Project")
      expect(path).toContain("my-test-project")
    })

    it("includes project ID suffix when provided", () => {
      const path = generateWorkingDirectoryPath("Test Project", "12345678-abcd-efgh")
      expect(path).toContain("test-project-12345678")
    })

    it("handles special characters in project name", () => {
      const path = generateWorkingDirectoryPath("Test & Project #1!")
      // Special characters are removed, resulting in "test-project-1"
      expect(path).toContain("test-project-1")
    })

    it("handles empty project name", () => {
      const path = generateWorkingDirectoryPath("")
      expect(path).toContain("project")
    })
  })

  describe("getEffectiveWorkingDirectory", () => {
    it("returns basePath when set", () => {
      const project = {
        id: "test-123",
        name: "Test",
        basePath: "/custom/path",
        workingDirectory: "/other/path",
        repos: []
      }
      // @ts-expect-error - partial project for test
      const result = getEffectiveWorkingDirectory(project)
      expect(result).toBe("/custom/path")
    })

    it("returns workingDirectory when basePath is not set", () => {
      const project = {
        id: "test-123",
        name: "Test",
        workingDirectory: "/working/dir",
        repos: []
      }
      // @ts-expect-error - partial project for test
      const result = getEffectiveWorkingDirectory(project)
      expect(result).toBe("/working/dir")
    })

    it("returns repo localPath when no explicit paths set", () => {
      const project = {
        id: "test-123",
        name: "Test",
        repos: [{ localPath: "/repo/path" }]
      }
      // @ts-expect-error - partial project for test
      const result = getEffectiveWorkingDirectory(project)
      expect(result).toBe("/repo/path")
    })

    it("generates path when no paths are set", () => {
      const project = {
        id: "test-123",
        name: "Test Project",
        repos: []
      }
      // @ts-expect-error - partial project for test
      const result = getEffectiveWorkingDirectory(project)
      expect(result).toContain("test-project")
    })
  })
})
