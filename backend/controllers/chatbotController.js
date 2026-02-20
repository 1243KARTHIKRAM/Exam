const ChatbotLog = require('../models/ChatbotLog');

// @desc    Log a chatbot question
// @route   POST /api/chatbot/log
// @access  Public (can be used without authentication)
const logChatbotQuestion = async (req, res) => {
  try {
    const { question, timestamp, userId, examId, botResponse, sessionId } = req.body;

    // Validate required fields
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    // Get IP address and user agent from request
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Create the log entry
    const chatbotLog = await ChatbotLog.create({
      question,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      userId: userId || null,
      examId: examId || null,
      botResponse: botResponse || null,
      sessionId: sessionId || null,
      userAgent,
      ipAddress
    });

    res.status(201).json({
      success: true,
      data: chatbotLog
    });
  } catch (error) {
    console.error('Error logging chatbot question:', error);
    res.status(500).json({ message: 'Failed to log chatbot question' });
  }
};

// @desc    Get chatbot logs for analytics
// @route   GET /api/chatbot/logs
// @access  Private (Admin only)
const getChatbotLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate, userId, examId } = req.query;

    // Build query
    const query = {};
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    if (userId) query.userId = userId;
    if (examId) query.examId = examId;

    // Execute query with pagination
    const logs = await ChatbotLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
      .populate('examId', 'title');

    const total = await ChatbotLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chatbot logs:', error);
    res.status(500).json({ message: 'Failed to fetch chatbot logs' });
  }
};

// @desc    Get chatbot analytics
// @route   GET /api/chatbot/analytics
// @access  Private (Admin only)
const getChatbotAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date query
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);
    
    const timestampQuery = Object.keys(dateQuery).length > 0 ? { timestamp: dateQuery } : {};

    // Get total questions
    const totalQuestions = await ChatbotLog.countDocuments(timestampQuery);

    // Get unique users
    const uniqueUsers = await ChatbotLog.distinct('userId', timestampQuery);

    // Get questions per day (last 7 days by default)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const questionsPerDay = await ChatbotLog.aggregate([
      {
        $match: {
          timestamp: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get most common questions (sample)
    const sampleLogs = await ChatbotLog.find(timestampQuery)
      .sort({ timestamp: -1 })
      .limit(100)
      .select('question');

    res.status(200).json({
      success: true,
      data: {
        totalQuestions,
        uniqueUsers: uniqueUsers.filter(Boolean).length,
        questionsPerDay,
        recentSample: sampleLogs
      }
    });
  } catch (error) {
    console.error('Error fetching chatbot analytics:', error);
    res.status(500).json({ message: 'Failed to fetch chatbot analytics' });
  }
};

module.exports = {
  logChatbotQuestion,
  getChatbotLogs,
  getChatbotAnalytics
};
