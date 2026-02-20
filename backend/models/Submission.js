const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  language: { 
    type: String, 
    required: true,
    enum: ['javascript', 'python', 'java', 'cpp']
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Running', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error'], 
    default: 'Pending' 
  },
  testCaseResults: [{
    testCaseId: { type: mongoose.Schema.Types.ObjectId },
    input: { type: String },
    expectedOutput: { type: String },
    actualOutput: { type: String },
    status: { type: String },
    executionTime: { type: Number },
    memory: { type: Number }
  }],
  score: { type: Number, default: 0 },
  executionTime: { type: Number, default: 0 }, // milliseconds
  isSubmitted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
