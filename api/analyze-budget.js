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

  const isDeficit = Number(balance) < 0;

  const prompt = `Analyze the budget data below for ${month || 'this month'}. Base everything only on the numbers provided — do not introduce assumptions, outside context, or invent any dollar amounts.

Respond with ONLY a single JSON object, no markdown code fences, no prose before or after. Shape exactly:
{
  "keyInsight": "one sentence, cites a specific category and either a dollar amount or percentage of spending from the data",
  "expenseTip": { "title": "3-5 word title", "description": "one sentence, a concrete way to reduce spending grounded in the actual top expense category/categories" },
  "incomeTip": { "title": "3-5 word title", "description": "one sentence${isDeficit
    ? ', a concrete way to add or increase income so it covers the fixed costs shown'
    : ', a concrete way to put the surplus to work (saving, investing, or paying down debt)'}" }
}

Rules:
- "keyInsight" must name the actual category driving the result (the largest expense category if in deficit, or explain the savings rate if positive) with its real dollar amount or percentage.
- Titles are short noun phrases (e.g. "Lower monthly expenses"), not full sentences.
- No filler like "Great job!" or "It's important to budget". No markdown, no bullet points inside the JSON strings.

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
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(500).json({ error: `Anthropic API error: ${response.status}` });
    }

    const data = await response.json();
    const raw = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error('Failed to parse AI JSON response:', raw);
      return res.status(502).json({ error: 'The AI response was malformed. Please try again.' });
    }

    if (!parsed.keyInsight || !parsed.expenseTip?.title || !parsed.incomeTip?.title) {
      console.error('AI JSON response missing required fields:', parsed);
      return res.status(502).json({ error: 'The AI response was incomplete. Please try again.' });
    }

    res.status(200).json({
      keyInsight: parsed.keyInsight,
      expenseTip: parsed.expenseTip,
      incomeTip:  parsed.incomeTip,
    });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err?.message || 'Request failed' });
  }
}
