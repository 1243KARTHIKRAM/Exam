const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');
const CodingQuestion = require('../models/CodingQuestion');
const Submission = require('../models/Submission');

// Language configuration for local execution
const LOCAL_LANGUAGES = {
  cpp: {
    extension: 'temp.cpp',
    compileCommand: 'g++ temp.cpp -o temp.exe',
    runCommand: 'temp.exe',
    compileFirst: true
  },
  java: {
    extension: 'Main.java',
    compileCommand: 'javac Main.java',
    runCommand: 'java Main',
    compileFirst: true
  },
  python: {
    extension: 'temp.py',
    compileCommand: null,
    runCommand: 'python temp.py',
    compileFirst: false
  },
  javascript: {
    extension: 'temp.js',
    compileCommand: null,
    runCommand: 'node temp.js',
    compileFirst: false
  }
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
    if (!LOCAL_LANGUAGES[language]) {
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
    let errorOutput = '';
    
    for (const testCase of testCases) {
      const result = await runLocally(code, language, testCase.input);
      
      // Capture error if present
      if (result.error) {
        errorOutput += result.error;
      }
      
      const testResult = {
        testCaseId: testCase._id,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.output || '',
        stderr: result.error || '',
        status: result.status,
        executionTime: 0,
        memory: 0
      };
      
      // Check if output matches
      const expected = testCase.expectedOutput.trim();
      const actual = (result.output || '').trim();
      
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
      stdout: results[0]?.actualOutput || '',
      stderr: errorOutput,
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

// Execute code without a question (quick test)
exports.executeCode = async (req, res) => {
  try {
    const { code, language, input } = req.body;
    
    // Validate input
    if (!code || !language) {
      return res.status(400).json({ success: false, message: 'Missing required fields: code, language' });
    }
    
    // Validate language
    if (!LOCAL_LANGUAGES[language]) {
      return res.status(400).json({ success: false, message: 'Unsupported language', supportedLanguages: Object.keys(LOCAL_LANGUAGES) });
    }
    
    // Security check
    const securityCheck = validateCode(code, language);
    if (!securityCheck.valid) {
      return res.status(403).json({ success: false, message: 'Code contains forbidden patterns', reason: securityCheck.reason });
    }
    
    // Execute code
    const result = await runLocally(code, language, input || '');
    
    res.status(200).json({
      success: true,
      type: 'execute',
      output: result.output || '',
      error: result.error || '',
      status: result.status,
      executionTime: 0,
      memory: 0
    });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({ success: false, message: 'Failed to execute code', error: error.message });
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
    if (!LOCAL_LANGUAGES[language]) {
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
    let errorOutput = '';
    
    for (const testCase of testCases) {
      const result = await runLocally(code, language, testCase.input);
      
      // Capture error if present
      if (result.error) {
        errorOutput += result.error;
      }
      
      const testResult = {
        testCaseId: testCase._id,
        input: testCase.input,
        expectedOutput: testCase.isHidden ? 'Hidden' : testCase.expectedOutput,
        actualOutput: result.output || '',
        stderr: result.error || '',
        status: result.status,
        executionTime: 0,
        memory: 0
      };
      
      // Check if output matches (skip for hidden test cases)
      if (!testCase.isHidden) {
        const expected = testCase.expectedOutput.trim();
        const actual = (result.output || '').trim();
        
        if (expected !== actual) {
          allPassed = false;
          testResult.status = 'Wrong Answer';
        } else {
          testResult.status = 'Accepted';
        }
      } else {
        // For hidden test cases, we can't reveal if it passed or failed
        testResult.status = result.status === 'ok' ? 'Accepted' : 'Failed';
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
    
    // Return API response in required format
    res.status(200).json({
      success: true,
      results: results.map(r => ({
        input: r.input,
        expected: r.expectedOutput,
        output: r.actualOutput,
        passed: r.status === 'Accepted'
      }))
    });
  } catch (error) {
    console.error('Error submitting code:', error);
    res.status(500).json({ success: false, message: 'Failed to submit code' });
  }
};

// Helper function to run code locally
async function runLocally(code, language, stdin = '') {
  const langConfig = LOCAL_LANGUAGES[language];
  if (!langConfig) {
    return {
      output: '',
      error: `Unsupported language: ${language}`,
      status: 'Error'
    };
  }

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `code_exec_${Date.now()}`);
  const codeFile = path.join(tempDir, langConfig.extension);

  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Write code to file
    fs.writeFileSync(codeFile, code, 'utf8');

    let stdout = '';
    let stderr = '';
    let compileError = '';

    // Compile if needed (for C++ and Java)
    if (langConfig.compileFirst && langConfig.compileCommand) {
      const compileResult = await executeCommand(langConfig.compileCommand, tempDir, '');
      compileError = compileResult.error;
      
      if (compileError) {
        // Clean up and return compilation error
        cleanupTempFiles(tempDir, langConfig.extension);
        return {
          output: '',
          error: compileError,
          status: 'Compilation Error'
        };
      }
    }

    // Run the code
    const runResult = await executeCommand(langConfig.runCommand, tempDir, stdin);
    stdout = runResult.output;
    stderr = runResult.error;

    // Determine status
    let status = 'ok';
    if (stderr || compileError) {
      status = 'Runtime Error';
    }

    return {
      output: stdout,
      error: stderr || compileError,
      status
    };
  } catch (error) {
    console.error('Local execution error:', error);
    return {
      output: '',
      error: error.message || 'Failed to execute code locally',
      status: 'Error'
    };
  } finally {
    // Clean up temp files
    cleanupTempFiles(tempDir, langConfig.extension);
  }
}

// Execute a command and return stdout/stderr
function executeCommand(command, cwd, stdin) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellFlag = isWindows ? '/c' : '-c';

    const child = spawn(shell, [shellFlag, command], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send stdin if provided
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      stderr += '\nExecution timed out (30 seconds)';
    }, 30000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ output: stdout, error: stderr, code });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ output: stdout, error: error.message, code: -1 });
    });
  });
}

// Clean up temp files
function cleanupTempFiles(tempDir, codeFile) {
  try {
    if (fs.existsSync(tempDir)) {
      // Delete code file
      const codePath = path.join(tempDir, codeFile);
      if (fs.existsSync(codePath)) {
        fs.unlinkSync(codePath);
      }
      
      // Delete executable (for C++)
      const exePath = path.join(tempDir, 'temp.exe');
      if (fs.existsSync(exePath)) {
        fs.unlinkSync(exePath);
      }
      
      // Delete class files (for Java)
      const classPath = path.join(tempDir, 'Main.class');
      if (fs.existsSync(classPath)) {
        fs.unlinkSync(classPath);
      }
      
      // Remove temp directory
      fs.rmdirSync(tempDir);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
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
