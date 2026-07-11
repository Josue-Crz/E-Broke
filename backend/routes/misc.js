// Everything that isn't /auth or /listings: search, wishlist, conversations,
// notifications, /me pages, photo uploads.
const express = require('express');
const multer = require('multer');

const search = require('../controllers/searchController');
const saves = require('../controllers/savesController');
const wishlist = require('../controllers/wishlistController');
const conversations = require('../controllers/conversationsController');
const notifications = require('../controllers/notificationsController');
const me = require('../controllers/meController');
const uploads = require('../controllers/uploadsController');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Search (embeds the query → rate-limited)
router.get('/search', aiLimiter, search.search);

// Wishlist alerts
router.post('/wishlist-alerts', requireAuth, aiLimiter, wishlist.create);
router.get('/wishlist-alerts', requireAuth, wishlist.list);
router.delete('/wishlist-alerts/:id', requireAuth, wishlist.remove);

// Messaging (verified users only)
router.get('/conversations', requireVerified, conversations.list);
router.post('/conversations', requireVerified, conversations.create);
router.get('/conversations/:id/messages', requireVerified, conversations.listMessages);
router.post('/conversations/:id/messages', requireVerified, conversations.sendMessage);

// Me
router.get('/me/listings', requireAuth, me.myListings);
router.get('/me/saved', requireAuth, saves.listSaved);
router.get('/me/unread-count', requireAuth, conversations.unreadCount);

// Notifications
router.get('/notifications', requireAuth, notifications.list);
router.post('/notifications/:id/read', requireAuth, notifications.markRead);

// Photo upload → DO Spaces
router.post('/uploads/photo', requireVerified, upload.single('photo'), uploads.uploadPhoto);

module.exports = router;
