# Wiki Documentation Maintenance Skill

## Trigger
This skill is activated when the user says:
- `/wiki-docs` or `/docs`
- "update wiki documentation"
- "document this in the wiki"
- "add to wiki"

## Purpose
Maintain and update the Claudia Coder documentation wiki with accurate, up-to-date information about the codebase, features, and usage.

## Instructions

When this skill is activated:

### 1. Understand the Request
Determine what type of documentation update is needed:
- **New feature documentation** - Document a newly added feature
- **Update existing docs** - Update outdated documentation
- **Code documentation** - Document code architecture, patterns, or APIs
- **Usage guide** - Create user-facing documentation
- **Changelog entry** - Add a changelog entry for recent changes

### 2. Gather Information
Before writing documentation:
- Read relevant source files to understand the implementation
- Check existing wiki documents to avoid duplication
- Identify the appropriate document type and scope (Claudia Coder, Global, or Project-specific)

### 3. Document Types
Choose the appropriate type:
- `architecture` - System design, patterns, data flow
- `api` - API endpoints, request/response formats
- `component` - React components, props, usage
- `changelog` - Version updates, changes
- `guide` - How-to guides, tutorials
- `reference` - Quick reference, lookup tables
- `runbook` - Operational procedures
- `decision` - Architecture decision records

### 4. Create/Update Documentation
Use the Wiki API to create or update documents:

**Create new document:**
```bash
curl -X POST /api/wiki \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Document Title",
    "content": "Markdown content...",
    "type": "guide",
    "tags": ["tag1", "tag2"],
    "projectId": "__claudia_coder__"
  }'
```

**Update existing document:**
```bash
curl -X PUT /api/wiki/{id} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "content": "Updated content..."
  }'
```

### 5. Documentation Standards

#### Structure
- Use clear headings (H1 for title, H2 for sections, H3 for subsections)
- Include code examples with syntax highlighting
- Add tables for reference data
- Keep paragraphs concise

#### Content Guidelines
- Write for developers who are new to the codebase
- Include file paths when referencing code
- Show example usage with realistic scenarios
- Explain the "why" not just the "what"

#### Code Examples
```typescript
// Always include imports
import { Component } from "@/components/ui/component"

// Show realistic usage
function Example() {
  return <Component prop="value" />
}
```

### 6. Key Documentation Areas

Always ensure these areas are documented:

1. **Getting Started**
   - Installation and setup
   - Environment configuration
   - First run guide

2. **Architecture**
   - Directory structure
   - Data flow patterns
   - Key abstractions

3. **Features**
   - Each major feature should have its own doc
   - Include usage examples
   - Document configuration options

4. **API Reference**
   - All API endpoints
   - Request/response formats
   - Error codes

5. **Components**
   - Reusable UI components
   - Props documentation
   - Usage examples

6. **Development**
   - Contributing guidelines
   - Testing approach
   - Deployment process

### 7. After Creating/Updating

- Verify the document renders correctly in the wiki
- Check for broken links or references
- Update related documents if needed
- Add appropriate tags for discoverability

## Example Workflow

When user says "document the new wiki feature":

1. Read `/src/lib/data/wiki.ts` to understand the data layer
2. Read `/src/app/api/wiki/route.ts` for API endpoints
3. Read `/src/app/wiki/page.tsx` for UI implementation
4. Check existing wiki docs for related content
5. Create comprehensive documentation covering:
   - Feature overview
   - Data model
   - API endpoints
   - UI components
   - Usage examples
6. Tag with relevant keywords
7. Set projectId to `__claudia_coder__` for system docs

## Special IDs

- `__claudia_coder__` - Claudia Coder platform documentation
- `__global__` - Global documentation not tied to any project
- Any project ID - Project-specific documentation
