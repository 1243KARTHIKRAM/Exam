const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createExam, listExams, deleteExam, getAvailableExams, getExamById, submitExam } = require('../controllers/examController');

// Student endpoints - require authentication (student or admin)
router.get('/available', protect, getAvailableExams);
router.get('/:id', protect, getExamById);
router.post('/:id/submit', protect, submitExam);

// Admin endpoints
router.post('/create', protect, authorize('admin'), createExam);
router.get('/', protect, authorize('admin'), listExams);
router.delete('/:id', protect, authorize('admin'), deleteExam);

module.exports = router;