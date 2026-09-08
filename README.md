# BudgetCore

BudgetCore is a personal finance tracking web app that helps users manage income and expenses, understand spending habits, and work toward savings goals.

## Live Demo

[https://budgetcore.net](https://budgetcore.net)

---

## Features

- **Authentication** — Email/password, Google, and Apple sign-in via Supabase Auth; sessions persist across page reloads
- **Add Income & Expenses** — Log transactions with description, amount, category, and date
- **Transaction History** — Browse, search, and filter all recorded transactions
- **Budget Dashboard** — Overview of total income, expenses, and current balance
- **Spending Charts** — Category-based pie/bar charts showing where money goes
- **Goals Tracker** — Create savings goals and track progress toward each one
- **User Profile** — Update display name and avatar
- **AI Budget Insights** — One-click analysis of your current month powered by Claude (Haiku)
- **Welcome & Recovery Email** — A branded welcome email on signup and a password-recovery flow, both via Resend
- **Guest Mode** — Try the app without creating an account; data is in-memory only

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Build tool | Vite |
| Auth & Database | Supabase Authentication (Email, Google, Apple) + Postgres (RLS) |
| Transactional Email | Resend |
| AI Analysis | Anthropic Claude API (Haiku) |
| Hosting | Vercel (serverless functions) |

---

## Project Structure

```
budgetcore/
├── index.html          # Landing / auth page
├── index.js            # Auth logic
├── app.html            # Main dashboard (transactions + chart)
├── app.js              # Dashboard logic
├── goals.html          # Savings goals page
├── goals.js            # Goals logic
├── profile.html        # User profile page
├── profile.js          # Profile logic
├── reset-password.html # Password-recovery landing page
├── reset-password.js   # Password-recovery logic
├── script.js           # Shared utilities
├── style.css           # Global styles
├── transitions.js      # Page transition animations
├── avatarUtils.js      # Avatar generation helpers
├── supabase.js         # Supabase client initialisation
├── supabase/
│   └── migrations/0001_init.sql   # Postgres schema + RLS policies
├── server.js           # Local Express server (AI proxy)
├── vite.config.js      # Vite build config
├── vercel.json         # Vercel routing config
├── api/
│   ├── analyze-budget.js      # Vercel serverless function (AI)
│   ├── send-welcome-email.js  # Welcome email (Supabase DB webhook → Resend)
│   ├── delete-account.js      # Self-service account deletion (service-role key)
│   └── weekly-digest.js       # Weekly spending digest cron (Resend)
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- A Resend account (for welcome and recovery-adjacent emails)
- An Anthropic API key (for AI insights — optional)

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env.local` file in the project root (already gitignored):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-side only
RESEND_API_KEY=your_resend_api_key
WELCOME_EMAIL_SECRET=a_random_secret_shared_with_the_supabase_webhook
ANTHROPIC_API_KEY=your_anthropic_api_key
```

For Vercel, add the same variables in **Settings → Environment Variables** instead.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com) → copy the Project URL and anon key from **Project Settings → API**
2. Paste the contents of `supabase/migrations/0001_init.sql` into **SQL Editor** and run it — this creates the tables, RLS policies, and the new-user trigger
3. **Authentication → Providers**: enable **Email** (turn off "Confirm email" to keep instant sign-up), **Google**, and **Apple**
   - Google: create an OAuth client in Google Cloud Console with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`
   - Apple: create a Services ID + Sign-in-with-Apple key in your Apple Developer account, using the same callback URL
4. **Authentication → URL Configuration**: set Site URL to your production domain and add `/reset-password.html` as a redirect URL
5. **Database → Webhooks**: create a webhook on `auth.users` `INSERT` → HTTP POST to `/api/send-welcome-email`, with header `Authorization: Bearer <WELCOME_EMAIL_SECRET>` (same value as the env var)

### Running locally

Two terminals are required — one for the frontend, one for the AI server:

```bash
# Terminal 1 — Express server (handles /analyze-budget)
node server.js

# Terminal 2 — Vite dev server
npm run dev
```

Then open `http://localhost:5173`.

> If you skip `node server.js`, the Analyze Budget button will fail. Both servers must run simultaneously for local development.

### Build for production

```bash
npm run build
```

Output goes to `dist/`.

---

## Database Schema & Row Level Security

Every user-owned table (`transactions`, `goals`, `investments`, `networth`, `challenges`) has a `user_id` column referencing `auth.users` plus an owner-only RLS policy, and the `profiles` table (keyed by `id = auth.users.id`) holds settings that used to live across several Firestore documents. See `supabase/migrations/0001_init.sql` for the full schema, including the `handle_new_user()` trigger that creates a profile row the moment someone signs up.

---

## AI Budget Insights

The **Analyze Budget** button on the dashboard sends your current month's totals and category breakdown to Claude (Haiku) and returns a 2–4 sentence plain-English analysis — specific to your actual numbers, not generic advice.

**How it works:**

1. The app collects all transactions for the current month and groups them by category
2. That data is sent as a POST request to `/analyze-budget`
3. The server builds a prompt and calls the Claude API
4. The result is displayed below the button

**Caching:** The last result is cached in memory. If no transactions changed since the last analysis, the cached result is shown instantly with a "Loaded from cache" label.

---

## Deploying to Vercel

```bash
npm run build
npx vercel --prod
```

Vercel automatically routes `/analyze-budget` to `api/analyze-budget.js` as a serverless function.
