---
title: "Phase 7 — Web UI"
status: complete
priority: P2
effort: 20h
owner: Dev 2
---

# Phase 7 — Web UI

## Context Links
- [Plan Overview](./plan.md)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vite](https://vite.dev/)
- Phase dependency: [Phase 5](./phase-05-api-server.md)

## Overview
React web dashboard for FHIRBridge. File upload (CSV/Excel/FHIR Bundle), connector configuration, export initiation, real-time progress tracking, summary viewing, and PDF download. Uses shadcn/ui + Tailwind CSS. Communicates with API server only — no direct FHIR/AI calls.

## Priority
**P2** — End-user interface. Depends on API server.

## Requirements

### Functional
- Dashboard: recent exports, usage stats
- Connector setup: configure FHIR endpoint or upload file
- Export wizard: step-by-step patient export flow
- File upload: drag-and-drop CSV/Excel/FHIR JSON
- Column mapping UI: visual mapper for CSV/Excel→FHIR
- Export progress: real-time status updates (polling)
- Summary viewer: rendered Markdown with section navigation
- PDF download: one-click download
- Settings: API key management, default provider, language

### Non-Functional
- Responsive: desktop + tablet
- Accessible: ARIA labels, keyboard navigation
- Dark mode support (Tailwind dark:)
- Bundle size <500KB gzipped
- API calls via typed HTTP client
- No PHI persisted in browser (no localStorage for medical data)

## Architecture

```
@fhirbridge/web/
├── src/
│   ├── main.tsx                    # React entry
│   ├── app.tsx                     # Router + layout
│   ├── api/
│   │   ├── api-client.ts           # Typed fetch wrapper
│   │   ├── export-api.ts           # Export endpoint calls
│   │   ├── connector-api.ts        # Connector endpoint calls
│   │   ├── summary-api.ts          # Summary endpoint calls
│   │   └── health-api.ts           # Health check
│   ├── pages/
│   │   ├── dashboard-page.tsx      # Main dashboard
│   │   ├── export-wizard-page.tsx  # Multi-step export flow
│   │   ├── import-page.tsx         # File upload + mapping
│   │   ├── summary-viewer-page.tsx # View generated summary
│   │   └── settings-page.tsx       # Configuration
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx     # Navigation sidebar
│   │   │   ├── app-header.tsx      # Top bar with user/settings
│   │   │   └── page-container.tsx  # Content wrapper
│   │   ├── export/
│   │   │   ├── connector-form.tsx  # FHIR endpoint config form
│   │   │   ├── export-progress.tsx # Real-time progress display
│   │   │   └── export-result.tsx   # Bundle preview + download
│   │   ├── import/
│   │   │   ├── file-dropzone.tsx   # Drag-and-drop upload
│   │   │   ├── column-mapper.tsx   # Visual column mapping
│   │   │   └── preview-table.tsx   # Data preview table
│   │   ├── summary/
│   │   │   ├── summary-config.tsx  # Provider/language/detail config
│   │   │   ├── summary-display.tsx # Rendered markdown sections
│   │   │   └── summary-actions.tsx # Download PDF/MD buttons
│   │   └── shared/
│   │       ├── loading-spinner.tsx
│   │       ├── error-boundary.tsx
│   │       └── status-badge.tsx
│   ├── hooks/
│   │   ├── use-export.ts           # Export flow state management
│   │   ├── use-polling.ts          # Generic status polling
│   │   ├── use-file-upload.ts      # File upload with progress
│   │   └── use-api.ts              # Generic API call hook
│   ├── lib/
│   │   ├── constants.ts            # API base URL, routes
│   │   └── format-utils.ts         # Date, size, resource formatters
│   └── styles/
│       └── globals.css             # Tailwind base + shadcn theme
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── components.json                 # shadcn/ui config
```

### User Flows
```
Dashboard
  ├── "New Export" → Export Wizard
  │     Step 1: Select connector (FHIR endpoint / File upload)
  │     Step 2: Configure connection / Upload file
  │     Step 3: Enter patient ID / Map columns
  │     Step 4: Select output options (format, summary)
  │     Step 5: Review + Start export
  │     Step 6: Progress → Result → Download
  │
  ├── "Import File" → Import Page
  │     Upload → Preview → Map → Export
  │
  └── "View Summary" → Summary Viewer
        Select export → Configure AI → Generate → View → Download
```

## Related Code Files

### Files to Create
All files under `packages/web/src/` as listed in Architecture above.

Key files:
- `packages/web/src/api/api-client.ts` — `class ApiClient { baseUrl, authToken, get<T>(), post<T>(), upload() }`
- `packages/web/src/pages/dashboard-page.tsx` — recent exports table, quick actions, usage chart
- `packages/web/src/pages/export-wizard-page.tsx` — multi-step form with stepper UI
- `packages/web/src/pages/import-page.tsx` — dropzone + column mapper + preview
- `packages/web/src/pages/summary-viewer-page.tsx` — markdown renderer + section nav + download
- `packages/web/src/pages/settings-page.tsx` — API key, provider config, language
- `packages/web/src/components/import/file-dropzone.tsx` — react-dropzone, accept CSV/XLSX/JSON
- `packages/web/src/components/import/column-mapper.tsx` — drag-and-drop column→FHIR path mapping
- `packages/web/src/components/export/export-progress.tsx` — polling-based progress with steps
- `packages/web/src/components/summary/summary-display.tsx` — react-markdown with section anchors
- `packages/web/src/hooks/use-export.ts` — state machine: idle → configuring → exporting → complete → error
- `packages/web/src/hooks/use-polling.ts` — `usePolling(url, interval): { data, status, error }`

### shadcn/ui Components to Install
- Button, Card, Dialog, DropdownMenu, Form, Input, Label, Select, Table, Tabs, Badge, Progress, Separator, Sheet, Skeleton, Tooltip, Alert

### Test Files
- `packages/web/src/pages/__tests__/dashboard-page.test.tsx`
- `packages/web/src/components/import/__tests__/file-dropzone.test.tsx`
- `packages/web/src/components/import/__tests__/column-mapper.test.tsx`
- `packages/web/src/hooks/__tests__/use-polling.test.ts`

## Implementation Steps

1. **Scaffold Vite + React project**
   - `vite.config.ts`: React plugin, path aliases (@/), proxy to API server in dev
   - `tailwind.config.ts`: content paths, shadcn theme
   - `postcss.config.js`: tailwindcss, autoprefixer
   - Install shadcn/ui: `npx shadcn@latest init`

2. **Install shadcn components**
   - Run `npx shadcn@latest add button card dialog form input label select table tabs badge progress alert sheet skeleton tooltip dropdown-menu separator`

3. **Build API client** (`api/api-client.ts`)
   - Typed fetch wrapper with error handling
   - Auth: include Bearer token from settings
   - Base URL from `VITE_API_URL` env var
   - `get<T>(path): Promise<T>`, `post<T>(path, body): Promise<T>`, `upload(path, file, metadata): Promise<T>`

4. **Build API modules** (`api/export-api.ts`, etc.)
   - `ExportApi`: startExport, getStatus, downloadBundle
   - `ConnectorApi`: testConnection, uploadFile
   - `SummaryApi`: generateSummary, downloadSummary
   - `HealthApi`: checkHealth

5. **Build layout** (`components/layout/`)
   - `AppSidebar`: navigation links (Dashboard, Export, Import, Settings), logo, version
   - `AppHeader`: breadcrumbs, user menu
   - `PageContainer`: max-width wrapper, padding

6. **Build Dashboard page**
   - Recent exports: table with date, patient ID (masked), status, resource count, actions
   - Quick actions: "New Export", "Import File" cards
   - Usage stats: exports today/week/month (from API)
   - Health indicator: green/red dot for API status

7. **Build Export Wizard** (multi-step)
   - Step 1: Select connector type (FHIR endpoint / File upload) — card selection
   - Step 2: FHIR endpoint form (URL, client ID, secret) OR file upload
   - Step 3: Patient ID input with search (if FHIR) or column mapping (if file)
   - Step 4: Output config: format, include AI summary, provider, language
   - Step 5: Review all selections → confirm
   - Step 6: Progress display → result → download buttons
   - Use stepper component from shadcn

8. **Build Import page**
   - `FileDropzone`: accept .csv, .xlsx, .json; show file name + size
   - After upload: `PreviewTable` shows first 10 rows
   - `ColumnMapper`: left panel (source columns), right panel (FHIR paths), drag to connect
   - Map button → call API → show progress → download result

9. **Build Summary Viewer**
   - Select an export → show bundle preview
   - `SummaryConfig`: select provider, model, language, detail level
   - Generate button → progress → render markdown sections
   - Section navigation: sidebar with section links
   - Download: PDF and Markdown buttons
   - Disclaimer banner: "AI-generated summary — verify with healthcare provider"

10. **Build hooks**
    - `useExport()`: state machine for export wizard flow
    - `usePolling(url, interval, enabled)`: poll API endpoint, return latest data
    - `useFileUpload()`: upload with XHR progress tracking
    - `useApi()`: generic data fetching with loading/error states

11. **Build Settings page**
    - API key input (masked display)
    - Default AI provider + model selection
    - Default language
    - Connection profiles CRUD (stored via API, not localStorage)
    - Theme toggle (light/dark)

12. **Write tests**
    - Dashboard: renders recent exports
    - FileDropzone: accepts valid files, rejects invalid
    - ColumnMapper: creates valid mapping config
    - usePolling: stops when status is complete

## Todo List
- [x] Vite + React + Tailwind scaffold
- [x] shadcn/ui installation + theme (Tailwind v4 CSS-based config)
- [x] API client with typed endpoints
- [x] Layout (sidebar, header, container)
- [x] Dashboard page
- [x] Export wizard (6-step flow)
- [x] File dropzone component
- [x] Column mapper (dropdown-based)
- [x] Preview table
- [x] Export progress component
- [x] Summary viewer with markdown renderer
- [x] Summary config panel
- [x] Settings page
- [x] useExport hook (state machine)
- [x] usePolling hook
- [x] useFileUpload hook
- [x] Dark mode support
- [ ] Component tests (deferred — no test runner setup for React components)

## Success Criteria
- Export wizard completes full flow: configure → export → download
- File upload accepts CSV/Excel, shows preview, maps columns
- Summary viewer renders all sections with navigation
- PDF download works from summary viewer
- Dashboard shows recent exports with status
- Responsive layout works on tablet (768px+)
- No PHI stored in browser storage

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Column mapper UX complexity | High | Start with simple dropdown mapping, add drag-and-drop later |
| Bundle size bloat | Medium | Dynamic imports for heavy pages (summary viewer, import) |
| API polling battery drain (mobile) | Low | Increase interval on background tab, use visibility API |
| shadcn breaking changes | Low | Pin versions, check changelog |

## Security Considerations
- No PHI in localStorage, sessionStorage, or cookies
- API token in memory only (Context provider), cleared on tab close
- File uploads: validate MIME type client-side before upload
- CSP headers: restrict to API origin only
- Mask patient IDs in dashboard display (show last 4 chars)
- AI disclaimer banner on all summary outputs

## File Ownership
```
packages/web/src/**  → Dev 2
packages/web/*.config.* → Dev 2
```
