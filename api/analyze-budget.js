// Budgetly — AI Budget Insights (Vercel Serverless Function)
// Deployed at: /analyze-budget  (rewritten from vercel.json)

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

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

    res.status(200).json({ insight: message.content[0].text });
  } catch (err) {
    console.error('Anthropic error:', err);
    res.status(500).json({ error: 'Failed to generate insight. Check your API key.' });
  }
}
