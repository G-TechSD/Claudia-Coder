# Claudia Execution Output Spec: React Apps

Reference implementation: HyperHealth (`/home/bill/projects/hyperhealth/`)

## 1. Complete App Structure

A "Create React app" packet execution MUST produce:

```
project-name/
├── index.html           # Root HTML with #root div
├── package.json         # Dependencies + scripts
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind with custom colors
├── postcss.config.js    # PostCSS for Tailwind
├── src/
│   ├── main.jsx         # React entry point
│   ├── App.jsx          # Root component with routing
│   ├── index.css        # Tailwind directives + base styles
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page-level components
│   └── hooks/           # Custom React hooks
└── public/              # Static assets
```

## 2. Required Config Files

### package.json (minimum)
```json
{
  "name": "app-name",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^4.1.18",
    "@tailwindcss/postcss": "^4.1.18",
    "autoprefixer": "^10.4.23",
    "postcss": "^8.5.6",
    "vite": "^7.2.4"
  }
}
```

### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
```

### tailwind.config.js
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: { colors: { /* app-specific colors */ } } },
  plugins: []
}
```

### postcss.config.js
```javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

### index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-gray-900 text-white; }
```

## 3. Minimum Viable Components by App Type

### Dashboard App (like HyperHealth)
| File | Purpose |
|------|---------|
| `src/App.jsx` | State + page routing logic |
| `src/components/Sidebar.jsx` | Navigation with active state |
| `src/pages/Dashboard.jsx` | Main view with data display |
| `src/pages/Settings.jsx` | User preferences |
| `src/hooks/useLocalStorage.js` | Persistent state |

### Simple CRUD App
| File | Purpose |
|------|---------|
| `src/App.jsx` | Main container |
| `src/components/ItemList.jsx` | Display items |
| `src/components/ItemForm.jsx` | Create/edit |
| `src/hooks/useLocalStorage.js` | Data persistence |

### Landing Page
| File | Purpose |
|------|---------|
| `src/App.jsx` | Single page layout |
| `src/components/Hero.jsx` | Main header section |
| `src/components/Features.jsx` | Feature grid |
| `src/components/CTA.jsx` | Call to action |

## 4. Prompt Engineering for Complete Apps

### Problem
Local LLMs often produce incomplete apps:
- Missing import statements
- Undefined components
- No file structure
- Config files omitted

### Solution: Structured Prompts

**Step 1: Generate File Manifest First**
```
List all files needed for a React + Vite + Tailwind app that does X.
Output as JSON: {"files": ["path/to/file.jsx", ...]}
```

**Step 2: Generate Each File Explicitly**
```
Generate the complete content for: src/App.jsx
This app needs: [list features from Step 1]
Import these components: [list from manifest]
Do NOT abbreviate. Include ALL code.
```

**Step 3: Validate Imports**
```
Check this file for undefined imports or missing components.
File: [content]
Available files: [manifest]
```

### Prompt Template for Complete Components
```
Create a React functional component for [ComponentName].

REQUIREMENTS:
- Export default function [ComponentName]
- Props: { prop1, prop2 }
- Use Tailwind CSS classes only (no external CSS)
- Include ALL logic - no placeholders like "// TODO"
- Handle loading/error/empty states

OUTPUT: Complete JSX file, nothing else.
```

### Anti-Patterns to Avoid
- "Create a React app" (too vague)
- "Add styling" (undefined scope)
- Multi-file requests in one prompt (causes truncation)
- "Similar to X" without specifics

## 5. Execution Validation Checklist

Before marking a React app execution complete:

- [ ] `npm install` succeeds
- [ ] `npm run dev` starts without errors
- [ ] All pages render (no white screen)
- [ ] No console errors about undefined components
- [ ] Navigation works between pages
- [ ] Data persists on refresh (if using localStorage)
- [ ] Tailwind classes apply correctly

## 6. Common Failures and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| White screen | Missing import in App.jsx | Check all component imports |
| "X is not defined" | Component not exported | Add `export default` |
| No styles | Missing Tailwind directives | Check index.css has @tailwind |
| Build fails | Version mismatch | Pin Vite/React versions |
| HMR broken | Wrong vite.config | Add react() plugin |

## 7. Example Execution Flow

For prompt: "Create a healthcare call tracking app"

1. **Parse intent**: Dashboard + forms + local storage
2. **Generate manifest**: 8 files minimum
3. **Create configs**: package.json, vite, tailwind, postcss
4. **Create entry**: index.html, main.jsx, index.css
5. **Create components**: One prompt per file
6. **Create hooks**: useLocalStorage pattern
7. **Validate**: Run checklist above
8. **Test**: `npm install && npm run dev`

Total execution steps: 8+ (one per file minimum)
