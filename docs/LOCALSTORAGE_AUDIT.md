# localStorage Audit Report

Generated: 2026-01-25
Updated: 2026-01-25

## Summary

This audit identifies all localStorage usage in the Claudia Coder codebase and categorizes them by sync status.

## FIXES IMPLEMENTED

### Server-Side Storage Added:
- `src/lib/data/server-packet-runs.ts` - New server storage for packet runs
- `src/lib/data/server-resources.ts` - New server storage for resources, brain dumps, research
- `src/app/api/packet-runs/route.ts` - New API for packet runs CRUD
- `src/app/api/resources/route.ts` - New API for resources CRUD

### Client-Side Sync Added:
- `src/lib/data/packet-runs.ts` - Added server sync on create/update
- `src/lib/data/resources.ts` - Added server sync helpers
- `src/hooks/useServerSync.ts` - New hook for automatic server sync on app startup

## Server-Synced Data (✅ OK - persists across devices)

| Data Type | localStorage Key | Server Storage | Notes |
|-----------|-----------------|----------------|-------|
| Projects | `claudia_projects`, `claudia_user_${userId}_projects` | `~/.claudia-data/projects.json` | ✅ POST /api/projects syncs |
| Build Plans | `claudia_build_plans` | `~/.claudia-data/build-plans.json` | ⚠️ Verify sync |
| Packets | `claudia_packets` | `~/.claudia-data/packets.json` | ⚠️ Verify sync |
| Interviews | `claudia_interviews` | `~/.claudia-data/interviews.json` | ⚠️ Verify sync |
| Settings | `claudia_global_settings`, `claudia_user_${userId}_settings` | Server DB | ✅ /api/settings syncs |
| GitLab Token | `gitlab_token` | User DB | ✅ /api/gitlab/token syncs |

## CRITICAL: Missing Server Sync (❌ Will lose data on device change)

| Data Type | localStorage Key | Impact | Priority |
|-----------|-----------------|--------|----------|
| Packet Runs | `claudia_packet_runs` | Execution history lost | HIGH |
| Resources | `claudia_resources` | Project resources lost | HIGH |
| Brain Dumps | `claudia_brain_dumps` | User notes lost | HIGH |
| Research | `claudia_research` | Research data lost | HIGH |
| Business Ideas | `claudia_business_ideas` | Ideas lost | MEDIUM |
| Business Dev | `claudia_business_dev` | Business docs lost | MEDIUM |
| Patents | `claudia_patents` | Patent research lost | MEDIUM |
| Voice Recordings Index | `claudia_voice_recordings_index` | Recording refs lost | MEDIUM |
| Prior Art | `claudia_prior_art_${projectId}` | Research lost | MEDIUM |
| Project Model Assignments | `claudia_project_enabled_instances_*` | Model config lost | MEDIUM |
| Quality Gates | `claudia_quality_gates` | Quality config lost | MEDIUM |
| MCP Servers | `claudia_mcp_servers` | MCP config lost | MEDIUM |
| OpenWebUI Config | `claudia_openwebui_*` | Integration config lost | LOW |
| Gitea Config | `claudia_gitea_*` | Integration config lost | LOW |
| Viability Data | `claudia_business_viability` | Analysis lost | LOW |

## UI Preferences (✅ OK to be localStorage-only)

These are acceptable to store in localStorage as they're per-device preferences:

| Data Type | localStorage Key | Reason OK |
|-----------|-----------------|-----------|
| Sidebar State | `claudia_sidebar_state` | UI preference |
| View Mode (Projects) | `claudia_projects_view_mode` | UI preference |
| View Mode (Packets) | `claudia_packets_view_mode` | UI preference |
| Setup Dismissed | `claudia_setup_dismissed` | UI state |
| Recent Sessions | `claudia_recent_sessions` | Per-device history |
| Background Sessions | `claudia_background_sessions` | Per-device sessions |
| Terminal Settings | `claudia_never_lose_session`, etc. | Per-device prefs |
| Mini-Me Settings | `claudia_mini_me_*` | UI preference |
| Auto Build Plan | `claudia_auto_build_plan` | UI preference |
| Default AI Provider | `claudia_default_ai_provider` | Could sync but minor |

## Session/Temporary Data (✅ OK to be localStorage-only)

| Data Type | localStorage Key | Reason OK |
|-----------|-----------------|-----------|
| Easy Mode Session | `claudia_easy_mode_session` | Temporary wizard state |
| Execution Queue | `claudia_execution_queue` | Transient state |
| Activity Events | `claudia_activity_events` | Real-time events |
| Agent State | `claudia_agent_state` | Transient runtime state |
| Execution Results | `claudia_execution_results` | Temporary results |
| Execution Logs | `claudia_execution_logs` | Temporary logs |

## Recommendations

### Phase 1: Critical Data (Immediate)
1. Add server sync for Packet Runs
2. Add server sync for Resources
3. Add server sync for Brain Dumps
4. Verify Build Plans and Packets sync correctly

### Phase 2: Important Data (This Week)
1. Add server sync for Research
2. Add server sync for Business Ideas
3. Add server sync for Project Model Assignments
4. Add server sync for Quality Gates

### Phase 3: Nice to Have
1. Add server sync for MCP Server configs
2. Add server sync for Integration configs (Gitea, OpenWebUI)
3. Add server sync for Viability data

## Files That Need Updates

### Add Server Sync:
- `src/lib/data/packet-runs.ts` - Add server POST/GET
- `src/lib/data/resources.ts` - Add server POST/GET
- `src/lib/data/research.ts` - Add server POST/GET
- `src/lib/data/business-ideas.ts` - Add server POST/GET
- `src/lib/data/business-dev.ts` - Add server POST/GET
- `src/lib/ai/project-models.ts` - Add server POST/GET
- `src/lib/quality-gates/store.ts` - Add server POST/GET

### Create Server APIs:
- `src/app/api/packet-runs/route.ts` - New
- `src/app/api/resources/route.ts` - New
- `src/app/api/research/route.ts` - New
- `src/app/api/business-ideas/route.ts` - Exists but verify sync
- `src/app/api/project-models/route.ts` - New

### Create Server Data Files:
- `~/.claudia-data/packet-runs.json`
- `~/.claudia-data/resources.json`
- `~/.claudia-data/brain-dumps.json`
- `~/.claudia-data/research.json`
- `~/.claudia-data/business-ideas.json`
- `~/.claudia-data/project-models.json`
- `~/.claudia-data/quality-gates.json`
