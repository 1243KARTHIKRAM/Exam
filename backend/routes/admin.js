const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllExamAttempts,
  getStudentViolations,
  getExamStats,
  getDashboardStats,
  getAllStudents,
  detectPlagiarism,
  getPlagiarismStatsOverall,
  compareSubmissions
} = require('../controllers/adminController');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard overview
router.get('/dashboard', getDashboardStats);

// Get all exam attempts with filtering
router.get('/exam-attempts', getAllExamAttempts);

// Get exam statistics
router.get('/exam/:examId/stats', getExamStats);

// Get all students
router.get('/students', getAllStudents);

// Get student violations
router.get('/student/:studentId/violations', getStudentViolations);

// Plagiarism detection routes
router.get('/exam/:examId/plagiarism', detectPlagiarism);
router.get('/plagiarism/stats', getPlagiarismStatsOverall);
router.get('/submissions/:submissionId/compare/:otherSubmissionId', compareSubmissions);

module.exports = router;
