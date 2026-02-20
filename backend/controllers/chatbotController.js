const OpenAI = require('openai');
const ChatbotLog = require('../models/ChatbotLog');

// Initialize OpenAI client
const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
};

// Exam-specific system prompt
const EXAM_SYSTEM_PROMPT = `You are an Exam Assistant for an AI-Proctored Online Examination System. Your role is to help students with questions about exams, proctoring rules, coding sections, and technical issues.

IMPORTANT RULES:
1. Only answer questions related to the exam system, proctoring, violations, coding questions, and technical issues.
2. If asked about topics unrelated to the exam system, politely redirect to exam-related topics.
3. Be concise but helpful in your responses.
4. Always prioritize exam integrity and security.

EXAM RULES & PROCTORING:
- Camera must be ON and facing the student at all times
- Student must stay within the camera frame
- No other persons should be in the room
- Leaving the exam window triggers a violation
- No unauthorized devices or materials allowed
- No headphones or earbuds
- Background should be neutral
- Multiple face detection triggers warnings

VIOLATION CONSEQUENCES:
1. First violation: Warning notification
2. Second violation: Score reduction (10%)
3. Third violation: Automatic submission
4. Repeated violations: Exam disqualification

CODING SECTION:
- Students can write code in multiple programming languages
- Code is tested against sample test cases
- Syntax highlighting and auto-save are enabled
- Students must submit their code before the exam ends
- Plagiarism detection is active

FULLSCREEN REQUIREMENTS:
- Enter fullscreen mode is required for the exam
- Exit without permission = violation
- Use F11 (Windows) or Cmd+Ctrl+F (Mac) to enter fullscreen

TECHNICAL ISSUES:
- Use Chrome or Firefox (latest version)
- Enable camera and microphone permissions
- Ensure stable internet connection
- Contact admin if issues persist

Provide helpful, accurate information about the exam system.
`;

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

// @desc    Get chatbot analytics with detailed insights
// @route   GET /api/chatbot/analytics
// @access  Private (Admin only)
const getChatbotAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, examId } = req.query;

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

    // ==================== MOST ASKED QUESTIONS ====================
    // Group similar questions by normalizing text
    const normalizeQuestion = (question) => {
      return question.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .sort()
        .join(' ');
    };

    const allLogs = await ChatbotLog.find(timestampQuery).select('question examId timestamp');
    
    // Group questions by normalized form
    const questionGroups = {};
    allLogs.forEach(log => {
      const normalized = normalizeQuestion(log.question);
      if (!questionGroups[normalized]) {
        questionGroups[normalized] = {
          original: log.question,
          count: 0,
          examIds: new Set(),
          timestamps: []
        };
      }
      questionGroups[normalized].count += 1;
      if (log.examId) questionGroups[normalized].examIds.add(log.examId.toString());
      questionGroups[normalized].timestamps.push(log.timestamp);
    });

    // Get top 10 most asked questions
    const mostAskedQuestions = Object.entries(questionGroups)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([normalized, data]) => ({
        question: data.original,
        count: data.count,
        examIds: Array.from(data.examIds),
        firstAsked: new Date(Math.min(...data.timestamps)),
        lastAsked: new Date(Math.max(...data.timestamps))
      }));

    // ==================== CONFUSION TOPICS ====================
    // Identify confusion topics based on keywords in questions
    const confusionKeywords = {
      'proctoring': ['proctoring', 'camera', 'webcam', 'monitoring', 'face', 'detection'],
      'violations': ['violation', 'warning', 'disqualification', 'cancel', 'warned'],
      'coding': ['coding', 'code', 'programming', 'algorithm', 'run', 'submit'],
      'fullscreen': ['fullscreen', 'full screen', 'exit', 'f11'],
      'tab_switch': ['tab', 'switch', 'window', 'leave', 'alt'],
      'technical': ['error', 'internet', 'problem', 'issue', 'not working'],
      'time': ['time', 'timer', 'duration', 'remaining', 'hours'],
      'submission': ['submit', 'submission', 'finish', 'complete'],
      'starting': ['start', 'begin', 'how to', 'starting'],
      'questions': ['question', 'answer', 'marks', 'score']
    };

    const topicCounts = {};
    Object.keys(confusionKeywords).forEach(topic => {
      topicCounts[topic] = 0;
    });

    allLogs.forEach(log => {
      const lowerQuestion = log.question.toLowerCase();
      Object.entries(confusionKeywords).forEach(([topic, keywords]) => {
        if (keywords.some(keyword => lowerQuestion.includes(keyword))) {
          topicCounts[topic]++;
        }
      });
    });

    // Sort topics by frequency (confusion level)
    const confusionTopics = Object.entries(topicCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: totalQuestions > 0 ? ((count / totalQuestions) * 100).toFixed(1) : 0
      }));

    // ==================== CHAT FREQUENCY PER EXAM ====================
    const chatFrequencyPerExam = await ChatbotLog.aggregate([
      {
        $match: {
          examId: { $ne: null },
          ...timestampQuery
        }
      },
      {
        $group: {
          _id: '$examId',
          totalQuestions: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          firstChat: { $min: '$timestamp' },
          lastChat: { $max: '$timestamp' }
        }
      },
      {
        $lookup: {
          from: 'exams',
          localField: '_id',
          foreignField: '_id',
          as: 'exam'
        }
      },
      {
        $unwind: {
          path: '$exam',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          examId: '$_id',
          examTitle: { $ifNull: ['$exam.title', 'Unknown Exam'] },
          totalQuestions: 1,
          uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$this', null] } } } },
          firstChat: 1,
          lastChat: 1
        }
      },
      { $sort: { totalQuestions: -1 } }
    ]);

    // Get overall chat frequency stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const chatFrequencyTrend = await ChatbotLog.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          questions: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          date: '$_id',
          questions: 1,
          uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$this', null] } } } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalQuestions,
        uniqueUsers: uniqueUsers.filter(Boolean).length,
        questionsPerDay,
        mostAskedQuestions,
        confusionTopics,
        chatFrequencyPerExam,
        chatFrequencyTrend
      }
    });
  } catch (error) {
    console.error('Error fetching chatbot analytics:', error);
    res.status(500).json({ message: 'Failed to fetch chatbot analytics' });
  }
};

// @desc    Ask chatbot a question using OpenAI
// @route   POST /api/chatbot/ask
// @access  Public
const askChatbot = async (req, res) => {
  try {
    const { question, sessionId, examId, userId } = req.body;

    // Validate required fields
    if (!question) {
      return res.status(400).json({ 
        message: 'Question is required',
        reply: 'Sorry, I did not receive your question. Please try again.'
      });
    }

    // Debug logging
    console.log("Incoming question:", question);
    console.log("Using model:", process.env.OPENAI_MODEL || 'gpt-3.5-turbo');

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(503).json({ 
        message: 'AI service temporarily unavailable. Please try again later.',
        reply: 'Sorry, chatbot is temporarily unavailable.' 
      });
    }

    const openai = getOpenAIClient();

    // Call OpenAI chat completion API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: EXAM_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: question
        }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
      temperature: 0.7
    });

    // Extract the AI response
    const aiResponse = completion.choices[0]?.message?.content || 
      'I apologize, but I could not generate a response. Please try again.';

    // Log the question to database (non-blocking)
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      await ChatbotLog.create({
        question,
        timestamp: new Date(),
        userId: userId || null,
        examId: examId || null,
        botResponse: aiResponse,
        sessionId: sessionId || null,
        userAgent,
        ipAddress
      });
    } catch (logError) {
      // Log error but don't fail the request
      console.error('Error logging chatbot question:', logError);
    }

    res.status(200).json({
      success: true,
      data: {
        response: aiResponse
      },
      reply: aiResponse
    });
  } catch (error) {
    console.error('Error in askChatbot:', error);
    
    // Log the full error response body for debugging
    if (error.response) {
      console.error('OpenAI response body:', error.response.data);
    }

    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({ 
        message: 'AI service quota exceeded. Please try again later.',
        reply: 'Sorry, chatbot is temporarily unavailable.'
      });
    }

    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({ 
        message: 'Too many requests. Please wait a moment and try again.',
        reply: 'Sorry, chatbot is temporarily unavailable. Please try again later.'
      });
    }

    // Generic error response with fallback reply
    const fallbackReply = 'Sorry, chatbot is temporarily unavailable.';
    res.status(500).json({ 
      message: 'Failed to get AI response. Please try again or contact support.',
      reply: fallbackReply
    });
  }
};

module.exports = {
  logChatbotQuestion,
  getChatbotLogs,
  getChatbotAnalytics,
  askChatbot
};
