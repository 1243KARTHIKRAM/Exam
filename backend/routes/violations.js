const express = require('express');
const router = express.Router();
const { createViolation, getExamViolations, getUserViolations } = require('../controllers/violationController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Create a violation
router.post('/', createViolation);

// Get (admin only in real app, but allowing all for now)
router.get('/exam/:examId', getExamViolations);

// Get user violations for an exam
router.get('/user/:examId/:userId', getUserViolations);

module.exports = router;
