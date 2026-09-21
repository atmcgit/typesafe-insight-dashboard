// Vercel serverless function — vite.config.js'deki geliştirme proxy'sinin üretim
// karşılığı. API anahtarı yalnızca burada, sunucu tarafında okunur; istemciye
// hiçbir zaman gönderilmez. Aynı /api/typesafe yoluna gittiği için
// src/typesafeClient.js'de değişiklik gerekmez.

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Yalnızca POST desteklenir.' });
    return;
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: 'TYPESAFE_API_KEY ortam değişkeni Vercel projesinde tanımlı değil.' });
    return;
  }

  try {
    const upstream = await fetch(process.env.TYPESAFE_API_URL || 'https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(request.body),
    });
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    response.send(text);
  } catch (error) {
    response.status(502).json({ error: error.message || 'TypeSafe API proxy bağlantısı başarısız.' });
  }
}
