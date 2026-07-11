/* eslint-disable camelcase */
// Rejected listing attempts, kept for review (never published).

exports.up = (pgm) => {
  pgm.createTable('flagged_listings', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    content: { type: 'jsonb', notNull: true },
    category: { type: 'text', notNull: true },
    reason: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('flagged_listings', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('flagged_listings');
};
