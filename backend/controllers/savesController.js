const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');
const { serializeListing } = require('../utils/serialize');

const idSchema = z.object({ id: z.coerce.number().int().positive() });

// POST /listings/:id/save
async function save(req, res) {
  const { id } = parse(idSchema, req.params);
  const listing = await pool.query("SELECT id FROM listings WHERE id = $1 AND status <> 'removed'", [id]);
  if (!listing.rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');

  await pool.query(
    'INSERT INTO saves (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.session.userId, id]
  );
  res.status(201).json({ ok: true });
}

// DELETE /listings/:id/save
async function unsave(req, res) {
  const { id } = parse(idSchema, req.params);
  await pool.query('DELETE FROM saves WHERE user_id = $1 AND listing_id = $2', [req.session.userId, id]);
  res.json({ ok: true });
}

// GET /me/saved
async function listSaved(req, res) {
  const { rows } = await pool.query(
    `SELECT l.*, u.name AS owner_name, u.avatar_url AS owner_avatar_url, s.created_at AS saved_at
       FROM saves s
       JOIN listings l ON l.id = s.listing_id AND l.status <> 'removed'
       JOIN users u ON u.id = l.user_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC`,
    [req.session.userId]
  );
  res.json({ listings: rows.map((r) => ({ ...serializeListing(r), savedAt: r.saved_at })) });
}

module.exports = { save, unsave, listSaved };
