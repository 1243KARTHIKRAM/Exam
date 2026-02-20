const mongoose = require('mongoose');

const ChatbotLogSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Can be null for unauthenticated users
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    default: null // Can be null if not in exam context
  },
  botResponse: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for analytics queries
ChatbotLogSchema.index({ timestamp: -1 });
ChatbotLogSchema.index({ userId: 1, timestamp: -1 });
ChatbotLogSchema.index({ examId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatbotLog', ChatbotLogSchema);
