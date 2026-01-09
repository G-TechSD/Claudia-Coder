/**
 * Business Development Data Store
 * Generate and manage business development documents from build plans
 */

import type {
  BusinessDev,
  BusinessDevStatus,
  BusinessDevExecutiveSummary,
  BusinessDevFeature,
  BusinessDevMarketAnalysis,
  BusinessDevMonetization,
  BusinessDevProForma,
  BusinessDevGoToMarket,
  BusinessDevRisks,
  StoredBuildPlan
} from "./types"
import { getProject, updateProject } from "./projects"
import { getBuildPlanForProject } from "./build-plans"

// UUID generator that works in all contexts (HTTP, HTTPS, localhost)
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const STORAGE_KEY = "claudia_business_dev"

// ============ Storage Helpers ============

function getStoredBusinessDevs(): BusinessDev[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveBusinessDevs(docs: BusinessDev[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

// ============ Business Dev CRUD ============

/**
 * Get business development document for a project
 */
export function getBusinessDev(projectId: string): BusinessDev | null {
  const docs = getStoredBusinessDevs()
  // Return the most recent for this project
  const projectDocs = docs
    .filter(d => d.projectId === projectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return projectDocs[0] || null
}

/**
 * Get business development document by ID
 */
export function getBusinessDevById(id: string): BusinessDev | null {
  const docs = getStoredBusinessDevs()
  return docs.find(d => d.id === id) || null
}

/**
 * Get all business dev documents for a project (history)
 */
export function getBusinessDevHistory(projectId: string): BusinessDev[] {
  const docs = getStoredBusinessDevs()
  return docs
    .filter(d => d.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/**
 * Update an existing business development document
 */
export function updateBusinessDev(
  projectId: string,
  updates: Partial<Omit<BusinessDev, "id" | "projectId" | "createdAt">>
): BusinessDev | null {
  const docs = getStoredBusinessDevs()
  const existing = getBusinessDev(projectId)

  if (!existing) return null

  const index = docs.findIndex(d => d.id === existing.id)
  if (index === -1) return null

  const updated: BusinessDev = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  docs[index] = updated
  saveBusinessDevs(docs)

  // Also update the project reference
  updateProject(projectId, { businessDev: updated })

  return updated
}

/**
 * Create a new business development document
 */
function createBusinessDev(
  projectId: string,
  data: Omit<BusinessDev, "id" | "projectId" | "createdAt" | "updatedAt">
): BusinessDev {
  const docs = getStoredBusinessDevs()
  const now = new Date().toISOString()

  const businessDev: BusinessDev = {
    id: generateUUID(),
    projectId,
    ...data,
    createdAt: now,
    updatedAt: now
  }

  docs.push(businessDev)
  saveBusinessDevs(docs)

  // Also update the project reference
  updateProject(projectId, { businessDev })

  return businessDev
}

/**
 * Delete a business development document
 */
export function deleteBusinessDev(id: string): boolean {
  const docs = getStoredBusinessDevs()
  const filtered = docs.filter(d => d.id !== id)

  if (filtered.length === docs.length) return false

  saveBusinessDevs(filtered)
  return true
}

// ============ Status Management ============

/**
 * Update business dev status
 */
export function updateBusinessDevStatus(
  projectId: string,
  status: BusinessDevStatus
): BusinessDev | null {
  return updateBusinessDev(projectId, { status })
}

/**
 * Submit for review
 */
export function submitForReview(projectId: string): BusinessDev | null {
  return updateBusinessDevStatus(projectId, "review")
}

/**
 * Approve business dev document
 */
export function approveBusinessDev(
  projectId: string,
  approvedBy?: string
): BusinessDev | null {
  return updateBusinessDev(projectId, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy
  })
}

/**
 * Archive business dev document
 */
export function archiveBusinessDev(projectId: string): BusinessDev | null {
  return updateBusinessDevStatus(projectId, "archived")
}

// ============ Generation ============

export interface GenerateBusinessDevInput {
  projectId: string
  buildPlan?: StoredBuildPlan
  generatedBy: {
    server: string
    model: string
  }
}

/**
 * Generate business development document from build plan
 * This creates a template that can be further refined by AI or manually edited
 */
export function generateBusinessDev(input: GenerateBusinessDevInput): BusinessDev {
  const { projectId, generatedBy } = input
  const project = getProject(projectId)
  const buildPlan = input.buildPlan || getBuildPlanForProject(projectId)

  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  // Extract information from build plan if available
  const spec = buildPlan?.originalPlan?.spec
  const packets = buildPlan?.originalPlan?.packets || []

  // Build features from work packets
  const features: BusinessDevFeature[] = packets
    .filter(p => p.type === "feature" || p.type === "enhancement")
    .slice(0, 10) // Limit to top 10 features
    .map((p, index) => ({
      id: `feature-${index}`,
      name: p.title,
      description: p.description,
      userBenefit: p.acceptanceCriteria?.[0] || "Improves user experience",
      priority: mapPacketPriorityToFeaturePriority(p.priority)
    }))

  // Create executive summary
  const executiveSummary: BusinessDevExecutiveSummary = {
    overview: spec?.description || project.description || "",
    problem: extractProblemStatement(spec, project),
    solution: extractSolutionStatement(spec, project),
    targetMarket: "[To be defined - describe your target market]",
    uniqueValue: extractUniqueValue(spec)
  }

  // Create market analysis
  const marketAnalysis: BusinessDevMarketAnalysis = {
    marketSize: "[Total addressable market size]",
    targetAudience: "[Primary user personas and demographics]",
    competitors: [
      { name: "[Competitor 1]", description: "", strengths: [], weaknesses: [] },
      { name: "[Competitor 2]", description: "", strengths: [], weaknesses: [] }
    ],
    differentiators: spec?.objectives || ["[Key differentiator 1]", "[Key differentiator 2]"],
    marketTrends: ["[Market trend 1]", "[Market trend 2]"]
  }

  // Create monetization strategy
  const monetization: BusinessDevMonetization = {
    model: "subscription",
    pricing: "[Pricing tiers and structure]",
    pricingTiers: [
      { name: "Free", price: "$0/month", features: ["Basic features"] },
      { name: "Pro", price: "[TBD]/month", features: ["All features", "Priority support"] },
      { name: "Enterprise", price: "Custom", features: ["Custom integrations", "Dedicated support"] }
    ],
    revenueStreams: ["[Primary revenue stream]", "[Secondary revenue stream]"]
  }

  // Create pro forma financials
  const proForma: BusinessDevProForma = {
    yearOneRevenue: "[Year 1 projected revenue]",
    yearTwoRevenue: "[Year 2 projected revenue]",
    yearThreeRevenue: "[Year 3 projected revenue]",
    expenses: [
      { category: "Development", amount: "[TBD]", frequency: "monthly" },
      { category: "Infrastructure", amount: "[TBD]", frequency: "monthly" },
      { category: "Marketing", amount: "[TBD]", frequency: "monthly" },
      { category: "Operations", amount: "[TBD]", frequency: "monthly" }
    ],
    profitMargin: "[Expected profit margin]",
    breakEvenPoint: "[Expected break-even timeline]",
    assumptions: [
      "[Key assumption 1]",
      "[Key assumption 2]",
      "[Key assumption 3]"
    ]
  }

  // Create go-to-market strategy
  const goToMarket: BusinessDevGoToMarket = {
    launchStrategy: "[Describe launch approach]",
    marketingChannels: ["[Channel 1]", "[Channel 2]", "[Channel 3]"],
    partnerships: ["[Potential partner 1]", "[Potential partner 2]"],
    milestones: [
      { name: "MVP Launch", date: "[TBD]", description: "Initial product release" },
      { name: "Public Launch", date: "[TBD]", description: "Full market launch" }
    ]
  }

  // Create risks assessment from build plan risks if available
  const risks: BusinessDevRisks = {
    risks: (spec?.risks || []).slice(0, 5).map((risk, index) => ({
      id: `risk-${index}`,
      category: "technical" as const,
      description: risk,
      likelihood: "medium" as const,
      impact: "medium" as const,
      mitigation: "[Define mitigation strategy]"
    }))
  }

  // If no risks from build plan, add placeholders
  if (risks.risks.length === 0) {
    risks.risks = [
      {
        id: "risk-0",
        category: "market",
        description: "[Market risk description]",
        likelihood: "medium",
        impact: "medium",
        mitigation: "[Mitigation strategy]"
      },
      {
        id: "risk-1",
        category: "technical",
        description: "[Technical risk description]",
        likelihood: "medium",
        impact: "medium",
        mitigation: "[Mitigation strategy]"
      }
    ]
  }

  // Create the business dev document
  const businessDevData: Omit<BusinessDev, "id" | "projectId" | "createdAt" | "updatedAt"> = {
    status: "draft",
    executiveSummary,
    features: features.length > 0 ? features : [
      {
        id: "feature-0",
        name: "[Feature Name]",
        description: "[Feature description]",
        userBenefit: "[How this benefits users]",
        priority: "must-have"
      }
    ],
    marketAnalysis,
    monetization,
    proForma,
    goToMarket,
    risks,
    generatedBy,
    generatedFromBuildPlanId: buildPlan?.id
  }

  return createBusinessDev(projectId, businessDevData)
}

// ============ Helper Functions ============

function mapPacketPriorityToFeaturePriority(
  priority: string
): "must-have" | "should-have" | "nice-to-have" {
  switch (priority.toLowerCase()) {
    case "critical":
    case "high":
      return "must-have"
    case "medium":
      return "should-have"
    default:
      return "nice-to-have"
  }
}

function extractProblemStatement(
  spec: StoredBuildPlan["originalPlan"]["spec"] | undefined,
  project: { description: string }
): string {
  if (spec?.assumptions && spec.assumptions.length > 0) {
    return `Users face challenges with: ${spec.assumptions.slice(0, 3).join(", ")}`
  }
  return `[Define the problem ${project.description ? `related to: ${project.description}` : "your product solves"}]`
}

function extractSolutionStatement(
  spec: StoredBuildPlan["originalPlan"]["spec"] | undefined,
  project: { name: string; description: string }
): string {
  if (spec?.objectives && spec.objectives.length > 0) {
    return `${project.name} provides: ${spec.objectives.slice(0, 3).join(", ")}`
  }
  return `[Describe how ${project.name} solves the problem]`
}

function extractUniqueValue(
  spec: StoredBuildPlan["originalPlan"]["spec"] | undefined
): string {
  if (spec?.objectives && spec.objectives.length > 0) {
    return spec.objectives[0]
  }
  return "[What makes your solution unique]"
}

// ============ PDF Export ============

export interface ExportPDFOptions {
  includeFinancials?: boolean
  includeMarketAnalysis?: boolean
  includeGoToMarket?: boolean
  includeRisks?: boolean
  companyName?: string
  companyLogo?: string
}

/**
 * Export business development document as PDF
 * Returns HTML content that can be converted to PDF by the client
 */
export function exportBusinessDevPDF(
  projectId: string,
  options: ExportPDFOptions = {}
): { html: string; filename: string } | null {
  const businessDev = getBusinessDev(projectId)
  const project = getProject(projectId)

  if (!businessDev || !project) return null

  const {
    includeFinancials = true,
    includeMarketAnalysis = true,
    includeGoToMarket = true,
    includeRisks = true,
    companyName = "Claudia",
    companyLogo
  } = options

  const html = generatePDFHTML(businessDev, project.name, {
    includeFinancials,
    includeMarketAnalysis,
    includeGoToMarket,
    includeRisks,
    companyName,
    companyLogo
  })

  const filename = `${project.name.toLowerCase().replace(/\s+/g, "-")}-business-plan.pdf`

  return { html, filename }
}

function generatePDFHTML(
  doc: BusinessDev,
  projectName: string,
  options: {
    includeFinancials: boolean
    includeMarketAnalysis: boolean
    includeGoToMarket: boolean
    includeRisks: boolean
    companyName: string
    companyLogo?: string
  }
): string {
  const {
    includeFinancials,
    includeMarketAnalysis,
    includeGoToMarket,
    includeRisks,
    companyName,
    companyLogo
  } = options

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${projectName} - Business Development Plan</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #1e40af;
      margin-bottom: 10px;
    }
    .header .company {
      color: #6b7280;
      font-size: 14px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .status-draft { background: #fef3c7; color: #92400e; }
    .status-review { background: #dbeafe; color: #1e40af; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-archived { background: #e5e7eb; color: #374151; }
    h2 {
      color: #1e40af;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    h3 {
      color: #374151;
      margin-top: 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .feature-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      border-left: 4px solid #2563eb;
    }
    .feature-card.must-have { border-left-color: #dc2626; }
    .feature-card.should-have { border-left-color: #f59e0b; }
    .feature-card.nice-to-have { border-left-color: #10b981; }
    .feature-card h4 {
      margin: 0 0 10px 0;
      color: #1f2937;
    }
    .feature-card p {
      margin: 5px 0;
      font-size: 14px;
    }
    .priority-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .priority-must-have { background: #fee2e2; color: #991b1b; }
    .priority-should-have { background: #fef3c7; color: #92400e; }
    .priority-nice-to-have { background: #d1fae5; color: #065f46; }
    .metric {
      display: inline-block;
      background: #eff6ff;
      color: #1e40af;
      padding: 8px 16px;
      border-radius: 6px;
      margin: 5px;
      font-weight: 500;
    }
    .competitor-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .risk-card {
      background: #fef2f2;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      border-left: 4px solid #ef4444;
    }
    .risk-card.low { border-left-color: #10b981; background: #ecfdf5; }
    .risk-card.medium { border-left-color: #f59e0b; background: #fffbeb; }
    .risk-card.high { border-left-color: #ef4444; background: #fef2f2; }
    .pricing-tier {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      text-align: center;
    }
    .pricing-tier h4 {
      margin: 0 0 10px 0;
    }
    .pricing-tier .price {
      font-size: 24px;
      font-weight: 700;
      color: #1e40af;
    }
    .milestone {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      padding: 10px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .milestone-dot {
      width: 12px;
      height: 12px;
      background: #2563eb;
      border-radius: 50%;
      margin-right: 15px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    @media print {
      body { padding: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" style="max-height: 60px;">` : ""}
    <h1>${projectName}</h1>
    <div class="company">Business Development Plan</div>
    <div class="company">
      <span class="status-badge status-${doc.status}">${doc.status}</span>
    </div>
    <div class="company">Generated: ${new Date(doc.createdAt).toLocaleDateString()}</div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <h3>Overview</h3>
    <p>${doc.executiveSummary.overview}</p>

    <h3>Problem</h3>
    <p>${doc.executiveSummary.problem}</p>

    <h3>Solution</h3>
    <p>${doc.executiveSummary.solution}</p>

    <h3>Target Market</h3>
    <p>${doc.executiveSummary.targetMarket}</p>

    <h3>Unique Value Proposition</h3>
    <p>${doc.executiveSummary.uniqueValue}</p>
  </div>

  <div class="section">
    <h2>Key Features</h2>
    ${doc.features.map(f => `
      <div class="feature-card ${f.priority}">
        <h4>${f.name} <span class="priority-tag priority-${f.priority}">${f.priority}</span></h4>
        <p>${f.description}</p>
        <p><strong>User Benefit:</strong> ${f.userBenefit}</p>
      </div>
    `).join("")}
  </div>

  ${includeMarketAnalysis ? `
  <div class="section page-break">
    <h2>Market Analysis</h2>

    <h3>Market Size</h3>
    <p>${doc.marketAnalysis.marketSize}</p>

    <h3>Target Audience</h3>
    <p>${doc.marketAnalysis.targetAudience}</p>

    <h3>Market Trends</h3>
    <ul>
      ${doc.marketAnalysis.marketTrends.map(t => `<li>${t}</li>`).join("")}
    </ul>

    <h3>Competitive Landscape</h3>
    ${doc.marketAnalysis.competitors.map(c => `
      <div class="competitor-card">
        <h4>${c.name}</h4>
        ${c.description ? `<p>${c.description}</p>` : ""}
        ${c.strengths.length > 0 ? `
          <p><strong>Strengths:</strong></p>
          <ul>${c.strengths.map(s => `<li>${s}</li>`).join("")}</ul>
        ` : ""}
        ${c.weaknesses.length > 0 ? `
          <p><strong>Weaknesses:</strong></p>
          <ul>${c.weaknesses.map(w => `<li>${w}</li>`).join("")}</ul>
        ` : ""}
      </div>
    `).join("")}

    <h3>Key Differentiators</h3>
    <ul>
      ${doc.marketAnalysis.differentiators.map(d => `<li>${d}</li>`).join("")}
    </ul>
  </div>
  ` : ""}

  <div class="section">
    <h2>Monetization Strategy</h2>

    <h3>Business Model</h3>
    <p class="metric">${doc.monetization.model.toUpperCase()}</p>

    <h3>Pricing</h3>
    <p>${doc.monetization.pricing}</p>

    ${doc.monetization.pricingTiers && doc.monetization.pricingTiers.length > 0 ? `
    <h3>Pricing Tiers</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      ${doc.monetization.pricingTiers.map(tier => `
        <div class="pricing-tier">
          <h4>${tier.name}</h4>
          <div class="price">${tier.price}</div>
          <ul style="text-align: left; margin-top: 15px;">
            ${tier.features.map(f => `<li>${f}</li>`).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
    ` : ""}

    <h3>Revenue Streams</h3>
    <ul>
      ${doc.monetization.revenueStreams.map(r => `<li>${r}</li>`).join("")}
    </ul>
  </div>

  ${includeFinancials ? `
  <div class="section page-break">
    <h2>Financial Projections</h2>

    <h3>Revenue Forecast</h3>
    <div style="margin: 20px 0;">
      <span class="metric">Year 1: ${doc.proForma.yearOneRevenue}</span>
      <span class="metric">Year 2: ${doc.proForma.yearTwoRevenue}</span>
      <span class="metric">Year 3: ${doc.proForma.yearThreeRevenue}</span>
    </div>

    <h3>Key Expenses</h3>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Amount</th>
          <th>Frequency</th>
        </tr>
      </thead>
      <tbody>
        ${doc.proForma.expenses.map(e => `
          <tr>
            <td>${e.category}</td>
            <td>${e.amount}</td>
            <td>${e.frequency}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <h3>Profitability</h3>
    <p><strong>Expected Profit Margin:</strong> ${doc.proForma.profitMargin}</p>
    <p><strong>Break-Even Point:</strong> ${doc.proForma.breakEvenPoint}</p>

    <h3>Key Assumptions</h3>
    <ul>
      ${doc.proForma.assumptions.map(a => `<li>${a}</li>`).join("")}
    </ul>
  </div>
  ` : ""}

  ${includeGoToMarket && doc.goToMarket ? `
  <div class="section page-break">
    <h2>Go-to-Market Strategy</h2>

    <h3>Launch Strategy</h3>
    <p>${doc.goToMarket.launchStrategy}</p>

    <h3>Marketing Channels</h3>
    <ul>
      ${doc.goToMarket.marketingChannels.map(c => `<li>${c}</li>`).join("")}
    </ul>

    <h3>Strategic Partnerships</h3>
    <ul>
      ${doc.goToMarket.partnerships.map(p => `<li>${p}</li>`).join("")}
    </ul>

    <h3>Key Milestones</h3>
    ${doc.goToMarket.milestones.map(m => `
      <div class="milestone">
        <div class="milestone-dot"></div>
        <div>
          <strong>${m.name}</strong> - ${m.date}
          <br><span style="color: #6b7280;">${m.description}</span>
        </div>
      </div>
    `).join("")}
  </div>
  ` : ""}

  ${includeRisks && doc.risks && doc.risks.risks.length > 0 ? `
  <div class="section page-break">
    <h2>Risk Assessment</h2>
    ${doc.risks.risks.map(r => `
      <div class="risk-card ${r.impact}">
        <h4>${r.description}</h4>
        <p>
          <strong>Category:</strong> ${r.category} |
          <strong>Likelihood:</strong> ${r.likelihood} |
          <strong>Impact:</strong> ${r.impact}
        </p>
        <p><strong>Mitigation:</strong> ${r.mitigation}</p>
      </div>
    `).join("")}
  </div>
  ` : ""}

  <div class="footer">
    <p>Generated by ${companyName} | ${new Date().toLocaleDateString()}</p>
    <p>Confidential - For Internal Use Only</p>
  </div>
</body>
</html>
  `.trim()
}

// ============ Query Helpers ============

/**
 * Get all business dev documents
 */
export function getAllBusinessDevs(): BusinessDev[] {
  return getStoredBusinessDevs()
}

/**
 * Check if a project has a business dev document
 */
export function hasBusinessDev(projectId: string): boolean {
  return getBusinessDev(projectId) !== null
}

/**
 * Get business dev documents by status
 */
export function getBusinessDevsByStatus(status: BusinessDevStatus): BusinessDev[] {
  return getStoredBusinessDevs().filter(d => d.status === status)
}

/**
 * Get draft business dev documents
 */
export function getDraftBusinessDevs(): BusinessDev[] {
  return getBusinessDevsByStatus("draft")
}

/**
 * Get approved business dev documents
 */
export function getApprovedBusinessDevs(): BusinessDev[] {
  return getBusinessDevsByStatus("approved")
}
