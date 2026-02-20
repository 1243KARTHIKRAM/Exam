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

export async function addQuestion(data, token) {
  const res = await fetch(`${API_URL}/api/questions/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return res.json();
}
