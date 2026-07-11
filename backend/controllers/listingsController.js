const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');
const { serializeListing } = require('../utils/serialize');
const { checkFreeOnly, llmModerate } = require('../services/moderation');
const { embedText, toVectorLiteral } = require('../services/embeddings');
const { createNotification, matchWishlistAlerts } = require('../services/notify');

const CATEGORIES = ['dorm_essentials', 'textbooks', 'electronics', 'furniture', 'food', 'other'];
const CONDITIONS = ['like_new', 'good', 'fair'];

const listQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  neighborhood: z.string().trim().min(1).optional(),
  free_today: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  neighborhood: z.string().trim().max(120).optional(),
  photoUrls: z.array(z.string().url()).max(6).default([]),
});

const updateSchema = createSchema.partial();

const idSchema = z.object({ id: z.coerce.number().int().positive() });

// Moderation + embedding shared by create and update.
function enforceFreeOnly(title, description, neighborhood) {
  const check = checkFreeOnly(title, description, neighborhood);
  if (!check.ok) throw new HttpError(422, 'FREE_ONLY_VIOLATION', check.reason);
}

async function embedListing(title, description) {
  try {
    return toVectorLiteral(await embedText(`${title}\n${description}`));
  } catch (err) {
    throw new HttpError(502, 'AI_UNAVAILABLE', 'Could not generate listing embedding — try again');
  }
}

// LLM moderation layer (after the cheap regex pass, before the embedding).
// llmModerate fails open, so this can only reject, never error out.
async function enforceLlmModeration(userId, data) {
  const verdict = await llmModerate(data.title, data.description);
  if (verdict.allowed) return;

  await pool.query(
    'INSERT INTO flagged_listings (user_id, content, category, reason) VALUES ($1, $2, $3, $4)',
    [userId, { title: data.title, description: data.description }, verdict.category, verdict.reason]
  );
  throw new HttpError(
    422,
    verdict.category === 'price_selling' ? 'FREE_ONLY_VIOLATION' : 'MODERATION_REJECTED',
    `Listing rejected: ${verdict.reason}`
  );
}

// GET /listings
async function list(req, res) {
  const q = parse(listQuerySchema, req.query);

  const where = ["l.status = 'active'"];
  const params = [];
  if (q.category) { params.push(q.category); where.push(`l.category = $${params.length}`); }
  if (q.condition) { params.push(q.condition); where.push(`l.condition = $${params.length}`); }
  if (q.neighborhood) { params.push(`%${q.neighborhood}%`); where.push(`l.neighborhood ILIKE $${params.length}`); }
  if (q.free_today === 'true') where.push("l.created_at >= date_trunc('day', now())");

  const offset = (q.page - 1) * q.limit;
  const { rows } = await pool.query(
    `SELECT l.*, u.name AS owner_name, u.avatar_url AS owner_avatar_url, count(*) OVER() AS total
       FROM listings l JOIN users u ON u.id = l.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT ${q.limit} OFFSET ${offset}`,
    params
  );

  res.json({
    listings: rows.map(serializeListing),
    page: q.page,
    limit: q.limit,
    total: rows[0] ? Number(rows[0].total) : 0,
  });
}

// GET /listings/:id
async function get(req, res) {
  const { id } = parse(idSchema, req.params);
  const { rows } = await pool.query(
    `SELECT l.*, u.name AS owner_name, u.avatar_url AS owner_avatar_url
       FROM listings l JOIN users u ON u.id = l.user_id
      WHERE l.id = $1 AND l.status <> 'removed'`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
  res.json({ listing: serializeListing(rows[0]) });
}

// POST /listings
async function create(req, res) {
  const data = parse(createSchema, req.body);
  enforceFreeOnly(data.title, data.description, data.neighborhood);
  await enforceLlmModeration(req.session.userId, data);
  const vector = await embedListing(data.title, data.description);

  const { rows } = await pool.query(
    `INSERT INTO listings (user_id, title, description, category, condition, neighborhood, photo_urls, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
     RETURNING *`,
    [req.session.userId, data.title, data.description, data.category, data.condition,
     data.neighborhood || null, data.photoUrls, vector]
  );
  const listing = rows[0];

  // Wishlist matching runs after the response — a notification hiccup
  // shouldn't fail the create.
  matchWishlistAlerts(listing, vector).catch((err) =>
    console.error('wishlist matching failed:', err.message)
  );

  res.status(201).json({ listing: serializeListing(listing) });
}

// PATCH /listings/:id (owner only)
async function update(req, res) {
  const { id } = parse(idSchema, req.params);
  const data = parse(updateSchema, req.body);

  const existing = await pool.query('SELECT * FROM listings WHERE id = $1 AND status <> \'removed\'', [id]);
  const listing = existing.rows[0];
  if (!listing) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
  if (listing.user_id !== req.session.userId) throw new HttpError(403, 'FORBIDDEN', 'Not your listing');

  const title = data.title ?? listing.title;
  const description = data.description ?? listing.description;
  const neighborhood = data.neighborhood ?? listing.neighborhood;
  enforceFreeOnly(title, description, neighborhood);

  // Re-embed only when the text the embedding is based on changed.
  const textChanged = data.title !== undefined || data.description !== undefined;
  const vector = textChanged ? await embedListing(title, description) : null;

  const { rows } = await pool.query(
    `UPDATE listings SET
       title = $2, description = $3, category = $4, condition = $5, neighborhood = $6,
       photo_urls = $7, embedding = COALESCE($8::vector, embedding)
     WHERE id = $1 RETURNING *`,
    [id, title, description, data.category ?? listing.category, data.condition ?? listing.condition,
     neighborhood, data.photoUrls ?? listing.photo_urls, vector]
  );
  res.json({ listing: serializeListing(rows[0]) });
}

// DELETE /listings/:id (owner only, soft delete)
async function remove(req, res) {
  const { id } = parse(idSchema, req.params);
  const { rows } = await pool.query('SELECT user_id FROM listings WHERE id = $1 AND status <> \'removed\'', [id]);
  if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
  if (rows[0].user_id !== req.session.userId) throw new HttpError(403, 'FORBIDDEN', 'Not your listing');

  await pool.query("UPDATE listings SET status = 'removed' WHERE id = $1", [id]);
  res.json({ ok: true });
}

// POST /listings/:id/claim — single-claimer: first claim wins.
async function claim(req, res) {
  const { id } = parse(idSchema, req.params);

  // Atomic flip so two simultaneous claims can't both win.
  const { rows } = await pool.query(
    `UPDATE listings SET status = 'claimed', claimed_by_user_id = $2
      WHERE id = $1 AND status = 'active' AND user_id <> $2
      RETURNING *`,
    [id, req.session.userId]
  );

  if (!rows[0]) {
    const check = await pool.query('SELECT user_id, status FROM listings WHERE id = $1', [id]);
    if (!check.rows[0] || check.rows[0].status === 'removed') throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
    if (check.rows[0].user_id === req.session.userId) throw new HttpError(400, 'OWN_LISTING', 'You cannot claim your own listing');
    throw new HttpError(409, 'ALREADY_CLAIMED', 'This listing was already claimed');
  }

  const listing = rows[0];
  const claimer = await pool.query('SELECT id, name FROM users WHERE id = $1', [req.session.userId]);
  await createNotification(listing.user_id, 'listing_claimed', {
    listingId: listing.id,
    listingTitle: listing.title,
    claimedBy: claimer.rows[0],
  });

  res.json({ listing: serializeListing(listing) });
}

module.exports = { list, get, create, update, remove, claim };
