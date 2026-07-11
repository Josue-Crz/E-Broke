// Embeddings via DigitalOcean Gradient (OpenAI-compatible /embeddings).
// ONE model is used everywhere (listings, search queries, wishlist alerts) —
// mixing embedding models breaks cosine similarity.
// gte-large-en-v1.5 → 1024 dims; must match vector(1024) in the schema.

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gte-large-en-v1.5';

async function embedText(text) {
  const response = await fetch(`${process.env.VISION_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VISION_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Gradient embeddings error ${response.status}: ${body}`);
    throw new Error(`Embeddings API returned ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// pgvector accepts vectors as a '[0.1,0.2,...]' string literal.
function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

module.exports = { embedText, toVectorLiteral, EMBEDDING_MODEL };
