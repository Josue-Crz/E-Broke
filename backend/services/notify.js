const pool = require('../db/pool');

// Cosine similarity above this counts as a wishlist match. gte-large-en-v1.5
// puts clearly related text around 0.7+ and unrelated around 0.5 — tune after
// trying real listings.
const WISHLIST_MATCH_THRESHOLD = Number(process.env.WISHLIST_MATCH_THRESHOLD || 0.65);

async function createNotification(userId, type, payload) {
  await pool.query(
    'INSERT INTO notifications (user_id, type, payload) VALUES ($1, $2, $3)',
    [userId, type, payload]
  );
}

/**
 * Compare a fresh listing's embedding against every wishlist alert
 * (except the listing owner's own alerts); notify matching users.
 * pgvector's <=> is cosine DISTANCE, so similarity = 1 - distance.
 */
async function matchWishlistAlerts(listing, vectorLiteral) {
  const { rows } = await pool.query(
    `SELECT id, user_id, query_text, 1 - (query_embedding <=> $1::vector) AS similarity
       FROM wishlist_alerts
      WHERE user_id <> $2 AND query_embedding IS NOT NULL
        AND 1 - (query_embedding <=> $1::vector) > $3`,
    [vectorLiteral, listing.user_id, WISHLIST_MATCH_THRESHOLD]
  );

  for (const alert of rows) {
    await createNotification(alert.user_id, 'wishlist_match', {
      listingId: listing.id,
      listingTitle: listing.title,
      queryText: alert.query_text,
      similarity: Number(alert.similarity.toFixed(3)),
    });
  }
  return rows.length;
}

module.exports = { createNotification, matchWishlistAlerts };
