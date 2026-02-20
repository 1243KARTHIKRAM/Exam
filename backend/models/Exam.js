const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  duration: { type: Number, required: true }, // minutes
  date: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);