export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resume } = req.body;

  if (!resume || resume.trim().length < 50) {
    return res.status(400).json({ error: 'Resume text too short' });
  }

  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are an expert resume coach and ATS (Applicant Tracking System) specialist with 15 years of experience. Analyze this resume and respond with ONLY a valid JSON object — no extra text, no markdown, no code blocks.

Resume:
${resume}

Respond with exactly this JSON structure:
{
  "score": <number 0-100>,
  "issues": [<5 to 8 specific problems as strings>],
  "strengths": [<3 to 5 specific strengths as strings>],
  "keywords_found": [<6 to 10 keywords already in the resume>],
  "keywords_missing": [<6 to 10 important missing keywords for this type of role>],
  "rewrite": "<improved version of the resume as plain text, keeping all real info but making it much stronger>"
}

Be specific, honest, and helpful. Reference actual content from their resume in your feedback.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://resumeai.vercel.app',
        'X-Title': 'ResumeAI'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', errText);
      return res.status(500).json({ error: 'AI service error' });
    }

    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('JSON parse failed:', rawText);
      return res.status(500).json({ error: 'Could not parse AI response' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
