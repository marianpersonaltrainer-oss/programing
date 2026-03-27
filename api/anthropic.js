/**
 * VERCEL SERVERLESS FUNCTION: api/anthropic.js
 * Bridges the frontend and Anthropic API securely.
 */
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { model, max_tokens, system, messages } = req.body
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ 
      error: { message: 'VITE_ANTHROPIC_API_KEY no configurada en el servidor (Vercel).' } 
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: max_tokens || 8000,
        system,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic API Error:', data)
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Serverless Function Error:', error)
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor al conectar con la IA.' } 
    })
  }
}
