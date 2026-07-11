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
  { title: '3-Shelf Bookcase (black)', description: 'Sturdy laminate bookcase, about 4 feet tall. Holds textbooks and plants without wobbling. Some corner wear but totally solid.', category: 'furniture', condition: 'fair', neighborhood: 'Sunset District, SF', photo: 'bookcase' },
  { title: 'Rolling Desk Chair', description: 'Adjustable-height office chair with lumbar support. Wheels glide fine on carpet and hardwood. Giving it away after switching to a standing desk.', category: 'furniture', condition: 'good', neighborhood: 'Parkmerced', photo: 'chair' },
  { title: 'Calculus: Early Transcendentals (8th ed.)', description: 'Stewart calculus textbook used for MATH 226/227. Light pencil notes in a few chapters, all erased where I could. Binding intact.', category: 'textbooks', condition: 'fair', neighborhood: 'Ingleside, SF', photo: 'calculus' },
  { title: 'Organic Chemistry Model Kit + Textbook', description: 'Molecular model kit with every piece accounted for, plus the Klein Organic Chemistry text. Survived two semesters so you don\'t have to buy new.', category: 'textbooks', condition: 'good', neighborhood: 'Richmond District, SF', photo: 'ochem' },
  { title: 'Mechanical Keyboard (brown switches)', description: 'Tenkeyless mechanical keyboard with quiet tactile switches. USB-C cable included. Typed two theses on it — still clicks like day one.', category: 'electronics', condition: 'good', neighborhood: 'Daly City', photo: 'keyboard' },
  { title: 'Wired Over-Ear Headphones', description: 'Comfortable over-ear headphones with a 3.5mm jack, great for the library. Ear pads recently replaced. No mic, just solid sound.', category: 'electronics', condition: 'good', neighborhood: 'Parkmerced', photo: 'headphones' },
  { title: 'Electric Kettle (1.7L)', description: 'Fast-boil electric kettle with auto shutoff. Perfect for tea, ramen, and french press coffee in a dorm. Descaled and clean.', category: 'dorm_essentials', condition: 'like_new', neighborhood: 'Sunset District, SF', photo: 'kettle' },
  { title: 'Full-Length Mirror', description: 'Door-hanging full-length mirror, no cracks or chips. Hardware included. Great for a dorm room or small apartment.', category: 'dorm_essentials', condition: 'good', neighborhood: 'Daly City', photo: 'mirror' },
  { title: 'Power Strip + Extension Cord Bundle', description: 'Six-outlet surge protector plus a 10-foot extension cord. Both work perfectly — I just have too many from merging apartments.', category: 'dorm_essentials', condition: 'good', neighborhood: 'Ingleside, SF', photo: 'powerstrip' },
  { title: 'Sealed Trail Mix Variety Box', description: 'Costco variety box of individually wrapped trail mix packs, 28 count, unopened. Best-by date is eight months out. Great study fuel.', category: 'food', condition: 'like_new', neighborhood: 'Richmond District, SF', photo: 'trailmix' },
  { title: 'Green Tea Sampler (unopened)', description: 'Gift set of 40 assorted green and herbal tea bags, still sealed in the box. I\'m a coffee person — someone please enjoy this.', category: 'food', condition: 'like_new', neighborhood: 'Sunset District, SF', photo: 'tea' },
  { title: 'Yoga Mat + Blocks', description: 'Non-slip yoga mat with two foam blocks. Wiped down and sanitized. Light wear on the mat corners, plenty of grip left.', category: 'other', condition: 'good', neighborhood: 'Parkmerced', photo: 'yoga' },
  { title: 'Bike Helmet (M/L)', description: 'Certified bike helmet, medium/large fit with adjustable dial. Never crashed, just outgrew the color. Sanitized pads.', category: 'other', condition: 'good', neighborhood: 'Ingleside, SF', photo: 'helmet' },
  { title: 'Waterproof Backpack (laptop sleeve)', description: 'Commuter backpack with a padded 15-inch laptop sleeve and rain cover. Zippers all work; one small scuff on the base.', category: 'other', condition: 'good', neighborhood: 'Daly City', photo: 'backpack' },
  { title: 'String Lights (warm white, 33 ft)', description: 'USB-powered warm white string lights, all bulbs working. Instantly makes a dorm room cozier. Includes remote with dim settings.', category: 'dorm_essentials', condition: 'like_new', neighborhood: 'Richmond District, SF', photo: 'lights' },
  { title: 'Blender (single-serve)', description: 'Personal smoothie blender with two travel cups and lids. Blades sharp, motor strong. Cleaned thoroughly — just downsizing my kitchen.', category: 'dorm_essentials', condition: 'good', neighborhood: 'Sunset District, SF', photo: 'blender' },
  { title: 'Whiteboard (24x36) with Markers', description: 'Magnetic dry-erase board with tray, four markers, and an eraser. Wipes fully clean. Ideal for study planning or roommate chore charts.', category: 'other', condition: 'good', neighborhood: 'Parkmerced', photo: 'whiteboard' },
  { title: 'Statistics Textbook + Study Guide', description: 'OpenIntro Statistics print edition with a companion study guide for MATH 124. Minimal highlighting, answers unmarked.', category: 'textbooks', condition: 'good', neighborhood: 'Sunset District, SF', photo: 'stats' },
  { title: 'USB-C Hub (HDMI, SD, 3x USB)', description: 'Seven-in-one USB-C hub: HDMI out, SD/microSD readers, three USB-A ports, pass-through charging. Works with MacBooks and Windows laptops.', category: 'electronics', condition: 'like_new', neighborhood: 'Ingleside, SF', photo: 'usbhub' },
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
