const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  type: {
    type: String,
    enum: [
      'no_face', 
      'multiple_faces', 
      'face_left',
      'paste',           // Code pasted into editor
      'tab_switch',      // Switched away from exam tab
      'fullscreen_exit', // Exited fullscreen mode
      'copy_attempt',    // Attempted to copy code
      'plagiarism'       // Code similarity detected (plagiarism)
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  description: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,  // Store additional data like paste length, etc.
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  snapshot: {
    type: String, // Base64 encoded image
    default: null
  }
});

module.exports = mongoose.model('Violation', violationSchema);
