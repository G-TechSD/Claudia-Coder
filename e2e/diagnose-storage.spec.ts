import { test } from "@playwright/test"

test("Diagnose localStorage for packets", async ({ page }) => {
  await page.goto("/projects")
  await page.waitForLoadState("networkidle")

  // Check all localStorage keys
  const storageInfo = await page.evaluate(() => {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        keys.push(key)
      }
    }

    // Get packet-related data
    const packetKeys = keys.filter(k => k.includes("packet") || k.includes("Packet"))
    const projectKeys = keys.filter(k => k.includes("project") || k.includes("Project"))

    // Check specific storage keys
    const claudiaPackets = localStorage.getItem("claudia_packets")
    const claudiaProjects = localStorage.getItem("claudia_projects")

    // Find user-scoped packet keys
    const userPacketKeys = keys.filter(k => k.includes("claudia_user") && k.includes("packet"))

    return {
      totalKeys: keys.length,
      allKeys: keys,
      packetKeys,
      projectKeys,
      userPacketKeys,
      claudiaPackets: claudiaPackets ? JSON.parse(claudiaPackets) : null,
      claudiaProjects: claudiaProjects ? JSON.parse(claudiaProjects) : null
    }
  })

  console.log("\n=== STORAGE DIAGNOSIS ===")
  console.log(`Total localStorage keys: ${storageInfo.totalKeys}`)
  console.log(`\nAll keys:`, storageInfo.allKeys)
  console.log(`\nPacket-related keys:`, storageInfo.packetKeys)
  console.log(`\nProject-related keys:`, storageInfo.projectKeys)
  console.log(`\nUser-scoped packet keys:`, storageInfo.userPacketKeys)

  if (storageInfo.claudiaPackets) {
    console.log("\n=== claudia_packets content ===")
    for (const [projectId, packets] of Object.entries(storageInfo.claudiaPackets)) {
      const packetArray = packets as Array<{ id: string; title: string; status: string }>
      console.log(`Project ${projectId}: ${packetArray.length} packets`)
      packetArray.forEach((p: { id: string; title: string; status: string }) => {
        console.log(`  - ${p.title}: ${p.status}`)
      })
    }
  } else {
    console.log("\nNo claudia_packets found in localStorage")
  }

  if (storageInfo.claudiaProjects) {
    console.log("\n=== claudia_projects content ===")
    const projects = storageInfo.claudiaProjects as Array<{ id: string; name: string; status: string }>
    projects.forEach((p: { id: string; name: string; status: string }) => {
      console.log(`  - ${p.name} (${p.id}): ${p.status}`)
    })
  }

  // Take screenshot
  await page.screenshot({ path: "screenshots/storage-diagnosis.png", fullPage: true })
})
