const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');

const idSchema = z.object({ id: z.coerce.number().int().positive() });

// GET /notifications — mine, newest first.
async function list(req, res) {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.session.userId]
  );
  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: r.payload,
      readAt: r.read_at,
      createdAt: r.created_at,
    })),
  });
}

// POST /notifications/:id/read
async function markRead(req, res) {
  const { id } = parse(idSchema, req.params);
  const result = await pool.query(
    'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2',
    [id, req.session.userId]
  );
  if (result.rowCount === 0) throw new HttpError(404, 'NOT_FOUND', 'Notification not found');
  res.json({ ok: true });
}

module.exports = { list, markRead };
