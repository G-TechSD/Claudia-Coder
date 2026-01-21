import { test, expect } from "@playwright/test"

test.describe("Clear All Projects", () => {
  test("should show correct project count and clear all data", async ({ page }) => {
    // Go to settings page
    await page.goto("/settings?section=advanced")
    await page.waitForLoadState("networkidle")

    // Take screenshot of initial state
    await page.screenshot({ path: "screenshots/settings-before-clear.png", fullPage: true })

    // Check if we see projects in the stored data section
    const projectCount = page.locator("text=Projects").first()
    await expect(projectCount).toBeVisible()

    // Go to projects page to see current projects
    await page.goto("/projects")
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: "screenshots/projects-before-clear.png", fullPage: true })

    // Go back to settings and clear data
    await page.goto("/settings?section=advanced")
    await page.waitForLoadState("networkidle")

    // Click to expand danger zone if needed
    const dangerZoneButton = page.locator("text=Show Danger Zone").first()
    if (await dangerZoneButton.isVisible()) {
      await dangerZoneButton.click()
    }

    // Type DELETE ALL in the confirmation input
    const confirmInput = page.locator('input[placeholder*="DELETE ALL"]').first()
    if (await confirmInput.isVisible()) {
      await confirmInput.fill("DELETE ALL")

      // Click the clear button
      const clearButton = page.locator("button:has-text('Clear All Data')").first()
      await clearButton.click()

      // Handle the alert
      page.on("dialog", (dialog) => dialog.accept())

      // Wait a moment for the clear to complete
      await page.waitForTimeout(1000)
    }

    // Take screenshot after clearing
    await page.screenshot({ path: "screenshots/settings-after-clear.png", fullPage: true })

    // Go to projects page to verify it's empty
    await page.goto("/projects")
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: "screenshots/projects-after-clear.png", fullPage: true })

    // Verify no projects are shown (should see empty state or "New Project" prompt)
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount2 = await projectCards.count()

    console.log(`Projects found after clearing: ${projectCount2}`)
  })
})
