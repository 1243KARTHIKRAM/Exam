const express = require('express');
const router = express.Router();
const { 
  logChatbotQuestion, 
  getChatbotLogs, 
  getChatbotAnalytics,
  askChatbot
} = require('../controllers/chatbotController');
const { protect, authorize } = require('../middleware/auth');

// Public route - log chatbot questions (no auth required for easier integration)
router.post('/log', logChatbotQuestion);

// Public route - ask chatbot question with OpenAI
router.post('/ask', askChatbot);

// Protected routes - admin only for analytics
router.get('/logs', protect, authorize('admin'), getChatbotLogs);
router.get('/analytics', protect, authorize('admin'), getChatbotAnalytics);

module.exports = router;
