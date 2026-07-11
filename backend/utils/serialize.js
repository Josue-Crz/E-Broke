// Row → camelCase JSON mappers so every endpoint returns the same shapes.

function serializeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.sfsu_email,
    avatarUrl: row.avatar_url,
    verified: Boolean(row.verified_at),
    createdAt: row.created_at,
  };
}

function serializeListing(row) {
  const listing = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    neighborhood: row.neighborhood,
    photoUrls: row.photo_urls || [],
    status: row.status,
    createdAt: row.created_at,
  };
  // Present when the query joined the owner's user row.
  if (row.owner_name !== undefined) {
    listing.owner = { id: row.user_id, name: row.owner_name, avatarUrl: row.owner_avatar_url };
  }
  return listing;
}

module.exports = { serializeUser, serializeListing };
