// BudgetCore — AI Budget Insights (Vercel Serverless Function)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { income, expenses, balance, incomeByCategory, expensesByCategory, month } = req.body;

  if (typeof income !== 'number' || typeof expenses !== 'number') {
    return res.status(400).json({ error: 'income and expenses must be numbers.' });
  }
  if (!isFinite(income) || !isFinite(expenses)) {
    return res.status(400).json({ error: 'income and expenses must be finite numbers.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 220,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(500).json({ error: `Anthropic API error: ${response.status}` });
    }

    const data = await response.json();
    res.status(200).json({ insight: data.content[0].text });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err?.message || 'Request failed' });
  }
}
