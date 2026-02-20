const Exam = require('../models/Exam');
const Question = require('../models/Question');

// POST /api/exams/create
const createExam = async (req, res) => {
  const { title, duration, date } = req.body;
  try {
    const exam = new Exam({ title, duration, date, createdBy: req.user.id });
    await exam.save();
    res.status(201).json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/exams/available - Get available exams for students (visible based on date/time)
const getAvailableExams = async (req, res) => {
  try {
    const now = new Date();
    // Only show exams where the exam date/time has started (not in the future)
    const exams = await Exam.find({
      date: { $lte: now }  // Exam date must be less than or equal to current time
    }).populate('createdBy', 'name email');
    
    res.json(exams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/exams
const listExams = async (req, res) => {
  try {
    const exams = await Exam.find().populate('createdBy', 'name email');
    res.json(exams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/exams/:id - Get single exam with questions
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    
    const questions = await Question.find({ examId: req.params.id });
    res.json({ exam, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/exams/:id
const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    
    // Delete all questions associated with this exam
    await Question.deleteMany({ examId: req.params.id });
    
    await exam.remove();
    res.json({ message: 'Exam and related questions deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createExam, listExams, deleteExam, getAvailableExams, getExamById };