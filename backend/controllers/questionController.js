const Question = require('../models/Question');

// POST /api/questions/add
const addQuestion = async (req, res) => {
  const { examId, questionText, options, correctAnswer } = req.body;
  try {
    const question = new Question({ examId, questionText, options, correctAnswer });
    await question.save();
    res.status(201).json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { addQuestion };