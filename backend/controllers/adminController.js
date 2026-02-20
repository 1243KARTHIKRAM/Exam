const Exam = require('../models/Exam');
const Answer = require('../models/Answer');
const Violation = require('../models/Violation');
const User = require('../models/User');
const Submission = require('../models/Submission');
const { getPlagiarismStats, detectPlagiarism, compareCodes } = require('../utils/plagiarismDetector');

// GET /api/admin/exam-attempts - Get all exam attempts with scores and violations
exports.getAllExamAttempts = async (req, res) => {
  try {
    const { examId, studentId } = req.query;
    
    let query = {};
    if (examId) query.examId = examId;
    if (studentId) query.userId = studentId;

    const attempts = await Answer.find(query)
      .populate('userId', 'name email')
      .populate('examId', 'title date duration')
      .sort({ createdAt: -1 });

    // Get violation counts for each attempt
    const attemptsWithViolations = await Promise.all(
      attempts.map(async (attempt) => {
        const violationCount = await Violation.countDocuments({
          examId: attempt.examId._id,
          userId: attempt.userId._id
        });
        
        // Calculate cheating risk score
        const riskScore = calculateRiskScore(violationCount, attempt.score);
        
        return {
          _id: attempt._id,
          student: attempt.userId,
          exam: attempt.examId,
          score: attempt.score,
          violationCount,
          riskScore,
          submittedAt: attempt.createdAt
        };
      })
    );

    res.status(200).json({
      success: true,
      attempts: attemptsWithViolations
    });
  } catch (error) {
    console.error('Error fetching exam attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exam attempts'
    });
  }
};

// GET /api/admin/student/:studentId/violations - Get all violations for a student
exports.getStudentViolations = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { examId } = req.query;

    let query = { userId: studentId };
    if (examId) query.examId = examId;

    const violations = await Violation.find(query)
      .populate('examId', 'title date')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      violations
    });
  } catch (error) {
    console.error('Error fetching student violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student violations'
    });
  }
};

// GET /api/admin/exam/:examId/stats - Get exam statistics
exports.getExamStats = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Get all answers for this exam
    const answers = await Answer.find({ examId });
    
    // Calculate statistics
    const totalAttempts = answers.length;
    const scores = answers.map(a => a.score);
    const averageScore = totalAttempts > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / totalAttempts) 
      : 0;
    const highestScore = totalAttempts > 0 ? Math.max(...scores) : 0;
    const lowestScore = totalAttempts > 0 ? Math.min(...scores) : 0;
    
    // Get violation stats
    const totalViolations = await Violation.countDocuments({ examId });
    const violationTypes = await Violation.aggregate([
      { $match: { examId: require('mongoose').Types.ObjectId.createFromHexString(examId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Calculate risk distribution
    const highRisk = answers.filter(a => {
      const violations = Violation.countDocuments({ examId, userId: a.userId });
      return calculateRiskScore(violations, a.score) >= 70;
    }).length;

    res.status(200).json({
      success: true,
      stats: {
        exam,
        totalAttempts,
        averageScore,
        highestScore,
        lowestScore,
        totalViolations,
        violationTypes: violationTypes.reduce((acc, v) => {
          acc[v._id] = v.count;
          return acc;
        }, {}),
        highRiskCount: highRisk
      }
    });
  } catch (error) {
    console.error('Error fetching exam stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exam statistics'
    });
  }
};

// GET /api/admin/dashboard - Get dashboard overview
exports.getDashboardStats = async (req, res) => {
  try {
    // Total exams
    const totalExams = await Exam.countDocuments();
    
    // Total students
    const totalStudents = await User.countDocuments({ role: 'student' });
    
    // Total attempts
    const totalAttempts = await Answer.countDocuments();
    
    // Total violations
    const totalViolations = await Violation.countDocuments();
    
    // Recent violations
    const recentViolations = await Violation.find()
      .populate('userId', 'name email')
      .populate('examId', 'title')
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Recent attempts with scores
    const recentAttempts = await Answer.find()
      .populate('userId', 'name email')
      .populate('examId', 'title')
      .sort({ createdAt: -1 })
      .limit(10);

    // Calculate overall average score
    const allAnswers = await Answer.find();
    const averageScore = allAnswers.length > 0
      ? Math.round(allAnswers.reduce((sum, a) => sum + a.score, 0) / allAnswers.length)
      : 0;

    // High risk students count
    const highRiskStudents = await getHighRiskStudentsCount();

    res.status(200).json({
      success: true,
      stats: {
        totalExams,
        totalStudents,
        totalAttempts,
        totalViolations,
        averageScore,
        highRiskStudents,
        recentViolations,
        recentAttempts
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

// GET /api/admin/students - Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    
    // Get overall stats for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const examCount = await Answer.countDocuments({ userId: student._id });
        const violationCount = await Violation.countDocuments({ userId: student._id });
        const answers = await Answer.find({ userId: student._id });
        const avgScore = answers.length > 0
          ? Math.round(answers.reduce((sum, a) => sum + a.score, 0) / answers.length)
          : 0;
        
        return {
          _id: student._id,
          name: student.name,
          email: student.email,
          examCount,
          violationCount,
          averageScore: avgScore
        };
      })
    );

    res.status(200).json({
      success: true,
      students: studentsWithStats
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
};

// Helper function to calculate cheating risk score
function calculateRiskScore(violationCount, score) {
  let riskScore = 0;
  
  // Violations contribute to risk (each violation adds 15 points, max 60)
  riskScore += Math.min(violationCount * 15, 60);
  
  // Unusually high scores with violations increase risk
  if (violationCount > 0 && score >= 90) {
    riskScore += 20;
  }
  
  // Multiple faces detected is a major violation
  if (violationCount >= 3) {
    riskScore += 20;
  }
  
  return Math.min(riskScore, 100);
}

// Helper function to count high risk students
async function getHighRiskStudentsCount() {
  const answers = await Answer.find();
  let count = 0;
  
  for (const answer of answers) {
    const violationCount = await Violation.countDocuments({
      userId: answer.userId,
      examId: answer.examId
    });
    if (calculateRiskScore(violationCount, answer.score) >= 70) {
      count++;
    }
  }
  
  return count;
}

// GET /api/admin/exam/:examId/plagiarism - Detect plagiarism for an exam's coding submissions
exports.detectPlagiarism = async (req, res) => {
  try {
    const { examId } = req.params;
    const { threshold = 80, questionId } = req.query;

    // Build query for submissions
    let query = { examId, isSubmitted: true };
    if (questionId) {
      query.questionId = questionId;
    }

    // Get all submissions for the exam
    const submissions = await Submission.find(query)
      .populate('userId', 'name email')
      .populate('questionId', 'title');

    if (submissions.length < 2) {
      return res.status(200).json({
        success: true,
        message: 'Need at least 2 submissions to detect plagiarism',
        stats: {
          totalSubmissions: submissions.length,
          totalComparisons: 0,
          suspiciousPairs: 0,
          flaggedPercentage: 0,
          averageSimilarity: 0,
          highestSimilarity: 0,
          threshold: parseInt(threshold),
          pairs: []
        }
      });
    }

    // Format submissions for plagiarism detection
    const formattedSubmissions = submissions.map(sub => ({
      id: sub._id,
      userId: sub.userId._id,
      userName: sub.userId.name,
      userEmail: sub.userId.email,
      code: sub.code,
      language: sub.language,
      questionId: sub.questionId,
      submittedAt: sub.createdAt
    }));

    // Get plagiarism statistics
    const stats = getPlagiarismStats(formattedSubmissions, parseInt(threshold));

    // Auto-create violations for suspicious pairs
    const violationsCreated = [];
    for (const pair of stats.pairs) {
      // Check if violation already exists
      const existingViolation = await Violation.findOne({
        examId,
        type: 'plagiarism',
        'metadata.submission1Id': pair.submission1.id,
        'metadata.submission2Id': pair.submission2.id
      });

      if (!existingViolation) {
        // Create violation for the first student
        const violation1 = new Violation({
          userId: pair.submission1.userId,
          examId,
          type: 'plagiarism',
          severity: pair.similarity >= 90 ? 'critical' : 'high',
          description: `Plagiarism detected: ${pair.similarity.toFixed(2)}% similarity with ${pair.submission2.userName}`,
          metadata: {
            submission1Id: pair.submission1.id,
            submission2Id: pair.submission2.id,
            similarity: pair.similarity,
            threshold: pair.threshold
          }
        });
        await violation1.save();
        violationsCreated.push(violation1._id);

        // Create violation for the second student
        const violation2 = new Violation({
          userId: pair.submission2.userId,
          examId,
          type: 'plagiarism',
          severity: pair.similarity >= 90 ? 'critical' : 'high',
          description: `Plagiarism detected: ${pair.similarity.toFixed(2)}% similarity with ${pair.submission1.userName}`,
          metadata: {
            submission1Id: pair.submission2.id,
            submission2Id: pair.submission1.id,
            similarity: pair.similarity,
            threshold: pair.threshold
          }
        });
        await violation2.save();
        violationsCreated.push(violation2._id);
      }
    }

    res.status(200).json({
      success: true,
      stats,
      violationsCreated: violationsCreated.length
    });
  } catch (error) {
    console.error('Error detecting plagiarism:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect plagiarism'
    });
  }
};

// GET /api/admin/plagiarism/stats - Get overall plagiarism statistics
exports.getPlagiarismStatsOverall = async (req, res) => {
  try {
    const { examId, threshold = 80 } = req.query;

    let query = { isSubmitted: true };
    if (examId) {
      query.examId = examId;
    }

    const submissions = await Submission.find(query)
      .populate('userId', 'name email')
      .populate('examId', 'title');

    if (submissions.length < 2) {
      return res.status(200).json({
        success: true,
        stats: {
          totalSubmissions: submissions.length,
          totalComparisons: 0,
          suspiciousPairs: 0,
          averageSimilarity: 0,
          highestSimilarity: 0,
          threshold: parseInt(threshold)
        }
      });
    }

    const formattedSubmissions = submissions.map(sub => ({
      id: sub._id,
      userId: sub.userId._id,
      userName: sub.userId.name,
      userEmail: sub.userId.email,
      code: sub.code,
      language: sub.language,
      examId: sub.examId,
      submittedAt: sub.createdAt
    }));

    const stats = getPlagiarismStats(formattedSubmissions, parseInt(threshold));

    // Get plagiarism violations count
    const plagiarismViolations = await Violation.countDocuments({ type: 'plagiarism' });

    res.status(200).json({
      success: true,
      stats: {
        ...stats,
        plagiarismViolations
      }
    });
  } catch (error) {
    console.error('Error fetching plagiarism stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plagiarism statistics'
    });
  }
};

// GET /api/admin/submissions/:submissionId/compare/:otherSubmissionId - Compare two submissions
exports.compareSubmissions = async (req, res) => {
  try {
    const { submissionId, otherSubmissionId } = req.params;

    const submission1 = await Submission.findById(submissionId)
      .populate('userId', 'name email');
    const submission2 = await Submission.findById(otherSubmissionId)
      .populate('userId', 'name email');

    if (!submission1 || !submission2) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Calculate similarity
    const rawSimilarity = compareCodes(submission1.code, submission2.code, false);
    const normalizedSimilarity = compareCodes(submission1.code, submission2.code, true);

    res.status(200).json({
      success: true,
      comparison: {
        submission1: {
          id: submission1._id,
          user: submission1.userId,
          code: submission1.code,
          language: submission1.language,
          submittedAt: submission1.createdAt
        },
        submission2: {
          id: submission2._id,
          user: submission2.userId,
          code: submission2.code,
          language: submission2.language,
          submittedAt: submission2.createdAt
        },
        rawSimilarity,
        normalizedSimilarity,
        isSuspicious: normalizedSimilarity >= 80
      }
    });
  } catch (error) {
    console.error('Error comparing submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare submissions'
    });
  }
};
