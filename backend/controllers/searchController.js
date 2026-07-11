const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');
const { serializeListing } = require('../utils/serialize');
const { embedText, toVectorLiteral } = require('../services/embeddings');

const searchSchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /search?q=...
// Semantic search: embed the query with the same Gradient model used for
// listings, rank by cosine similarity (pgvector <=> is cosine DISTANCE, so
// similarity = 1 - distance), and blend in a small keyword boost so exact
// title/description matches float to the top.
async function search(req, res) {
  const { q, limit } = parse(searchSchema, req.query);

  let vector;
  try {
    vector = toVectorLiteral(await embedText(q));
  } catch (err) {
    throw new HttpError(502, 'AI_UNAVAILABLE', 'Search is temporarily unavailable — try again');
  }

  // Drop weak matches so "N matches found" means actual matches.
  // Tune per embedding model: gte-large puts related text ~0.55+, noise ~0.4.
  const minScore = Number(process.env.SEARCH_MIN_SCORE || 0.45);

  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT l.*, u.name AS owner_name, u.avatar_url AS owner_avatar_url,
              (1 - (l.embedding <=> $1::vector))
                + (CASE WHEN l.title ILIKE $2 OR l.description ILIKE $2 THEN 0.15 ELSE 0 END)
                AS score
         FROM listings l JOIN users u ON u.id = l.user_id
        WHERE l.status = 'active' AND l.embedding IS NOT NULL
     ) ranked
     WHERE score >= $4
     ORDER BY score DESC
     LIMIT $3`,
    [vector, `%${q}%`, limit, minScore]
  );

  res.json({
    query: q,
    results: rows.map((row) => ({ ...serializeListing(row), score: Number(Number(row.score).toFixed(3)) })),
  });
}

module.exports = { search };
