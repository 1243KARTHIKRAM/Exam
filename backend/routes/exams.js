const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { createExam, listExams, deleteExam } = require('../controllers/examController');

// all endpoints require admin
router.post('/create', protect, authorize('admin'), createExam);
router.get('/', protect, authorize('admin'), listExams);
router.delete('/:id', protect, authorize('admin'), deleteExam);

module.exports = router;