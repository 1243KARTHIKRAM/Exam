const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function registerUser(data) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function loginUser(data) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// exam endpoints
export async function createExam(data, token) {
  const res = await fetch(`${API_URL}/api/exams/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getExams(token) {
  const res = await fetch(`${API_URL}/api/exams`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function deleteExam(id, token) {
  const res = await fetch(`${API_URL}/api/exams/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get available exams for students (visible based on date/time)
export async function getAvailableExams(token) {
  const res = await fetch(`${API_URL}/api/exams/available`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get exam by ID with questions
export async function getExamById(id, token) {
  const res = await fetch(`${API_URL}/api/exams/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function addQuestion(data, token) {
  const res = await fetch(`${API_URL}/api/questions/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Submit exam answers
export async function submitExamAnswers(examId, answers, token) {
  const res = await fetch(`${API_URL}/api/exams/${examId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ answers })
  });
  return res.json();
}

// Submit violation
export async function submitViolation(examId, type, snapshot, token) {
  const res = await fetch(`${API_URL}/api/violations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ examId, type, snapshot })
  });
  return res.json();
}

// Get violation count for current user in an exam
export async function getViolationCount(examId, token) {
  const res = await fetch(`${API_URL}/api/violations/count/${examId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Submit coding violation (paste, tab switch, fullscreen exit, etc.)
export async function submitCodingViolation(examId, type, metadata = {}, token) {
  const res = await fetch(`${API_URL}/api/violations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ 
      examId, 
      type, 
      metadata,
      description: getViolationDescription(type, metadata)
    })
  });
  return res.json();
}

// Helper to generate description based on violation type
function getViolationDescription(type, metadata) {
  switch (type) {
    case 'paste':
      return `Pasted ${metadata.length || 0} characters into code editor`;
    case 'tab_switch':
      return `Switched away from exam tab - ${metadata.duration || 0}ms`;
    case 'fullscreen_exit':
      return 'Exited fullscreen mode during exam';
    case 'copy_attempt':
      return `Attempted to copy ${metadata.length || 0} characters`;
    default:
      return 'Coding integrity violation detected';
  }
}

// Admin API endpoints

// Get dashboard statistics
export async function getDashboardStats(token) {
  const res = await fetch(`${API_URL}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get all exam attempts with filters
export async function getExamAttempts(examId, studentId, token) {
  const params = new URLSearchParams();
  if (examId) params.append('examId', examId);
  if (studentId) params.append('studentId', studentId);
  
  const res = await fetch(`${API_URL}/api/admin/exam-attempts?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get exam statistics
export async function getExamStats(examId, token) {
  const res = await fetch(`${API_URL}/api/admin/exam/${examId}/stats`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get all students
export async function getStudents(token) {
  const res = await fetch(`${API_URL}/api/admin/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get student violations
export async function getStudentViolations(studentId, examId, token) {
  const params = new URLSearchParams();
  if (examId) params.append('examId', examId);
  
  const res = await fetch(`${API_URL}/api/admin/student/${studentId}/violations?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Coding Question API endpoints

// Create a coding question (admin)
export async function createCodingQuestion(data, token) {
  const res = await fetch(`${API_URL}/api/code/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Get all coding questions for an exam
export async function getCodingQuestions(examId, token) {
  const res = await fetch(`${API_URL}/api/code/questions/exam/${examId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get a single coding question
export async function getCodingQuestion(questionId, token) {
  const res = await fetch(`${API_URL}/api/code/questions/${questionId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Run code (test with sample test cases only)
export async function runCode(data, token) {
  const res = await fetch(`${API_URL}/api/code/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Execute code without a question (quick test)
export async function executeCode(data, token) {
  const res = await fetch(`${API_URL}/api/code/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Submit code (run all test cases and save)
export async function submitCode(data, token) {
  const res = await fetch(`${API_URL}/api/code/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Execute code (legacy - for backward compatibility)
// This function is kept for backward compatibility but points to submit

// Get user's submissions for a question
export async function getUserSubmissions(questionId, token) {
  const res = await fetch(`${API_URL}/api/code/submissions/${questionId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Update a coding question (admin)
export async function updateCodingQuestion(questionId, data, token) {
  const res = await fetch(`${API_URL}/api/code/questions/${questionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Delete a coding question (admin)
export async function deleteCodingQuestion(questionId, token) {
  const res = await fetch(`${API_URL}/api/code/questions/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// ==================== PLAGIARISM DETECTION API ====================

// Detect plagiarism for an exam's coding submissions
export async function detectPlagiarism(examId, threshold = 80, questionId = null, token) {
  const params = new URLSearchParams({ threshold: threshold.toString() });
  if (questionId) params.append('questionId', questionId);
  
  const res = await fetch(`${API_URL}/api/admin/exam/${examId}/plagiarism?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Get overall plagiarism statistics
export async function getPlagiarismStats(examId = null, threshold = 80, token) {
  const params = new URLSearchParams({ threshold: threshold.toString() });
  if (examId) params.append('examId', examId);
  
  const res = await fetch(`${API_URL}/api/admin/plagiarism/stats?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// Compare two submissions
export async function compareSubmissions(submissionId, otherSubmissionId, token) {
  const res = await fetch(`${API_URL}/api/admin/submissions/${submissionId}/compare/${otherSubmissionId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}
