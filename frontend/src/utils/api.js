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
