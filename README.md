# BudgetCore

BudgetCore is a personal finance tracking web app that helps users manage income and expenses, understand spending habits, and work toward savings goals.

## Live Demo

[https://budgetcore.net](https://budgetcore.net)

---

## Features

- **Authentication** — Sign up / sign in with Firebase Auth; sessions persist across page reloads
- **Add Income & Expenses** — Log transactions with description, amount, category, and date
- **Transaction History** — Browse, search, and filter all recorded transactions
- **Budget Dashboard** — Overview of total income, expenses, and current balance
- **Spending Charts** — Category-based pie/bar charts showing where money goes
- **Goals Tracker** — Create savings goals and track progress toward each one
- **User Profile** — Update display name and avatar
- **AI Budget Insights** — One-click analysis of your current month powered by Claude (Haiku)
- **Guest Mode** — Try the app without creating an account; data is in-memory only

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Build tool | Vite |
| Auth & Database | Firebase Authentication + Firestore |
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
├── script.js           # Shared utilities
├── style.css           # Global styles
├── transitions.js      # Page transition animations
├── avatarUtils.js      # Avatar generation helpers
├── firebase.js         # Firebase initialisation
├── firestore.rules     # Firestore security rules
├── server.js           # Local Express server (AI proxy)
├── vite.config.js      # Vite build config
├── vercel.json         # Vercel routing config
├── api/
│   └── analyze-budget.js   # Vercel serverless function (AI)
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Authentication and Firestore enabled
- An Anthropic API key (for AI insights — optional)

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root (already gitignored):

```
ANTHROPIC_API_KEY=your_api_key_here
```

Get a free key at [console.anthropic.com](https://console.anthropic.com). The key is only used server-side and never exposed to the browser.

For Vercel, add it in **Settings → Environment Variables** instead.

### Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project → enable **Authentication** (Email/Password)
3. Create a **Firestore Database** (Production mode)
4. Paste the rules from `firestore.rules` into **Firestore → Rules** and publish

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

## Firestore Security Rules

Each user can only read and write their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

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
