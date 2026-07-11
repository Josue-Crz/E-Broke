const express = require('express');
const multer = require('multer');

const router = express.Router();

const controller = require('../controllers/controller.js');
const listings = require('../controllers/listingsController.js');
const saves = require('../controllers/savesController.js');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');

// Keep the uploaded image in memory as a Buffer — we only forward it to the
// vision model, we never write it to disk. 10 MB cap so a huge upload can't
// blow up the process.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /listings/analyze-photo — multipart form, image under field name "photo"
// (Abha's scratch endpoint — logic unchanged, now rate-limited like all AI routes)
router.post('/analyze-photo', aiLimiter, upload.single('photo'), controller.analyzePhoto);

// Browsing is public; creating/claiming/saving requires a verified account.
router.get('/', listings.list);
router.get('/:id', listings.get);
router.post('/', requireVerified, aiLimiter, listings.create);
router.patch('/:id', requireVerified, aiLimiter, listings.update);
router.delete('/:id', requireVerified, listings.remove);
router.post('/:id/claim', requireVerified, listings.claim);
router.post('/:id/save', requireAuth, saves.save);
router.delete('/:id/save', requireAuth, saves.unsave);

module.exports = router;
