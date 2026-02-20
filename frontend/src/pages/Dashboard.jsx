import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createExam, getExams, deleteExam, addQuestion } from '../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState({ title: '', duration: '', date: '' });
  const [questionForm, setQuestionForm] = useState({ questionText: '', options: ['', '', '', ''], correctAnswer: '' });
  const [selectedExam, setSelectedExam] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    // fetch protected message for demonstration
    fetch('http://localhost:5000/api/test/private', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setMessage(data.message || ''))
      .catch((err) => console.error(err));

    if (role === 'admin') {
      loadExams();
    }
  }, [navigate, token, role]);

  const loadExams = async () => {
    const data = await getExams(token);
    setExams(data);
  };

  const handleExamChange = (e) => {
    setExamForm({ ...examForm, [e.target.name]: e.target.value });
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setError('');
    if (!examForm.title || !examForm.duration || !examForm.date) {
      setError('All exam fields required');
      return;
    }
    const res = await createExam(examForm, token);
    if (res._id) {
      setExamForm({ title: '', duration: '', date: '' });
      loadExams();
    } else {
      setError(res.message || 'Failed to create exam');
    }
  };

  const handleDelete = async (id) => {
    await deleteExam(id, token);
    loadExams();
  };

  const handleQuestionChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('option')) {
      const idx = parseInt(name.split('option')[1], 10);
      const opts = [...questionForm.options];
      opts[idx] = value;
      setQuestionForm({ ...questionForm, options: opts });
    } else {
      setQuestionForm({ ...questionForm, [name]: value });
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedExam) {
      setError('Select an exam');
      return;
    }
    const payload = { ...questionForm, examId: selectedExam };
    const res = await addQuestion(payload, token);
    if (res._id) {
      setQuestionForm({ questionText: '', options: ['', '', '', ''], correctAnswer: '' });
    } else {
      setError(res.message || 'Failed to add question');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/');
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold mb-4">Dashboard</h2>
        <button onClick={logout} className="bg-red-500 text-white py-2 px-4">
          Logout
        </button>
      </div>
      {message && <p className="mb-2">{message}</p>}
      {role === 'admin' && (
        <div>
          <h3 className="text-xl mt-4">Create Exam</h3>
          {error && <div className="text-red-600">{error}</div>}
          <form className="mb-6" onSubmit={handleCreateExam}>
            <input
              name="title"
              placeholder="Title"
              value={examForm.title}
              onChange={handleExamChange}
              className="border p-2 mr-2"
            />
            <input
              name="duration"
              type="number"
              placeholder="Duration (mins)"
              value={examForm.duration}
              onChange={handleExamChange}
              className="border p-2 mr-2"
            />
            <input
              name="date"
              type="date"
              value={examForm.date}
              onChange={handleExamChange}
              className="border p-2 mr-2"
            />
            <button type="submit" className="bg-blue-600 text-white py-2 px-4">
              Create
            </button>
          </form>

          <h3 className="text-xl">Add Questions</h3>
          <select
            value={selectedExam || ''}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="border p-2 mb-2"
          >
            <option value="">-- select exam --</option>
            {exams.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.title}
              </option>
            ))}
          </select>
          <form onSubmit={handleAddQuestion} className="mb-6">
            <input
              name="questionText"
              placeholder="Question text"
              value={questionForm.questionText}
              onChange={handleQuestionChange}
              className="border p-2 w-full mb-2"
            />
            {questionForm.options.map((opt, idx) => (
              <input
                key={idx}
                name={`option${idx}`}
                placeholder={`Option ${idx + 1}`}
                value={opt}
                onChange={handleQuestionChange}
                className="border p-2 w-full mb-2"
              />
            ))}
            <input
              name="correctAnswer"
              placeholder="Correct answer"
              value={questionForm.correctAnswer}
              onChange={handleQuestionChange}
              className="border p-2 w-full mb-2"
            />
            <button type="submit" className="bg-green-600 text-white py-2 px-4">
              Add Question
            </button>
          </form>

          <h3 className="text-xl">Exams List</h3>
          <ul>
            {exams.map((ex) => (
              <li key={ex._id} className="flex justify-between items-center mb-2">
                <span>{ex.title} ({new Date(ex.date).toLocaleDateString()})</span>
                <button
                  onClick={() => handleDelete(ex._id)}
                  className="bg-red-500 text-white py-1 px-3"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
