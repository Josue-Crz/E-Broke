const pool = require('../db/pool');
const { serializeListing } = require('../utils/serialize');

// GET /me/listings — "My Listings" page: my active + claimed (not removed).
async function myListings(req, res) {
  const { rows } = await pool.query(
    `SELECT * FROM listings
      WHERE user_id = $1 AND status <> 'removed'
      ORDER BY created_at DESC`,
    [req.session.userId]
  );
  res.json({ listings: rows.map(serializeListing) });
}

module.exports = { myListings };
