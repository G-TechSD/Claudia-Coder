# Claudia Coder User Guide

**Version:** 1.0
**Last Updated:** January 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [First Launch](#first-launch)
   - [Creating Your First Project](#creating-your-first-project)
3. [Brain Dump](#brain-dump)
   - [Voice Recording](#voice-recording)
   - [Text Input](#text-input)
   - [AI Processing](#ai-processing)
4. [Build Plans](#build-plans)
   - [Understanding Build Plans](#understanding-build-plans)
   - [Creating a Build Plan](#creating-a-build-plan)
   - [Approving Build Plans](#approving-build-plans)
5. [Claude Code Terminal](#claude-code-terminal)
   - [Starting a Session](#starting-a-session)
   - [Working with Projects](#working-with-projects)
   - [Using Custom Folders](#using-custom-folders)
6. [Packet Workflow](#packet-workflow)
   - [Understanding Packets](#understanding-packets)
   - [Packet Status Transitions](#packet-status-transitions)
   - [Executing Packets](#executing-packets)
7. [Quality Gates](#quality-gates)
   - [Overview](#quality-gates-overview)
   - [Gate Categories](#gate-categories)
   - [Running Quality Checks](#running-quality-checks)
8. [Approvals](#approvals)
   - [Approval Types](#approval-types)
   - [Reviewing Requests](#reviewing-requests)
   - [Managing Urgent Items](#managing-urgent-items)
9. [Timeline](#timeline)
   - [Viewing Project History](#viewing-project-history)
   - [Event Filtering](#event-filtering)
10. [Costs](#costs)
    - [Tracking API Usage](#tracking-api-usage)
    - [Budget Management](#budget-management)
11. [MCP Servers](#mcp-servers)
    - [What are MCP Servers](#what-are-mcp-servers)
    - [Adding MCP Servers](#adding-mcp-servers)
    - [Syncing with Claude Desktop](#syncing-with-claude-desktop)
12. [Settings](#settings)
    - [AI Services](#ai-services)
    - [Connections](#connections)
    - [Notifications](#notifications)
    - [Automation](#automation)
    - [Security](#security)
    - [Data Management](#data-management)
13. [FAQ](#faq)
14. [Troubleshooting](#troubleshooting)

---

## Introduction

Claudia Coder is a comprehensive project orchestration system designed to manage AI-assisted software development. It transforms your ideas into structured development projects through an intelligent workflow that includes:

- **Voice-to-Project Conversion** - Speak your ideas, and AI converts them into actionable plans
- **Structured Build Plans** - Organized phases and work packets for systematic development
- **Claude Code Integration** - Direct terminal access to AI-powered coding assistance
- **Human-in-the-Loop Approvals** - Control critical decisions while automating routine tasks
- **Quality Assurance** - Automated testing and validation gates

Whether you're a developer looking to accelerate your workflow or a non-technical user wanting to bring software ideas to life, Claudia Coder provides the tools to make it happen.

---

## Getting Started

### First Launch

When you first launch Claudia Coder, you'll see the **Dashboard** displaying key metrics:

```
[Screenshot Placeholder: Dashboard Overview]
```

The dashboard shows:
- **Active Projects** - Number of projects currently being developed
- **Active Packets** - Work units currently in progress
- **Completed Today** - Tasks finished in the current day
- **Blocked** - Items requiring attention

**Setup Guide**: If this is your first time, a Setup Guide will appear prompting you to configure:

1. **AI Services** - Connect to local LLM servers (LM Studio, Ollama) or cloud providers (Claude, OpenAI)
2. **Git Connections** - Link your GitLab or GitHub repositories
3. **Notification Preferences** - Set up email alerts and notifications

**Tip:** Claudia Coder prioritizes local AI servers to minimize costs. You can use all core features without any paid subscriptions.

### Creating Your First Project

**Step 1:** Navigate to the Projects page using the sidebar

**Step 2:** Click the **"New Project"** button in the top right

**Step 3:** Fill in the project details:
- **Project Name** - A descriptive name for your project
- **Description** - Brief overview of what you want to build
- **Priority** - Low, Medium, High, or Critical
- **Tags** - Optional categorization tags

```
[Screenshot Placeholder: New Project Form]
```

**Step 4:** Choose your creation method:
- **Quick Create** - Fill in basic details and create immediately
- **AI Interview** - Let Claudia ask clarifying questions to better understand your project
- **Voice Brain Dump** - Record your ideas verbally

**Step 5:** Link a repository (optional but recommended):
- Browse your connected GitLab/GitHub repositories
- Or specify a local folder path

**Tip:** Projects start in "Planning" status. Change to "Active" when you're ready to begin development.

---

## Brain Dump

The Brain Dump feature allows you to capture project ideas through voice or text, which AI then processes into structured content.

### Voice Recording

**Step 1:** Open your project and navigate to the **User Uploads** tab

**Step 2:** In the "Voice Brain Dumps" section, click **"Start New"**

**Step 3:** Click the microphone button to begin recording

```
[Screenshot Placeholder: Audio Recorder Interface]
```

**Step 4:** Speak naturally about your project:
- Describe features you want
- Explain user workflows
- Mention technical requirements
- Share any concerns or constraints

**Step 5:** Click **Stop** when finished

**Step 6:** The recording will be automatically transcribed using AI

**Tips for Better Results:**
- Speak clearly and at a moderate pace
- Organize your thoughts into logical sections
- Mention specific technologies if you have preferences
- Don't worry about perfect structure - AI will organize it

### Text Input

If you prefer typing, you can enter your brain dump as text:

**Step 1:** In the Brain Dump section, choose **"Text Input"**

**Step 2:** Type or paste your project ideas

**Step 3:** Click **"Process"** to have AI analyze the content

### AI Processing

After recording or entering text, click **"Process with AI"** to extract structured content:

```
[Screenshot Placeholder: Brain Dump Review Panel]
```

The AI will identify:
- **Summary** - A concise overview of your ideas
- **Sections** - Organized topic areas
- **Action Items** - Specific tasks to complete
- **Ideas** - Creative suggestions worth considering
- **Questions** - Clarifications needed before proceeding
- **Decisions** - Choices that need to be made

**Reviewing and Approving:**
1. Each section shows a checkbox for approval
2. Click to expand any section for details
3. Check items you want to include
4. Click **"Create Packets"** to convert approved items into work packets

---

## Build Plans

### Understanding Build Plans

A Build Plan is a comprehensive document that defines HOW your project will be built. It includes:

- **Technology Stack** - Languages, frameworks, and tools
- **Architecture Overview** - System design and structure
- **Development Phases** - Sequential stages of development
- **Work Packets** - Individual units of work within each phase
- **Dependencies** - What must be completed before other tasks

### Creating a Build Plan

**Step 1:** Open your project and go to the **Build Plan** tab

**Step 2:** If starting fresh, click **"Generate Build Plan"**

**Step 3:** Select your AI provider from the dropdown:
- Local servers appear first (recommended for cost savings)
- Cloud providers available if configured

```
[Screenshot Placeholder: Build Plan Editor]
```

**Step 4:** The AI will analyze your project and generate:
- A Product Requirements Document (PRD)
- A detailed build plan with phases
- Individual work packets for each task

**Step 5:** Review each section:
- Edit titles and descriptions as needed
- Adjust estimated hours
- Reorder packets if necessary
- Add or remove tasks

### Approving Build Plans

Before execution can begin, the build plan must be approved:

**Step 1:** Review all packets in the build plan

**Step 2:** Ensure dependencies are correctly mapped

**Step 3:** Verify estimated hours are reasonable

**Step 4:** Click **"Approve Build Plan"**

```
[Screenshot Placeholder: Build Plan Approval]
```

Once approved:
- The plan status changes to "Approved" or "Locked"
- You can initialize the project folder
- Packets become available for execution

**Warning:** After approval, some changes may require re-approval. Major structural changes will reset the approval status.

---

## Claude Code Terminal

The Claude Code Terminal provides direct access to Claude's coding capabilities within your project context.

### Starting a Session

**Method 1: From Project Page**

**Step 1:** Open your project

**Step 2:** Navigate to the **Claude Code** tab

**Step 3:** Click **"Start Session"**

```
[Screenshot Placeholder: Claude Code Terminal in Project]
```

**Method 2: From Dedicated Page**

**Step 1:** Click **"Claude Code"** in the sidebar

**Step 2:** Select your project from the dropdown

**Step 3:** Click **"Start Session"**

### Working with Projects

Once a session starts, Claude Code has access to:
- Your project's working directory
- All project files and code
- The build plan and packet details
- Git repository information

**Common Commands:**
```bash
# Ask Claude to explain code
"Explain the authentication flow in this project"

# Request code changes
"Add input validation to the user registration form"

# Get help with errors
"I'm seeing a TypeScript error on line 45 of auth.ts"
```

**Session Controls:**
- **Restart Session** - Start fresh with a new terminal
- **Bypass Permissions** - Skip confirmation prompts (use with caution)

### Using Custom Folders

You can also use Claude Code with any folder on your system:

**Step 1:** On the Claude Code page, select **"Custom / Temp Folder"** from the dropdown

**Step 2:** Enter the full path to your folder

**Step 3:** Click **"Start Session"**

This is useful for:
- Quick one-off tasks
- Projects not yet added to Claudia
- Exploring existing codebases

---

## Packet Workflow

### Understanding Packets

Packets are atomic units of work that represent a single, completable task. Each packet contains:

- **Title** - Brief description of the work
- **Summary** - Detailed explanation
- **Type** - Feature, Bug Fix, Refactor, etc.
- **Priority** - High, Normal, or Low
- **Tasks** - Checklist of specific actions
- **Acceptance Criteria** - Conditions for completion
- **Dependencies** - Other packets that must complete first

### Packet Status Transitions

Packets flow through these statuses:

```
[Queued] --> [Running] --> [Completed]
    |           |              ^
    |           v              |
    |       [Paused] -------->|
    |           |              |
    v           v              |
[Blocked] --> [Failed] ------>|
    |                          |
    v                          |
[Cancelled] ------------------>
```

| Status | Description |
|--------|-------------|
| **Queued** | Ready to start, waiting in line |
| **Running** | Currently being worked on |
| **Paused** | Temporarily stopped |
| **Blocked** | Cannot proceed due to external factors |
| **Completed** | All tasks and criteria satisfied |
| **Failed** | Encountered errors, needs attention |
| **Cancelled** | Manually stopped, won't be completed |

### Executing Packets

**Manual Execution:**

**Step 1:** Navigate to the **Packets** page or project **Packets** tab

**Step 2:** Find the packet you want to execute

**Step 3:** Click the **Play** button to start

```
[Screenshot Placeholder: Packet Queue with Action Buttons]
```

**Step 4:** Monitor progress in the execution logs

**AI-Powered Execution:**

**Step 1:** Ensure an LLM server is online (check status indicator)

**Step 2:** Click **"Execute with LLM"** on the packet

**Step 3:** Choose execution mode:
- **Standard** - 3 iteration maximum
- **Long-Horizon** - 10 iterations for complex tasks

**Step 4:** Watch as Claude Code implements the packet

**After Execution:**
- Review generated code
- Provide feedback (thumbs up/down)
- The packet status updates automatically

---

## Quality Gates

### Quality Gates Overview

Quality Gates are automated checks that ensure code meets your standards before deployment. They run automatically during packet execution.

```
[Screenshot Placeholder: Quality Gates Dashboard]
```

The dashboard shows:
- Overall health status (Healthy, Warning, Failing)
- Pass/Fail/Warning counts
- Recent gate run history

### Gate Categories

| Category | Icon | Purpose |
|----------|------|---------|
| **Code Quality** | Code icon | Linting, formatting, complexity |
| **Testing** | Test tube | Unit tests, integration tests |
| **Security** | Lock | Vulnerability scanning, secrets detection |
| **Review** | PR icon | Code review requirements |
| **Performance** | Gauge | Load testing, benchmarks |

### Running Quality Checks

Quality gates run automatically, but you can also trigger them manually:

**Step 1:** Go to the **Quality** page

**Step 2:** Select a gate from the list

**Step 3:** Click **"Run Gate"** in the detail panel

**Understanding Results:**
- **Passed** - All checks met the threshold
- **Failed** - Critical issues need fixing
- **Warning** - Minor issues to address
- **Skipped** - Gate was not applicable

**Tip:** Required gates must pass before packets can be marked complete. Configure which gates are required in Settings.

---

## Approvals

The Approvals system provides human-in-the-loop control for critical decisions.

### Approval Types

| Type | Description | Urgency |
|------|-------------|---------|
| **Cost Approval** | Spending above threshold | High |
| **Deployment** | Production releases | High |
| **Security** | Security-sensitive changes | High |
| **Manual Step** | Tasks requiring human action | Medium |
| **Quality Gate** | Failed quality checks | Medium |

### Reviewing Requests

**Step 1:** Navigate to the **Approvals** page

```
[Screenshot Placeholder: Approvals Queue]
```

**Step 2:** Review pending requests:
- Click any request to see full details
- Check the requester and timestamp
- Review the specific ask

**Step 3:** Take action:
- **Approve** - Allow the requested action
- **Reject** - Deny with optional reason
- **Request More Info** - Ask for clarification

### Managing Urgent Items

Urgent requests are highlighted in red and show time remaining:

**Tips for Urgent Items:**
- Check the expiration time
- Review the impact of delay
- Consider partial approvals if possible
- Use the filter to show only urgent items

---

## Timeline

The Timeline provides a visual history of all project activity.

### Viewing Project History

**Step 1:** Navigate to the **Timeline** page

```
[Screenshot Placeholder: Timeline View]
```

**Step 2:** Events are grouped by hour with:
- Event type (Start, Complete, Error, Approval, Deploy, Test)
- Packet information
- Agent/worker details
- Duration

**Step 3:** Click any event for full details

### Event Filtering

Filter events by type:
- **All** - Show everything
- **Start** - Work began
- **Complete** - Successfully finished
- **Error** - Problems encountered
- **Approval** - Review requests
- **Deploy** - Deployments
- **Test** - Test executions

**Zoom Controls:**
- Use zoom buttons to adjust timeline density
- Navigate between days with arrow buttons
- Click "Today" to return to current date

---

## Costs

Track API usage and manage spending limits.

### Tracking API Usage

The Costs dashboard shows:

```
[Screenshot Placeholder: Cost Dashboard]
```

- **Today's Spending** - Current day total with daily budget progress
- **This Week** - 7-day totals and daily average
- **This Month** - Monthly total with budget progress
- **Remaining** - Daily budget remaining

**Spending Categories:**
- **API Calls** - LLM API usage
- **Compute** - Processing costs
- **Storage** - Data storage fees
- **Other** - Miscellaneous costs

### Budget Management

**Setting Budgets:**

**Step 1:** Go to **Settings > Automation**

**Step 2:** Configure limits:
- **Daily Budget** - Maximum daily spend
- **Monthly Budget** - Maximum monthly spend
- **Alert Threshold** - Percentage to trigger warnings

**Budget Alerts:**
- Yellow warning when approaching limit
- Red alert when exceeded
- Notifications sent if enabled

**Tip:** Budget alerts can automatically pause execution to prevent overspending.

---

## MCP Servers

### What are MCP Servers

MCP (Model Context Protocol) servers extend Claude Code's capabilities with additional tools and integrations. Examples include:

- File system access
- Database connections
- API integrations
- Custom tools

### Adding MCP Servers

**Step 1:** Navigate to **Claude Code > MCP** (or click "Manage" from Claude Code page)

**Step 2:** Click **"Add Server"**

```
[Screenshot Placeholder: Add MCP Server Dialog]
```

**Step 3:** Configure the server:
- **Name** - Descriptive identifier
- **Command** - The command to run the server
- **Arguments** - Command line arguments
- **Environment** - Environment variables
- **Scope** - Global (all projects) or Project-specific

**Step 4:** Test and save

### Syncing with Claude Desktop

If you have Claude Desktop installed, you can sync configurations:

**Import from Claude:**
- Click **"Import from Claude"** to pull existing servers

**Export to Claude:**
- Click **"Sync to Claude"** to push your configuration

This ensures consistent MCP server availability across tools.

---

## Settings

### AI Services

```
[Screenshot Placeholder: AI Services Settings]
```

**LLM Status:**
- View connected servers and their status
- See which models are loaded
- Check response times

**Image Generation:**
- Enable/disable paid image generation
- Configure NanoBanana API key

### Connections

**Adding Local AI Servers:**

**Step 1:** Click **"Add Local Server"**

**Step 2:** Enter server details:
- Name (e.g., "LM Studio BEAST")
- URL (e.g., "http://192.168.1.100:1234")

**Step 3:** Test connection

**Step 4:** Select default model from available options

**Adding Cloud Providers:**

**Step 1:** Click **"Add Cloud Provider"**

**Step 2:** Select provider (Anthropic, OpenAI, Google)

**Step 3:** Enter API key or sign in with OAuth (Anthropic Max)

**Step 4:** Test and save

### Notifications

Configure how you receive updates:

- **Email Updates** - Master toggle plus sub-options:
  - Daily Email Summary
  - Project Generation Notifications
  - Attention Needed Alerts
- **Approval Requests** - Notifications for approvals
- **Error Alerts** - Immediate failure notifications
- **Cost Alerts** - Budget warnings
- **Completion Notifications** - Task completion updates

### Automation

Control automatic behaviors:

| Setting | Description |
|---------|-------------|
| Auto-start Queued Packets | Begin work when agents available |
| Auto-retry Failed Builds | Retry failures up to 3 times |
| Auto-merge on Approval | Merge PRs after approval |
| Auto-deploy to Staging | Deploy after tests pass |
| Ralph Wiggum Loop | Iterate until tests pass |

### Security

Security controls and options:

- **Require Approval for Deployments** - Human approval for production
- **Secret Scanning** - Prevent committing secrets
- **Dependency Audit** - Block, Warn, or Disable for vulnerable packages
- **API Rate Limiting** - Prevent abuse
- **Two-Factor Authentication** - Extra security for sensitive operations
- **Audit Logging** - Track security events

### Data Management

**Viewing Data:**
- See counts of projects, packets, build plans
- Check total storage keys used

**Import/Export:**
- **Export All Data** - Download complete backup
- **Import Data** - Restore from backup file

**Danger Zone:**
- Clear Project Data (keeps settings)
- Delete All Data (preserves GitLab token)

**Warning:** Data deletion is permanent. Always export before clearing.

---

## FAQ

### General Questions

**Q: Do I need coding experience to use Claudia Coder?**

A: No! Claudia Coder is designed for both technical and non-technical users. You can describe your project in plain language, and AI will handle the technical implementation.

**Q: What AI providers are supported?**

A: Claudia supports:
- Local: LM Studio, Ollama, any OpenAI-compatible server
- Cloud: Anthropic (Claude), OpenAI (GPT-4), Google (Gemini)

**Q: Is my code private?**

A: When using local AI servers, your code never leaves your network. Cloud providers process data according to their privacy policies.

### Technical Questions

**Q: How do I connect to my LM Studio server?**

A: Go to Settings > Connections > Add Local Server. Enter the URL (usually http://your-ip:1234) and test the connection.

**Q: Why isn't my packet executing?**

A: Check that:
1. An LLM server is online (green status indicator)
2. The packet has no blocking dependencies
3. You have budget remaining
4. The project has a linked repository or working directory

**Q: Can I use multiple AI providers?**

A: Yes! Configure multiple providers in Settings. Claudia will use local servers first, then fall back to cloud providers.

### Workflow Questions

**Q: What's the difference between Standard and Long-Horizon execution?**

A: Standard mode runs up to 3 iterations for quick tasks. Long-Horizon mode runs up to 10 iterations for complex, multi-step work.

**Q: How do I handle failed packets?**

A: Failed packets can be:
1. Retried with the same configuration
2. Edited to fix issues before retry
3. Assigned to Claude Code for manual investigation
4. Cancelled if no longer needed

---

## Troubleshooting

### Connection Issues

**Problem:** LM Studio server shows "Offline"

**Solutions:**
1. Verify LM Studio is running on the target machine
2. Check the URL and port are correct
3. Ensure no firewall is blocking the connection
4. Try accessing the URL directly in a browser

**Problem:** Claude API connection fails

**Solutions:**
1. Verify your API key is correct
2. Check your API credits/balance
3. Ensure you're not rate limited
4. Try re-authenticating with OAuth

### Execution Issues

**Problem:** Packets stay in "Queued" status

**Solutions:**
1. Check if an LLM server is available
2. Verify the packet has no unmet dependencies
3. Ensure auto-start is enabled in Settings
4. Try manually clicking "Start"

**Problem:** Build plan generation fails

**Solutions:**
1. Ensure your project has a description
2. Try a different AI provider
3. Check for network connectivity
4. Review error message for specific issues

### Data Issues

**Problem:** Projects or packets disappeared

**Solutions:**
1. Check the status filter - you might be filtering them out
2. Refresh the page
3. Check localStorage in browser dev tools
4. Restore from a backup if available

**Problem:** Settings won't save

**Solutions:**
1. Ensure browser allows localStorage
2. Check for browser storage limits
3. Try in an incognito window
4. Clear browser cache and retry

---

## Support

For additional help:

- **Documentation:** Check the `/docs` folder for technical specifications
- **Issues:** Report bugs via your project's issue tracker
- **Updates:** Keep Claudia Coder updated for latest features and fixes

---

*This guide covers Claudia Coder version 1.0. Features and interfaces may change in future versions.*

**Last Updated:** January 2026
