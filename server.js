// BudgetCore — AI Budget Insights Express server (local dev)
// Run with: node server.js
// Proxied automatically by Vite during `npm run dev`

import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app    = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/analyze-budget', async (req, res) => {
  const { income, expenses, balance, incomeByCategory, expensesByCategory, month } = req.body;

  // Validate that income and expenses are present and usable numbers
  if (typeof income !== 'number' || typeof expenses !== 'number') {
    return res.status(400).json({ error: 'income and expenses must be numbers.' });
  }
  if (!isFinite(income) || !isFinite(expenses)) {
    return res.status(400).json({ error: 'income and expenses must be finite numbers.' });
  }

  const formatCats = (obj) =>
    Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amt]) => `  • ${cat}: $${Number(amt).toFixed(2)}`)
      .join('\n') || '  (none)';

  const prompt = `Analyze the budget data below for ${month || 'this month'} and write 2–4 sentences. Base your response only on the numbers provided — do not introduce assumptions or outside context.

Requirements:
- Cite specific dollar amounts and category names from the data.
- If expenses exceed income, identify the single largest cost driver by name and amount.
- If the balance is positive, state whether the savings rate (balance ÷ income) is strong, moderate, or thin, and why.
- Close with one concrete, data-grounded observation — something the user can act on given these exact figures.
- Write plain prose only. No bullet points, no headers, no markdown.
- Do not use filler phrases like "Great job!", "Consider saving more", or "It's important to budget".

Income: $${Number(income).toFixed(2)} | Expenses: $${Number(expenses).toFixed(2)} | Balance: $${Number(balance).toFixed(2)}

Expense categories:
${formatCats(expensesByCategory || {})}

Income sources:
${formatCats(incomeByCategory || {})}`;

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 220,
      messages:   [{ role: 'user', content: prompt }],
    });

    res.json({ insight: message.content[0].text });
  } catch (err) {
    console.error('Anthropic error:', err);
    res.status(500).json({ error: 'Failed to generate insight. Check your API key.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`BudgetCore AI server running → http://localhost:${PORT}`),
);
