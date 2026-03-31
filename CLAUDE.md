# CLAUDE.md -- Development Guide for Bones & Bru

## Quick Reference

```bash
npm run dev              # Full dev server (Vite + Netlify Functions) on :8888
npm run dev:vite         # Vite-only frontend on :3000
npm run build            # Production build
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:headed  # Playwright with visible browser
npm run lint             # TypeScript type check
```

## Architecture

- **SPA** -- React 19 + React Router v7, client-side only (no SSR)
- **Serverless API** -- Netlify Functions at `/.netlify/functions/`
- **Storage** -- Netlify Blobs (`@netlify/blobs`) with strong consistency
- **Styling** -- Tailwind CSS v4 with `@custom-variant dark` class strategy
- **Animations** -- `motion/react` (Framer Motion v12)
- **Drag & Drop** -- `@dnd-kit` for menu reordering

## Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `CustomerPage` | Customer landing, rewards, ordering |
| `/dashboard` | `DashboardPage` | Owner management (redirects to login if unauthed) |

## Key Patterns

### Theme / Dark Mode
- Blocking script in `index.html` sets `.dark` class before React boots
- React state syncs with `document.documentElement.classList` via useEffect
- `theme-transitioning` class enables 400ms CSS transitions during toggle
- All components use Tailwind `dark:` prefix for dark mode styles
- Persisted in `localStorage.theme`

### Menu System
- **Draft/Publish workflow**: owner edits a draft; customers see the published snapshot
- **Edit mode**: `config.menu_editing_active` flag -- while true, public API serves draft; when turned off, auto-publishes
- **5 presets**: each stores a full snapshot (menu items, ordering, images, published versions)
- **Ordering**: category_order and subcategory_order stored separately in `menu-ordering` blob
- **Images**: uploaded as blobs, compressed client-side (WebP/JPEG, max 800px, <200KB)

### Authentication
- Custom HMAC JWT (not a standard library) in `_shared/auth.ts`
- Token stored in `localStorage.owner_token`
- Roles: owner (password/primary Google), admin, secondary Google accounts
- `requireOwner()` middleware validates tokens in protected endpoints

### API Conventions
- All API functions in `src/lib/api.ts`
- Owner endpoints use `authRequest()` (auto-attaches Bearer token)
- Public endpoints use `publicRequest()` (no auth header)
- All requests use `cache: "no-store"` and JSON content-type

### Cart
- Global state via `CartContext` (React Context)
- Persisted in `localStorage.bnb_cart`
- Used by MenuOverlay (customer) and POSTab (dashboard)

### Backup/Restore
- Export: JSON + CSV + images in a ZIP (`jszip`)
- Import: supports ZIP or plain JSON, "overwrite" or "combine" modes
- Restore points: saved to `backup` blob key via `?save=true`
- Covers all data: menu (draft+published), ordering, presets, images, customers, orders, visits, config

## Shared Backend Utilities (`netlify/functions/_shared/`)

| File | Purpose |
|------|---------|
| `auth.ts` | JWT create/verify, role checks, `requireOwner()` middleware |
| `store.ts` | Netlify Blobs wrapper -- all data keys, getJSON/setJSON, image helpers |
| `types.ts` | Backend TypeScript types (MenuItem, Customer, Order, etc.) |
| `totp.ts` | TOTP generation/verification (otpauth library) |
| `menu-sort.ts` | Sort order normalization for menu items |
| `menu-ordering.ts` | Category/subcategory ordering validation + sanitization |
| `menu-presets.ts` | 5-slot preset system (snapshot, activate, sync) |
| `backup-archive.ts` | ZIP archive creation/extraction |
| `backup-data.ts` | Backup import/restore logic |

## Frontend Lib (`src/lib/`)

| File | Purpose |
|------|---------|
| `api.ts` | All API endpoint functions (auth, menu, orders, customers, rewards, backup) |
| `types.ts` | Frontend TypeScript interfaces |
| `constants.ts` | Category labels, menu layout derivation, order status flow |
| `image-utils.ts` | Canvas-based image resize (WebP with JPEG fallback) |
| `backup-utils.ts` | Client-side ZIP generation, CSV flattening, file parsing |

## Testing

- **Framework**: Playwright with Chromium
- **Config**: `playwright.config.ts` -- base URL `http://localhost:8888`, 30s timeout
- **Helpers**: `tests/helpers.ts` -- login, CRUD, preset, backup test utilities
- **Test files**:
  - `landing.spec.ts` -- customer page rendering
  - `dashboard.spec.ts` -- dashboard tabs, orders, settings
  - `banners.spec.ts` -- CTA and social banners
  - `new-features.spec.ts` -- menu presets, ordering, backup/restore, publish flow

## Polling Intervals

| Feature | Interval | Location |
|---------|----------|----------|
| Order status (customer) | 5s | CustomerPage |
| Order list (dashboard) | 5s | DashboardPage |
| Menu items (customer overlay) | 3s | MenuOverlay |
| Ordering enabled config | 3s | CustomerPage |
| Customer rewards data | 10s | RewardsBanner |
| Order history | 10s | OrderHistory |
| Customer list | 10s | CustomersTab |
| Menu items (POS) | 10s | POSTab |

## Environment Variables

| Variable | Required | Used In |
|----------|----------|---------|
| `GOOGLE_CLIENT_ID` | Yes | Frontend (Google Sign-In) + Backend (token verification) |
| `GEMINI_API_KEY` | No | Injected by AI Studio at runtime |
| `JWT_SECRET` | No | Backend (`_shared/auth.ts`), defaults to hardcoded value |
| `DISABLE_HMR` | No | `vite.config.ts` -- set to `"true"` to disable hot reload |

## Default Credentials

- **Owner password**: `bonesandbru2024`
- **Admin password**: `bonesandbruadmin`

These are auto-hashed on first login and stored in the config blob.
