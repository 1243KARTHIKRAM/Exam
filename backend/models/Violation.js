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
    enum: ['no_face', 'multiple_faces', 'face_left'],
    required: true
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
