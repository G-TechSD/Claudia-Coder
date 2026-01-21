import { test, expect } from "@playwright/test"

test.describe("Reset Packets Button", () => {
  test("should show reset button when packets are complete", async ({ page }) => {
    // First, inject test data into localStorage
    await page.goto("/projects")
    await page.waitForLoadState("networkidle")

    // Create test project and packets in localStorage
    const testProjectId = "test-project-reset-" + Date.now()
    const testProject = {
      id: testProjectId,
      name: "Test Reset Project",
      description: "A test project to verify reset functionality",
      status: "active",
      priority: "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repos: [],
      basePath: "~/test-project",
      tags: []
    }

    const testPackets = [
      {
        id: "pkt-1",
        phaseId: "phase-1",
        title: "Test Packet 1",
        description: "First test packet",
        type: "feature",
        priority: "high",
        status: "completed",
        tasks: [],
        blockedBy: [],
        blocks: [],
        estimatedTokens: 1000,
        acceptanceCriteria: []
      },
      {
        id: "pkt-2",
        phaseId: "phase-1",
        title: "Test Packet 2",
        description: "Second test packet",
        type: "feature",
        priority: "medium",
        status: "completed",
        tasks: [],
        blockedBy: [],
        blocks: [],
        estimatedTokens: 1000,
        acceptanceCriteria: []
      }
    ]

    const testBuildPlan = {
      id: "plan-" + Date.now(),
      projectId: testProjectId,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalPlan: {
        spec: {
          name: "Test Project",
          description: "Test",
          objectives: ["Test objective"],
          nonGoals: [],
          assumptions: [],
          risks: [],
          techStack: ["TypeScript"]
        },
        phases: [{
          id: "phase-1",
          name: "Phase 1",
          description: "Test phase",
          order: 1,
          packetIds: ["pkt-1", "pkt-2"],
          dependencies: [],
          estimatedEffort: { optimistic: 1, realistic: 2, pessimistic: 4, confidence: "medium" },
          successCriteria: []
        }],
        packets: testPackets
      },
      editedObjectives: [],
      editedNonGoals: [],
      packetFeedback: [],
      sectionComments: [],
      generatedBy: { server: "test", model: "test" },
      revisionNumber: 1
    }

    // Inject data into localStorage
    await page.evaluate(({ project, packets, projectId, buildPlan }) => {
      // Get existing or create new storage
      const existingProjects = JSON.parse(localStorage.getItem("claudia_projects") || "[]")
      existingProjects.push(project)
      localStorage.setItem("claudia_projects", JSON.stringify(existingProjects))

      // Save packets
      const existingPackets = JSON.parse(localStorage.getItem("claudia_packets") || "{}")
      existingPackets[projectId] = packets
      localStorage.setItem("claudia_packets", JSON.stringify(existingPackets))

      // Save build plan (raw format used by saveBuildPlan)
      const existingPlansRaw = JSON.parse(localStorage.getItem("claudia_build_plans_raw") || "{}")
      existingPlansRaw[projectId] = buildPlan.originalPlan
      localStorage.setItem("claudia_build_plans_raw", JSON.stringify(existingPlansRaw))

      // Also save to claudia_build_plans for completeness
      const existingPlans = JSON.parse(localStorage.getItem("claudia_build_plans") || "[]")
      existingPlans.push(buildPlan)
      localStorage.setItem("claudia_build_plans", JSON.stringify(existingPlans))

      console.log("Injected test data:", { project, packets, buildPlan })
    }, { project: testProject, packets: testPackets, projectId: testProjectId, buildPlan: testBuildPlan })

    // Reload to pick up new data
    await page.reload()
    await page.waitForLoadState("networkidle")

    // Screenshot projects list
    await page.screenshot({ path: "screenshots/reset-test-1-projects-with-test.png", fullPage: true })

    // Navigate to the test project
    await page.goto(`/projects/${testProjectId}`)
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1000) // Wait for state to settle

    // Screenshot project page
    await page.screenshot({ path: "screenshots/reset-test-2-test-project.png", fullPage: true })

    // Check for packets data
    const packetInfo = await page.evaluate((projectId) => {
      const packets = localStorage.getItem("claudia_packets")
      if (packets) {
        const parsed = JSON.parse(packets)
        const projectPackets = parsed[projectId] || []
        return {
          count: projectPackets.length,
          statuses: projectPackets.map((p: { status: string }) => p.status)
        }
      }
      return { count: 0, statuses: [] }
    }, testProjectId)
    console.log("Packet info:", packetInfo)

    // Look for the "Reset" button or text
    const resetElements = await page.locator('text=Reset').all()
    console.log(`Found ${resetElements.length} elements containing "Reset"`)

    // Look for "Complete" status
    const completeStatus = await page.locator('text=/Complete|complete/i').all()
    console.log(`Found ${completeStatus.length} elements containing "complete"`)

    // Check for the cyan reset section
    const resetSection = page.locator('.from-cyan-500\\/10')
    const resetSectionVisible = await resetSection.isVisible().catch(() => false)
    console.log(`Reset section visible: ${resetSectionVisible}`)

    // Check for GO button area
    const goButton = page.locator('[data-go-button]')
    const goButtonVisible = await goButton.isVisible().catch(() => false)
    console.log(`GO button visible: ${goButtonVisible}`)

    // Navigate to Work Packets section
    const packetsButton = page.locator('button:has-text("Work Packets")')
    if (await packetsButton.isVisible()) {
      await packetsButton.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: "screenshots/reset-test-3-packets-section.png", fullPage: true })

      // Look for Reset All button
      const resetAllButton = page.locator('button:has-text("Reset All")')
      const resetAllVisible = await resetAllButton.isVisible().catch(() => false)
      console.log(`Reset All button in packets section: ${resetAllVisible}`)
    }

    // Final screenshot
    await page.screenshot({ path: "screenshots/reset-test-4-final.png", fullPage: true })

    // Cleanup - remove test project
    await page.evaluate((projectId) => {
      const projects = JSON.parse(localStorage.getItem("claudia_projects") || "[]")
      const filtered = projects.filter((p: { id: string }) => p.id !== projectId)
      localStorage.setItem("claudia_projects", JSON.stringify(filtered))

      const packets = JSON.parse(localStorage.getItem("claudia_packets") || "{}")
      delete packets[projectId]
      localStorage.setItem("claudia_packets", JSON.stringify(packets))
    }, testProjectId)
  })
})
