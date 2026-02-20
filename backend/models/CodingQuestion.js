const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false }
}, { _id: true });

const codingQuestionSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  constraints: { type: String, default: '' },
  testCases: [testCaseSchema],
  defaultCode: { 
    type: Map, 
    of: String,
    default: {
      javascript: '// Write your JavaScript code here\n\nfunction solution(input) {\n  // Your code here\n  return input;\n}',
      python: '# Write your Python code here\n\ndef solution(input):\n    # Your code here\n    return input',
      java: '// Write your Java code here\n\npublic class Main {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}',
      cpp: '// Write your C++ code here\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    return 0;\n}'
    }
  },
  timeLimit: { type: Number, default: 2000 }, // milliseconds
  memoryLimit: { type: Number, default: 128 }, // MB
  difficulty: { 
    type: String, 
    enum: ['Easy', 'Medium', 'Hard'], 
    default: 'Medium' 
  },
  points: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
