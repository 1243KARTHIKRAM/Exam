const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// GET /api/test
router.get('/', (req, res) => {
  res.json({ message: 'API is working' });
});

// protected route example
router.get('/private', protect, (req, res) => {
  res.json({ message: 'This is protected', user: req.user });
});

module.exports = router;
