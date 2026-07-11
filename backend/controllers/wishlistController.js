const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');
const { embedText, toVectorLiteral } = require('../services/embeddings');

const createSchema = z.object({ queryText: z.string().trim().min(2).max(200) });
const idSchema = z.object({ id: z.coerce.number().int().positive() });

function serializeAlert(row) {
  return { id: row.id, queryText: row.query_text, createdAt: row.created_at };
}

// POST /wishlist-alerts — embed the wish so new listings can match it.
async function create(req, res) {
  const { queryText } = parse(createSchema, req.body);

  let vector;
  try {
    vector = toVectorLiteral(await embedText(queryText));
  } catch (err) {
    throw new HttpError(502, 'AI_UNAVAILABLE', 'Could not process wishlist alert — try again');
  }

  const { rows } = await pool.query(
    `INSERT INTO wishlist_alerts (user_id, query_text, query_embedding)
     VALUES ($1, $2, $3::vector) RETURNING *`,
    [req.session.userId, queryText, vector]
  );
  res.status(201).json({ alert: serializeAlert(rows[0]) });
}

// GET /wishlist-alerts
async function list(req, res) {
  const { rows } = await pool.query(
    'SELECT * FROM wishlist_alerts WHERE user_id = $1 ORDER BY created_at DESC',
    [req.session.userId]
  );
  res.json({ alerts: rows.map(serializeAlert) });
}

// DELETE /wishlist-alerts/:id
async function remove(req, res) {
  const { id } = parse(idSchema, req.params);
  const result = await pool.query(
    'DELETE FROM wishlist_alerts WHERE id = $1 AND user_id = $2',
    [id, req.session.userId]
  );
  if (result.rowCount === 0) throw new HttpError(404, 'NOT_FOUND', 'Alert not found');
  res.json({ ok: true });
}

module.exports = { create, list, remove };
