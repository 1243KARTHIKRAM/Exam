const axios = require('axios');
const CodingQuestion = require('../models/CodingQuestion');
const Submission = require('../models/Submission');

// Judge0 API configuration
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';
const JUDGE0_HOST = process.env.JUDGE0_HOST || 'judge0-ce.p.rapidapi.com';

// Language IDs for Judge0
const LANGUAGE_IDS = {
  javascript: 63,  // Node.js
  python: 71,      // Python 3
  java: 62,       // Java (OpenJDK)
  cpp: 54          // C++ (GCC 9.2.0)
};

// Security: Allowed patterns to prevent malicious code execution
const FORBIDDEN_PATTERNS = [
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /require\s*\(\s*['"]net['"]\s*\)/,
  /require\s*\(\s*['"]http['"]\s*\)/,
  /require\s*\(\s*['"]https['"]\s*\)/,
  /require\s*\(\s*['"]dns['"]\s*\)/,
  /import\s+.*\s+from\s+['"]child_process['"]/,
  /import\s+.*\s+from\s+['"]fs['"]/,
  /exec\s*\(/,
  /execSync\s*\(/,
  /spawn\s*\(/,
  /spawnSync\s*\(/,
  /eval\s*\(/,
  /Function\s*\(/,
  /__import__\s*\(\s*['"]os['"]\s*\)/,
  /__import__\s*\(\s*['"]subprocess['"]\s*\)/,
  /import\s+os\b/,
  /import\s+subprocess\b/,
  /from\s+os\s+import/,
  /from\s+subprocess\s+import/,
  /System\.exit\s*\(/,
  /Runtime\.getRuntime\s*\(\s*\)/,
  /ProcessBuilder\s*\(/,
  /include\s*<unistd\.h>/,
  /include\s*<sys\/.*\.h>/,
  /fopen\s*\(/,
  /FILE\s*\*/
];

// Validate code for security concerns
function validateCode(code, language) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: `Forbidden pattern detected: ${pattern.source}` };
    }
  }
  
  // Additional language-specific checks
  if (language === 'javascript') {
    // Check for infinite loops with suspicious patterns
    const suspiciousLoops = /(while\s*\(true\)|for\s*\(\s*;\s*;\s*\))(?![\s\S]*break)/gi;
    if (suspiciousLoops.test(code)) {
      // Allow but log for monitoring
      console.warn('Suspicious loop pattern detected in JavaScript code');
    }
  }
  
  return { valid: true };
}

// Create a new coding question
exports.createCodingQuestion = async (req, res) => {
  try {
    const { examId, title, description, constraints, testCases, defaultCode, timeLimit, memoryLimit, difficulty, points } = req.body;
    
    const codingQuestion = new CodingQuestion({
      examId,
      title,
      description,
      constraints,
      testCases,
      defaultCode,
      timeLimit,
      memoryLimit,
      difficulty,
      points
    });
    
    await codingQuestion.save();
    res.status(201).json({ success: true, question: codingQuestion });
  } catch (error) {
    console.error('Error creating coding question:', error);
    res.status(500).json({ success: false, message: 'Failed to create coding question' });
  }
};

// Get all coding questions for an exam
exports.getCodingQuestions = async (req, res) => {
  try {
    const { examId } = req.params;
    const questions = await CodingQuestion.find({ examId }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, questions });
  } catch (error) {
    console.error('Error fetching coding questions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coding questions' });
  }
};

// Get a single coding question
exports.getCodingQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const question = await CodingQuestion.findById(questionId);
    
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    
    // Hide test case outputs for non-admin users
    const sanitizedQuestion = question.toObject();
    if (req.user.role !== 'admin') {
      sanitizedQuestion.testCases = sanitizedQuestion.testCases.map(tc => ({
        ...tc,
        expectedOutput: tc.isHidden ? 'Hidden' : tc.expectedOutput
      }));
    }
    
    res.status(200).json({ success: true, question: sanitizedQuestion });
  } catch (error) {
    console.error('Error fetching coding question:', error);
    res.status(500).json({ message: 'Failed to fetch coding question' });
  }
};

// Run code - executes with sample test cases only (for testing)
exports.runCode = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;
    const userId = req.user._id;
    
    // Validate input
    if (!questionId || !code || !language) {
      return res.status(400).json({ success: false, message: 'Missing required fields: questionId, code, language' });
    }
    
    // Validate language
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      return res.status(400).json({ success: false, message: 'Unsupported language' });
    }
    
    // Security check
    const securityCheck = validateCode(code, language);
    if (!securityCheck.valid) {
      return res.status(403).json({ success: false, message: 'Code contains forbidden patterns', reason: securityCheck.reason });
    }
    
    // Get the question
    const question = await CodingQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    
    // Get only visible (non-hidden) test cases for running
    const testCases = question.testCases.filter(tc => !tc.isHidden).slice(0, 1);
    
    if (testCases.length === 0) {
      return res.status(400).json({ success: false, message: 'No sample test cases available' });
    }
    
    // Execute code for each sample test case
    const results = [];
    let allPassed = true;
    
    for (const testCase of testCases) {
      const result = await runOnJudge0(code, languageId, testCase.input, question.timeLimit);
      
      const testResult = {
        testCaseId: testCase._id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.stdout || '',
        status: result.status.description,
        executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
        memory: result.memory || 0
      };
      
      // Check if output matches
      const expected = testCase.expectedOutput.trim();
      const actual = (result.stdout || '').trim();
      
      if (expected !== actual) {
        allPassed = false;
        testResult.status = 'Wrong Answer';
      } else {
        testResult.status = 'Accepted';
      }
      
      results.push(testResult);
    }
    
    res.status(200).json({
      success: true,
      type: 'run',
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'Accepted').length,
        failed: results.filter(r => r.status !== 'Accepted').length
      }
    });
  } catch (error) {
    console.error('Error running code:', error);
    res.status(500).json({ success: false, message: 'Failed to run code' });
  }
};

// Submit code - executes all test cases and saves the submission
exports.submitCode = async (req, res) => {
  try {
    const { questionId, code, language } = req.body;
    const userId = req.user._id;
    
    // Validate input
    if (!questionId || !code || !language) {
      return res.status(400).json({ success: false, message: 'Missing required fields: questionId, code, language' });
    }
    
    // Validate language
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      return res.status(400).json({ success: false, message: 'Unsupported language' });
    }
    
    // Security check
    const securityCheck = validateCode(code, language);
    if (!securityCheck.valid) {
      return res.status(403).json({ success: false, message: 'Code contains forbidden patterns', reason: securityCheck.reason });
    }
    
    // Get the question
    const question = await CodingQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    
    // Get all test cases for submission
    const testCases = question.testCases;
    
    if (testCases.length === 0) {
      return res.status(400).json({ success: false, message: 'No test cases available' });
    }
    
    // Create submission record
    const submission = new Submission({
      examId: question.examId,
      questionId,
      userId,
      code,
      language,
      status: 'Running',
      isSubmitted: true
    });
    await submission.save();
    
    // Execute code for each test case
    const results = [];
    let allPassed = true;
    
    for (const testCase of testCases) {
      const result = await runOnJudge0(code, languageId, testCase.input, question.timeLimit);
      
      const testResult = {
        testCaseId: testCase._id,
        input: testCase.input,
        expectedOutput: testCase.isHidden ? 'Hidden' : testCase.expectedOutput,
        actualOutput: result.stdout || '',
        status: result.status.description,
        executionTime: result.time ? parseFloat(result.time) * 1000 : 0,
        memory: result.memory || 0
      };
      
      // Check if output matches (skip for hidden test cases)
      if (!testCase.isHidden) {
        const expected = testCase.expectedOutput.trim();
        const actual = (result.stdout || '').trim();
        
        if (expected !== actual) {
          allPassed = false;
          testResult.status = 'Wrong Answer';
        } else {
          testResult.status = 'Accepted';
        }
      } else {
        // For hidden test cases, we can't reveal if it passed or failed
        testResult.status = result.status.description === 'Accepted' ? 'Accepted' : 'Failed';
        if (testResult.status === 'Failed') {
          allPassed = false;
        }
      }
      
      results.push(testResult);
    }
    
    // Update submission with results
    submission.testCaseResults = results;
    submission.status = allPassed ? 'Accepted' : 'Wrong Answer';
    submission.score = allPassed ? question.points : 0;
    submission.executionTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    await submission.save();
    
    res.status(200).json({
      success: true,
      type: 'submit',
      submissionId: submission._id,
      status: submission.status,
      score: submission.score,
      totalTests: results.length,
      results: results.map(r => ({
        testCaseId: r.testCaseId,
        status: r.status,
        executionTime: r.executionTime,
        memory: r.memory
      }))
    });
  } catch (error) {
    console.error('Error submitting code:', error);
    res.status(500).json({ success: false, message: 'Failed to submit code' });
  }
};

// Helper function to run code on Judge0
async function runOnJudge0(code, languageId, input, timeLimit) {
  try {
    // Create submission
    const createResponse = await axios.post(
      `${JUDGE0_API_URL}/submissions`,
      {
        source_code: code,
        language_id: languageId,
        stdin: input,
        time_limit: timeLimit / 1000,
        memory_limit: 128000,
        wait: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': JUDGE0_API_KEY,
          'X-RapidAPI-Host': JUDGE0_HOST
        },
        timeout: 30000
      }
    );
    
    return createResponse.data;
  } catch (error) {
    console.error('Judge0 API error:', error.response?.data || error.message);
    return {
      status: { description: 'Error' },
      stdout: '',
      time: 0,
      memory: 0,
      stderr: error.message
    };
  }
}

// Get user's submissions for a question
exports.getUserSubmissions = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user._id;
    
    const submissions = await Submission.find({ questionId, userId })
      .sort({ createdAt: -1 })
      .select('status score language createdAt isSubmitted testCaseResults');
    
    res.status(200).json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
};

// Get all submissions for a question (admin only)
exports.getAllSubmissions = async (req, res) => {
  try {
    const { questionId } = req.params;
    
    const submissions = await Submission.find({ questionId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
};

// Update a coding question
exports.updateCodingQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const updates = req.body;
    
    const question = await CodingQuestion.findByIdAndUpdate(
      questionId,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    
    res.status(200).json({ success: true, question });
  } catch (error) {
    console.error('Error updating coding question:', error);
    res.status(500).json({ success: false, message: 'Failed to update coding question' });
  }
};

// Delete a coding question
exports.deleteCodingQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    
    const question = await CodingQuestion.findByIdAndDelete(questionId);
    
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    
    // Also delete all submissions for this question
    await Submission.deleteMany({ questionId });
    
    res.status(200).json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting coding question:', error);
    res.status(500).json({ success: false, message: 'Failed to delete coding question' });
  }
};
