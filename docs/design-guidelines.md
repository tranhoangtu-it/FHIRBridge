# Design Guidelines

## Stack

| Tool | Purpose |
|---|---|
| Vite | Build tool and dev server |
| React 18 | UI framework |
| Tailwind CSS | Utility-first styling |
| TypeScript | All components typed |

---

## Visual Theme

**Medical blue/teal color scheme.** Conveys clinical trust without sterile coldness.

| Role | Tailwind class guidance |
|---|---|
| Primary action | `bg-blue-600 hover:bg-blue-700` |
| Secondary/accent | `bg-teal-500 hover:bg-teal-600` |
| Destructive | `bg-red-500 hover:bg-red-600` |
| Surface | `bg-white dark:bg-gray-900` |
| Border | `border-gray-200 dark:border-gray-700` |
| Text primary | `text-gray-900 dark:text-gray-100` |
| Text muted | `text-gray-500 dark:text-gray-400` |

Dark mode is supported via Tailwind's `dark:` variant. Toggle via system preference.

---

## Responsive Breakpoints

Minimum supported viewport: **768px (tablet)**.

Mobile-specific layouts are not a current requirement. Use `md:` breakpoint as the base for responsive rules.

---

## Component Architecture

Components follow a three-tier hierarchy:

```
pages/           ← route-level components, compose page layout
  └── components/
        ├── layout/    ← app shell (sidebar, header, page container)
        ├── export/    ← export wizard components
        ├── import/    ← file upload and column mapper
        ├── summary/   ← summary viewer components
        └── shared/    ← generic reusables (spinner, badge, error boundary)
```

**Rules:**
- Pages orchestrate data fetching (via hooks) and pass data down to components.
- Components are presentational — they receive props, no direct API calls.
- Hooks (`hooks/`) encapsulate API calls and async state.

---

## API Client Pattern

All API communication goes through `src/api/api-client.ts` (base fetch wrapper), with domain-specific modules layered on top:

```
api-client.ts       ← base: sets base URL, headers, error handling
  ├── export-api.ts
  ├── connector-api.ts
  ├── summary-api.ts
  └── health-api.ts
```

Hooks call these API modules — never `fetch()` directly in components.

---

## Privacy Rules for UI

- **No PHI in browser storage.** Never write patient identifiers, names, or clinical data to `localStorage`, `sessionStorage`, or cookies.
- Export results are held in React state only — cleared on page navigation.
- The column mapper component handles field mapping locally; raw file data is not sent to the API until the user confirms.

---

## State Management

No global state library (Redux, Zustand) in MVP. Use:
- React `useState` / `useReducer` for local component state.
- Custom hooks for async API state (`use-api.ts`, `use-polling.ts`, `use-export.ts`).
- Prop drilling acceptable for 2-3 levels; use React Context for deeper sharing.

---

## File and Component Naming

- Files: kebab-case, descriptive (e.g., `export-wizard-page.tsx`, `column-mapper.tsx`).
- Components: PascalCase export matching filename (e.g., `export ColumnMapper`).
- Hooks: camelCase prefixed with `use` (e.g., `useExport`, `usePolling`).

---

## Code Style

- No inline styles — Tailwind classes only.
- Avoid `className` strings longer than 120 chars; extract to a `const` above the JSX.
- All props interfaces defined above the component, named `{ComponentName}Props`.
- No `any` types in component files.
