# Budgetly

Budgetly is a personal finance tracking web app that helps users manage expenses and understand their spending habits.

## Features

- **Add and Save Expenses** — Log transactions with an amount, category, and date
- **View Transaction History** — Browse a clear, chronological list of all recorded expenses
- **Budget Summary Dashboard** — Get an overview of total spending and remaining budget
- **Spending Charts by Category** — Visualise where money goes with category-based charts
- **Search and Filter Transactions** — Find specific transactions by keyword, category, or date

## Tech Stack

- HTML
- CSS
- JavaScript

## Project Structure

```
budgetly/
├── index.html    # Main landing page
├── style.css     # Styles and responsive layout
├── script.js     # JavaScript interactions
├── README.md     # Project documentation
└── .gitignore    # Git ignore rules
```

## Getting Started

Open `index.html` in any modern browser. No build tools or dependencies required.

## Live Demo

[https://budgetly-sage.vercel.app](https://budgetly-sage.vercel.app)

---

## AI Budget Insights

### What it does

The **Analyze Budget** button on the Finance Hub page sends your current month's income and expense data to an AI and gets back a short, plain-English analysis — 2 to 4 sentences that are specific to your actual numbers. It mentions your biggest spending category, whether your balance looks healthy, and one concrete observation you can act on. It won't give you generic advice like "try to save more." Everything it says is grounded in the data you've entered.

### How it works

1. When you click **Analyze Budget**, the app collects all transactions for the current month and groups them by category.
2. That data (totals + category breakdown) is sent as a POST request to `/analyze-budget`.
3. The server builds a prompt with your numbers and sends it to the Claude API (claude-haiku).
4. The response is displayed in the result box below the button.

In production (Vercel), the request goes to a serverless function at `api/analyze-budget.js`. Locally, it hits an Express server running on port 3001. Vite automatically proxies `/analyze-budget` to that server during development, so the frontend code is the same in both environments.

### Caching

The app remembers the last result in memory. If you click **Analyze Budget** again without adding or changing any transactions, it skips the API call and shows the previous result instantly with a **"Loaded from cache"** label. If your data has changed since the last analysis, it fetches a fresh response and shows **"Fresh analysis"**. The cache resets when you reload the page.

### Environment variables

Create a `.env` file in the project root (it's already gitignored):

```
ANTHROPIC_API_KEY=your_api_key_here
```

Get a free API key at [console.anthropic.com](https://console.anthropic.com). The key is only used server-side and is never exposed to the browser.

For Vercel deployment, add the same variable in your project's **Settings → Environment Variables** panel instead of the `.env` file.

### Running locally

You need two terminals — one for the frontend, one for the AI server:

```bash
# Terminal 1 — Express server (handles the /analyze-budget route)
node server.js

# Terminal 2 — Vite dev server (frontend)
npm run dev
```

Then open `http://localhost:5173`, go to the Finance Hub, add a few transactions, and click **Analyze Budget**.

> **Note:** If you only run `npm run dev` without `node server.js`, the Analyze Budget button will fail with a connection error. Both servers need to be running at the same time for local development.
