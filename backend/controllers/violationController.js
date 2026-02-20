const Violation = require('../models/Violation');

// Create a new violation
exports.createViolation = async (req, res) => {
  try {
    const { examId, type, snapshot } = req.body;
    const userId = req.user.id; // From auth middleware

    const violation = new Violation({
      userId,
      examId,
      type,
      snapshot
    });

    await violation.save();

    res.status(201).json({
      success: true,
      violation
    });
  } catch (error) {
    console.error('Error creating violation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create violation record'
    });
  }
};

// Get violations for an exam
exports.getExamViolations = async (req, res) => {
  try {
    const { examId } = req.params;

    const violations = await Violation.find({ examId })
      .populate('userId', 'name email')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      violations
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch violations'
    });
  }
};

// Get violations for a user in an exam
exports.getUserViolations = async (req, res) => {
  try {
    const { examId, userId } = req.params;

    const violations = await Violation.find({ examId, userId })
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      violations
    });
  } catch (error) {
    console.error('Error fetching user violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user violations'
    });
  }
};
