const { z } = require('zod');
const pool = require('../db/pool');
const { HttpError, parse } = require('../utils/errors');

const createSchema = z.object({
  listingId: z.coerce.number().int().positive(),
  message: z.string().trim().min(1).max(2000),
});
const idSchema = z.object({ id: z.coerce.number().int().positive() });
const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

// A conversation is (listing, buyer). The "giver" side is the listing owner.
// Frontend polls GET /conversations and GET /me/unread-count (Abha's call:
// polling, no websockets, for the demo).

async function loadConversation(id, userId) {
  const { rows } = await pool.query(
    `SELECT c.*, l.user_id AS owner_id, l.title AS listing_title
       FROM conversations c JOIN listings l ON l.id = c.listing_id
      WHERE c.id = $1`,
    [id]
  );
  const convo = rows[0];
  if (!convo) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
  if (convo.buyer_id !== userId && convo.owner_id !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your conversation');
  }
  return convo;
}

// GET /conversations — every conversation I'm part of, newest activity first.
async function list(req, res) {
  const me = req.session.userId;
  const { rows } = await pool.query(
    `SELECT c.id, c.listing_id, c.created_at,
            l.title AS listing_title, l.photo_urls, l.status AS listing_status,
            buyer.id AS buyer_id, buyer.name AS buyer_name, buyer.avatar_url AS buyer_avatar,
            owner.id AS owner_id, owner.name AS owner_name, owner.avatar_url AS owner_avatar,
            lm.body AS last_message, lm.created_at AS last_message_at,
            (SELECT count(*) FROM messages m
              WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread_count
       FROM conversations c
       JOIN listings l ON l.id = c.listing_id
       JOIN users buyer ON buyer.id = c.buyer_id
       JOIN users owner ON owner.id = l.user_id
       LEFT JOIN LATERAL (
         SELECT body, created_at FROM messages
          WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
      WHERE c.buyer_id = $1 OR l.user_id = $1
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
    [me]
  );

  res.json({
    conversations: rows.map((r) => {
      const iAmBuyer = r.buyer_id === me;
      return {
        id: r.id,
        listing: { id: r.listing_id, title: r.listing_title, photoUrl: (r.photo_urls || [])[0] || null, status: r.listing_status },
        otherUser: iAmBuyer
          ? { id: r.owner_id, name: r.owner_name, avatarUrl: r.owner_avatar }
          : { id: r.buyer_id, name: r.buyer_name, avatarUrl: r.buyer_avatar },
        lastMessage: r.last_message,
        lastMessageAt: r.last_message_at,
        unreadCount: Number(r.unread_count),
        createdAt: r.created_at,
      };
    }),
  });
}

// POST /conversations — start (or reuse) a conversation about a listing.
async function create(req, res) {
  const { listingId, message } = parse(createSchema, req.body);
  const me = req.session.userId;

  const listing = await pool.query(
    "SELECT id, user_id FROM listings WHERE id = $1 AND status <> 'removed'",
    [listingId]
  );
  if (!listing.rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Listing not found');
  if (listing.rows[0].user_id === me) throw new HttpError(400, 'OWN_LISTING', 'You cannot message yourself about your own listing');

  // Reuse the existing conversation if I already started one for this listing.
  const { rows } = await pool.query(
    `INSERT INTO conversations (listing_id, buyer_id) VALUES ($1, $2)
     ON CONFLICT (listing_id, buyer_id) DO UPDATE SET listing_id = EXCLUDED.listing_id
     RETURNING id`,
    [listingId, me]
  );
  const conversationId = rows[0].id;

  const msg = await pool.query(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *',
    [conversationId, me, message]
  );

  res.status(201).json({ conversationId, message: serializeMessage(msg.rows[0]) });
}

function serializeMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// GET /conversations/:id/messages — also marks the other side's messages read.
async function listMessages(req, res) {
  const { id } = parse(idSchema, req.params);
  const me = req.session.userId;
  await loadConversation(id, me);

  await pool.query(
    'UPDATE messages SET read_at = now() WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL',
    [id, me]
  );
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [id]
  );
  res.json({ messages: rows.map(serializeMessage) });
}

// POST /conversations/:id/messages
async function sendMessage(req, res) {
  const { id } = parse(idSchema, req.params);
  const { body } = parse(messageSchema, req.body);
  const me = req.session.userId;
  await loadConversation(id, me);

  const { rows } = await pool.query(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *',
    [id, me, body]
  );
  res.status(201).json({ message: serializeMessage(rows[0]) });
}

// GET /me/unread-count — navbar badge; frontend polls this.
async function unreadCount(req, res) {
  const me = req.session.userId;
  const { rows } = await pool.query(
    `SELECT count(*) AS n
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN listings l ON l.id = c.listing_id
      WHERE m.sender_id <> $1 AND m.read_at IS NULL
        AND (c.buyer_id = $1 OR l.user_id = $1)`,
    [me]
  );
  res.json({ unreadCount: Number(rows[0].n) });
}

module.exports = { list, create, listMessages, sendMessage, unreadCount };
