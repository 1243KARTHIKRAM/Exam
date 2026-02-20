const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createCodingQuestion,
  getCodingQuestions,
  getCodingQuestion,
  runCode,
  executeCode,
  submitCode,
  getUserSubmissions,
  getAllSubmissions,
  updateCodingQuestion,
  deleteCodingQuestion
} = require('../controllers/codingController');

// Student routes - execute code without a question (quick test)
router.post('/execute', protect, executeCode);

// Student routes - run code (test with sample test cases only)
router.post('/run', protect, runCode);

// Student routes - submit code (run all test cases)
router.post('/submit', protect, submitCode);

// Legacy endpoint - for backward compatibility
router.post('/legacy', protect, submitCode);

// Get user's submissions
router.get('/submissions/:questionId', protect, getUserSubmissions);

// Admin routes - manage coding questions
router.post('/questions', protect, authorize('admin'), createCodingQuestion);
router.get('/questions/exam/:examId', protect, authorize('admin'), getCodingQuestions);
router.get('/questions/:questionId', protect, getCodingQuestion);
router.put('/questions/:questionId', protect, authorize('admin'), updateCodingQuestion);
router.delete('/questions/:questionId', protect, authorize('admin'), deleteCodingQuestion);

// Admin - get all submissions for a question
router.get('/submissions/all/:questionId', protect, authorize('admin'), getAllSubmissions);

module.exports = router;
