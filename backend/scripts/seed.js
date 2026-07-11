// Demo seed: 3 verified users, 10 listings (with real Gradient embeddings so
// semantic search works out of the box), 1 wishlist alert.
// Destructive: wipes existing data. Refuses to run in production.
require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { embedText, toVectorLiteral } = require('../services/embeddings');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const USERS = [
  { name: 'Alice Chen', email: 'alice@sfsu.edu' },
  { name: 'Marcus Lee', email: 'marcus@sfsu.edu' },
  { name: 'Priya Patel', email: 'priya@sfsu.edu' },
];
const PASSWORD = 'password123';

const LISTINGS = [
  { title: 'Desk Lamp (LED, adjustable)', description: 'Bright LED desk lamp with three brightness levels and a flexible neck. Perfect for late-night study sessions. Works great, just upgraded.', category: 'dorm_essentials', condition: 'good', neighborhood: 'Parkmerced', photo: 'lamp' },
  { title: 'Mini Fridge — 2.7 cu ft', description: 'Compact black mini fridge, fits under a desk. Keeps drinks and snacks cold, freezer shelf included. Moving out and can\'t take it.', category: 'dorm_essentials', condition: 'good', neighborhood: 'Sunset District, SF', photo: 'fridge' },
  { title: 'CS Textbook Bundle (3 books)', description: 'Intro to Algorithms, Clean Code, and a discrete math workbook. Some highlighting but all pages intact. Great for CSC courses.', category: 'textbooks', condition: 'fair', neighborhood: 'Ingleside, SF', photo: 'books' },
  { title: 'IKEA Desk (LINNMON, white)', description: 'White IKEA desk, 47x23 inches. A few small scratches on top but sturdy. Disassembles for easy transport — I can help carry it down.', category: 'furniture', condition: 'fair', neighborhood: 'Parkmerced', photo: 'desk' },
  { title: 'Futon / Small Couch', description: 'Grey fold-flat futon, seats two comfortably. From a smoke-free apartment. You pick up — it fits in a hatchback with seats down.', category: 'furniture', condition: 'good', neighborhood: 'Daly City', photo: 'futon' },
  { title: 'TI-84 Plus Calculator', description: 'Graphing calculator, works perfectly, includes slide cover. Finished my math requirement so passing it on to the next student.', category: 'electronics', condition: 'like_new', neighborhood: 'Richmond District, SF', photo: 'calc' },
  { title: '24" Monitor (HDMI)', description: 'Acer 24-inch 1080p monitor with HDMI and VGA. Great second screen for coding or notes. Includes power and HDMI cables.', category: 'electronics', condition: 'good', neighborhood: 'Sunset District, SF', photo: 'monitor' },
  { title: 'Rice Cooker (6-cup)', description: 'Basic 6-cup rice cooker with steaming tray. Cleaned and fully working. A dorm essential I no longer need after moving.', category: 'dorm_essentials', condition: 'good', neighborhood: 'Ingleside, SF', photo: 'ricecooker' },
  { title: 'Unopened Instant Ramen Box (24 pack)', description: 'Sealed box of 24 chicken-flavor instant ramen packs, best-by next year. Bought in bulk before going home for the summer.', category: 'food', condition: 'like_new', neighborhood: 'Parkmerced', photo: 'ramen' },
  { title: 'Psychology 101 Textbook', description: 'Myers Psychology 13th edition, barely used — class went fully online. No markings inside, minor shelf wear on the cover.', category: 'textbooks', condition: 'like_new', neighborhood: 'Daly City', photo: 'psych' },
];

async function main() {
  console.log('Wiping existing data…');
  await pool.query('TRUNCATE notifications, messages, conversations, wishlist_alerts, saves, listings, users RESTART IDENTITY CASCADE');

  console.log('Creating users…');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userIds = [];
  for (const u of USERS) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, sfsu_email, password_hash, verified_at) VALUES ($1, $2, $3, now()) RETURNING id`,
      [u.name, u.email, passwordHash]
    );
    userIds.push(rows[0].id);
  }

  console.log('Creating listings (embedding each via Gradient)…');
  for (let i = 0; i < LISTINGS.length; i++) {
    const l = LISTINGS[i];
    let vector = null;
    try {
      vector = toVectorLiteral(await embedText(`${l.title}\n${l.description}`));
    } catch (err) {
      console.warn(`  embedding failed for "${l.title}" (${err.message}) — seeding without it`);
    }
    await pool.query(
      `INSERT INTO listings (user_id, title, description, category, condition, neighborhood, photo_urls, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
      [userIds[i % userIds.length], l.title, l.description, l.category, l.condition, l.neighborhood,
       [`https://picsum.photos/seed/${l.photo}/600/400`], vector]
    );
    console.log(`  ✓ ${l.title}`);
  }

  console.log('Creating a wishlist alert (Priya wants a lamp)…');
  try {
    const vector = toVectorLiteral(await embedText('desk lamp for studying'));
    await pool.query(
      `INSERT INTO wishlist_alerts (user_id, query_text, query_embedding) VALUES ($1, $2, $3::vector)`,
      [userIds[2], 'desk lamp for studying', vector]
    );
  } catch (err) {
    console.warn(`  wishlist alert embedding failed: ${err.message}`);
  }

  console.log(`\nDone. Log in as any of: ${USERS.map((u) => u.email).join(', ')} (password: ${PASSWORD})`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
