/* eslint-disable camelcase */
// Initial schema. Embeddings are 1024-dim to match gte-large-en-v1.5 on
// DigitalOcean Gradient — if you change EMBEDDING_MODEL, check its dimension.

exports.up = (pgm) => {
  pgm.createExtension('vector', { ifNotExists: true });

  pgm.createType('listing_category', [
    'dorm_essentials', 'textbooks', 'electronics', 'furniture', 'food', 'other',
  ]);
  pgm.createType('listing_condition', ['like_new', 'good', 'fair']);
  pgm.createType('listing_status', ['active', 'claimed', 'removed']);

  pgm.createTable('users', {
    id: 'id',
    name: { type: 'text', notNull: true },
    sfsu_email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    avatar_url: { type: 'text' },
    verified_at: { type: 'timestamptz' },
    verification_code: { type: 'text' },
    verification_expires: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('listings', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: true },
    description: { type: 'text', notNull: true },
    category: { type: 'listing_category', notNull: true },
    condition: { type: 'listing_condition', notNull: true },
    neighborhood: { type: 'text' },
    photo_urls: { type: 'text[]', notNull: true, default: pgm.func("'{}'") },
    status: { type: 'listing_status', notNull: true, default: 'active' },
    claimed_by_user_id: { type: 'integer', references: 'users' },
    embedding: { type: 'vector(1024)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('listings', 'status');
  pgm.createIndex('listings', 'category');
  pgm.createIndex('listings', 'created_at');

  pgm.createTable('saves', {
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    listing_id: { type: 'integer', notNull: true, references: 'listings', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('saves', 'saves_pkey', { primaryKey: ['user_id', 'listing_id'] });

  pgm.createTable('wishlist_alerts', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    query_text: { type: 'text', notNull: true },
    query_embedding: { type: 'vector(1024)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('conversations', {
    id: 'id',
    listing_id: { type: 'integer', notNull: true, references: 'listings', onDelete: 'CASCADE' },
    buyer_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('conversations', 'conversations_listing_buyer_unique', {
    unique: ['listing_id', 'buyer_id'],
  });

  pgm.createTable('messages', {
    id: 'id',
    conversation_id: { type: 'integer', notNull: true, references: 'conversations', onDelete: 'CASCADE' },
    sender_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    body: { type: 'text', notNull: true },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('messages', 'conversation_id');

  pgm.createTable('notifications', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('notifications', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('notifications');
  pgm.dropTable('messages');
  pgm.dropTable('conversations');
  pgm.dropTable('wishlist_alerts');
  pgm.dropTable('saves');
  pgm.dropTable('listings');
  pgm.dropTable('users');
  pgm.dropType('listing_status');
  pgm.dropType('listing_condition');
  pgm.dropType('listing_category');
};
