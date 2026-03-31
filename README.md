# Bones & Bru

Full-stack web application for **Bones & Bru**, a coffee shop with pet hangout. Provides a customer-facing ordering and rewards experience alongside an owner dashboard for managing the menu, orders, customers, and business settings.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion (Framer Motion)
- **Backend:** Netlify Functions (serverless), Netlify Blobs (storage)
- **Auth:** Custom JWT + Google OAuth, bcrypt password hashing
- **Testing:** Playwright E2E
- **Icons:** Lucide React
- **Drag & Drop:** @dnd-kit

## Getting Started

### Prerequisites

- Node.js 22+
- Netlify CLI (`npm install -g netlify-cli` or included as devDependency)

### Setup

```bash
npm install
npx playwright install   # for E2E tests
```

Create a `.env` file (see `.env.example`):

```
GOOGLE_CLIENT_ID=your-google-client-id
```

### Development

```bash
npm run dev          # Starts Netlify Dev (frontend + functions) on http://localhost:8888
npm run dev:vite     # Vite-only frontend on http://localhost:3000 (no functions)
```

### Build & Preview

```bash
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run clean        # Remove dist/
```

### Testing

```bash
npm run test:e2e          # Headless Playwright tests
npm run test:e2e:headed   # Playwright with browser UI
```

### Linting

```bash
npm run lint         # TypeScript type check (tsc --noEmit)
```

## Project Structure

```
BnB/
├── src/
│   ├── main.tsx                    # Entry point (BrowserRouter)
│   ├── App.tsx                     # Routes: / and /dashboard
│   ├── index.css                   # Tailwind config, theme variables, transitions
│   ├── pages/
│   │   ├── CustomerPage.tsx        # Customer landing page
│   │   ├── DashboardPage.tsx       # Owner dashboard (6-tab interface)
│   │   └── DashboardLoginPage.tsx  # Owner/admin login
│   ├── components/
│   │   ├── landing/                # Customer-facing UI
│   │   │   ├── HeroSection.tsx     # Rotating background hero + logo
│   │   │   ├── ThemeToggle.tsx     # Dark/light mode toggle
│   │   │   ├── FloatingDecorations.tsx  # Decorative blurs + footprint GIFs
│   │   │   ├── CTABanner.tsx       # "Shop Online" link
│   │   │   ├── SocialGrid.tsx      # Social media links (4 platforms)
│   │   │   ├── WalkthroughButton.tsx    # Virtual walkthrough video
│   │   │   └── Footer.tsx          # Location, contacts, QR code
│   │   ├── order/
│   │   │   ├── InCafeBanner.tsx    # In-cafe order CTA + live tracking
│   │   │   └── MenuOverlay.tsx     # Full menu browser + checkout
│   │   ├── rewards/
│   │   │   ├── RewardsBanner.tsx   # Rewards progress + actions
│   │   │   ├── RewardsLogin.tsx    # Customer login (name/phone/email)
│   │   │   ├── VerifyVisit.tsx     # OTP/QR code verification
│   │   │   └── OrderHistory.tsx    # Customer's recent orders
│   │   ├── dashboard/
│   │   │   ├── OTPTab.tsx          # TOTP code + QR display
│   │   │   ├── POSTab.tsx          # Point-of-sale for walk-ins
│   │   │   ├── CustomersTab.tsx    # Customer database management
│   │   │   ├── MenuTab.tsx         # Menu editor (drag-drop, images, presets)
│   │   │   └── SettingsTab.tsx     # Passwords, Google accounts, backups
│   │   └── ui/
│   │       ├── Modal.tsx           # Reusable modal with mobile gestures
│   │       ├── Toast.tsx           # Toast notification system
│   │       └── CircularProgress.tsx # Visit progress ring
│   ├── contexts/
│   │   └── CartContext.tsx          # Shopping cart (localStorage-backed)
│   └── lib/
│       ├── api.ts                   # All API endpoint functions
│       ├── types.ts                 # TypeScript interfaces
│       ├── constants.ts             # Categories, ordering logic, labels
│       ├── image-utils.ts           # Canvas-based image resizing
│       └── backup-utils.ts          # ZIP backup generation/parsing
├── netlify/functions/               # Serverless API (see API section)
│   ├── _shared/                     # Shared utilities (auth, store, types)
│   ├── auth-*.ts                    # Authentication endpoints
│   ├── menu-*.ts                    # Menu CRUD, ordering, presets, images
│   ├── orders-*.ts                  # Order management
│   ├── customers-*.ts               # Customer database
│   ├── rewards-check.ts             # Rewards lookup/creation
│   ├── totp-*.ts                    # TOTP generation/verification
│   ├── config-*.ts                  # Public/private config
│   └── backup-*.ts                  # Export/import/restore
├── tests/                           # Playwright E2E tests
├── public/                          # Static assets (images, video)
├── index.html                       # HTML entry (includes theme init script)
├── vite.config.ts                   # Vite + Tailwind + env config
├── netlify.toml                     # Netlify build/dev/deploy config
└── playwright.config.ts             # E2E test config
```

## Features

### Customer Side (`/`)

- **Hero Section** with rotating background image carousel
- **Rewards Program** -- 10-visit loyalty system with free drink rewards
  - Login by name + phone/email
  - Visit verification via 6-digit OTP or QR scan
  - Reward redemption via the same OTP/QR flow
  - Circular progress ring showing visits toward next reward
  - Order history viewer
- **In-Cafe Ordering** -- browse the menu, select options, checkout
  - Real-time order status tracking (Received -> Preparing -> Ready -> Completed)
  - Category and subcategory browsing
  - Menu item options with price extras
- **Shop Online CTA** linking to the external storefront
- **Social Links** grid (Google Reviews, Instagram, Facebook, TikTok)
- **Virtual Walkthrough** video modal
- **Dark/Light Mode** with system preference detection and smooth transitions
- **Footer** with location, contacts, vCard download, QR code

### Dashboard (`/dashboard`)

- **OTP/QR Tab** -- displays the current 6-digit TOTP code and QR for customers to scan
- **Orders Tab** -- view, filter (source/status/date/search), update status, delete/restore orders
- **POS Tab** -- create orders for walk-in customers, select existing/new customers, apply free rewards
- **Customers Tab** -- search, view details, edit info, merge duplicates, delete
- **Menu Tab** -- full menu editor with:
  - Create/edit/delete items with name, description, price, category, subcategory, options
  - Image upload with automatic compression (WebP/JPEG, max 800px)
  - Drag-and-drop reordering for items, categories, and subcategories
  - 5 menu presets with editable titles (e.g., Breakfast, Lunch)
  - Draft/publish workflow -- changes are only visible to customers after publishing
  - Edit mode toggle to prevent accidental changes
- **Settings Tab** -- change passwords, manage Google OAuth accounts, backup/restore

### Backup & Restore

- **Full export** as ZIP (JSON + CSV + images) or JSON
- **Import** with overwrite or combine modes
- **Restore points** saved to cloud storage for quick recovery
- Covers: menu (draft + published), ordering, presets, images, customers, orders, visits, config

## API Endpoints

All endpoints are Netlify Functions at `/.netlify/functions/`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | auth-login | No | Owner/admin password login |
| GET | auth-verify | Yes | Verify JWT token |
| GET | auth-settings | Yes | Get auth settings + accounts |
| POST | auth-change-password | Yes | Change owner/admin password |
| POST | auth-google | No | Google OAuth login |
| POST | auth-link-google | Yes | Add/remove/replace Google accounts |
| GET | config-public | No | Get ordering + edit mode flags |
| PUT | config-update | Yes | Update config |
| GET | totp-generate | Yes | Get current TOTP code + QR |
| POST | totp-verify | No | Verify visit or redeem reward |
| GET | menu-list | Optional | Draft (owner) or published (public) menu |
| POST/PUT/DELETE | menu-manage | Yes | Create/update/soft-delete items |
| GET/POST/DELETE | menu-image | Mixed | Upload/serve/delete item images |
| POST | menu-publish | Yes | Publish draft to customers |
| GET/PUT | menu-ordering | Yes (PUT) | Category/subcategory ordering |
| PUT | menu-reorder | Yes | Bulk update item sort orders |
| GET/PUT/POST | menu-presets | Yes | Menu preset management (5 slots) |
| POST | orders-create | No | Create order (customer or POS) |
| GET | orders-list | Yes | List orders with filters |
| PUT | orders-update | Yes | Update order status |
| DELETE | orders-delete | Yes | Permanently delete order |
| GET | orders-status | No | Public order status check |
| GET | orders-history | No | Customer's recent orders |
| GET | customers-list | Yes | List all customers |
| GET | customers-get | Yes | Get customer with orders/visits |
| PUT | customers-update | Yes | Update customer info |
| POST | customers-merge | Yes | Merge two customer records |
| DELETE | customers-delete | Yes | Delete customer |
| POST | rewards-check | No | Lookup/create customer for rewards |
| GET | backup-export | Yes | Export full backup |
| POST | backup-import | Yes | Import backup data |
| POST | backup-restore | Yes | Restore from saved backup |
| GET | backup-status | Yes | Check if backup exists |

## Authentication

- **Owner login:** password-based (default: `bonesandbru2024`)
- **Admin login:** separate password (default: `bonesandbruadmin`)
- **Google OAuth:** up to 4 linked accounts (primary, secondary, admin roles)
- **JWT tokens:** 24-hour expiry, HMAC-signed
- **Role hierarchy:** Owner (full access) > Admin (limited settings) > Secondary (read + operate)

## Data Storage

All data is stored in **Netlify Blobs** (`bnb-data` store):
- `menu` / `menu-published` -- draft and published menu items
- `menu-ordering` / `menu-ordering-published` -- category/subcategory ordering
- `menu-image-{id}` / `menu-image-published-{id}` -- item images
- `menu-presets` -- 5 preset snapshots
- `customers`, `orders`, `visits` -- business data
- `config` -- app configuration (TOTP secret, passwords, flags)
- `backup` -- latest restore point

## Deployment

Deployed to **Netlify** via `netlify.toml`:
- Build command: `npm run build`
- Publish directory: `dist/`
- Functions bundled with esbuild
- SPA redirect: `/* -> /index.html`

## Dark Mode

- Blocking `<script>` in `index.html` prevents flash on load
- State persisted to `localStorage.theme`
- Falls back to `prefers-color-scheme` system preference
- Smooth 400ms CSS transitions during toggle via `theme-transitioning` class
- Tailwind `dark:` variant used throughout all components
