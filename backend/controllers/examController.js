const Exam = require('../models/Exam');
const Question = require('../models/Question');
const CodingQuestion = require('../models/CodingQuestion');
const Answer = require('../models/Answer');

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

// GET /api/exams/available - Get available exams for students (all exams, not just started ones)
const getAvailableExams = async (req, res) => {
  try {
    // Show all exams - students can see both upcoming and past exams
    const exams = await Exam.find({}).populate('createdBy', 'name email');
    
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
    
    // Fetch MCQ questions from Question collection
    const mcqQuestions = await Question.find({ examId: req.params.id });
    
    // Fetch coding questions from CodingQuestion collection
    const codingQuestions = await CodingQuestion.find({ examId: req.params.id });
    
    res.json({ 
      exam, 
      mcqQuestions,
      codingQuestions
    });
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

// POST /api/exams/:id/submit - Submit exam answers
const submitExam = async (req, res) => {
  try {
    const { answers } = req.body;
    const examId = req.params.id;
    const userId = req.user.id;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array is required' });
    }

    // Get all questions for this exam
    const questions = await Question.find({ examId });
    
    if (questions.length === 0) {
      return res.status(400).json({ message: 'No questions found for this exam' });
    }

    // Calculate score by comparing answers with correct answers
    let correctCount = 0;
    const questionMap = {};
    questions.forEach(q => {
      questionMap[q._id.toString()] = q.correctAnswer;
    });

    answers.forEach(answer => {
      if (questionMap[answer.questionId] === answer.answer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);

    // Save the answer to database
    const newAnswer = new Answer({
      userId,
      examId,
      answers,
      score
    });

    await newAnswer.save();

    res.status(201).json({
      message: 'Exam submitted successfully',
      score,
      correctCount,
      totalQuestions: questions.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createExam, listExams, deleteExam, getAvailableExams, getExamById, submitExam };