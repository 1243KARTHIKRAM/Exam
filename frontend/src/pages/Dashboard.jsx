import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { createExam, getExams, deleteExam, addQuestion, createCodingQuestion, getCodingQuestions } from '../utils/api';
import CodingQuestionForm from '../components/CodingQuestionForm';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [message, setMessage] = useState('');
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState({ title: '', duration: '', date: '' });
  const [questionForm, setQuestionForm] = useState({ questionText: '', options: ['', '', '', ''], correctAnswer: '' });
  const [selectedExam, setSelectedExam] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('exams');
  const [loading, setLoading] = useState(false);
  const [showCodingQuestionForm, setShowCodingQuestionForm] = useState(false);
  const [codingQuestions, setCodingQuestions] = useState([]);

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Admin';

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    if (role !== 'admin') {
      navigate('/student-dashboard');
      return;
    }

    fetch('http://localhost:5000/api/test/private', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => setMessage(data.message || ''))
      .catch((err) => console.error(err));

    loadExams();
  }, [navigate, token, role]);

  const loadExams = async () => {
    const data = await getExams(token);
    setExams(data || []);
  };

  const handleExamChange = (e) => {
    setExamForm({ ...examForm, [e.target.name]: e.target.value });
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!examForm.title || !examForm.duration || !examForm.date) {
      setError('All exam fields are required');
      setLoading(false);
      return;
    }
    const res = await createExam(examForm, token);
    setLoading(false);
    if (res._id) {
      setExamForm({ title: '', duration: '', date: '' });
      loadExams();
      setActiveTab('exams');
    } else {
      setError(res.message || 'Failed to create exam');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      await deleteExam(id, token);
      loadExams();
    }
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
    setLoading(true);
    if (!selectedExam) {
      setError('Please select an exam');
      setLoading(false);
      return;
    }
    const payload = { ...questionForm, examId: selectedExam };
    const res = await addQuestion(payload, token);
    setLoading(false);
    if (res._id) {
      setQuestionForm({ questionText: '', options: ['', '', '', ''], correctAnswer: '' });
    } else {
      setError(res.message || 'Failed to add question');
    }
  };

  const handleCreateCodingQuestion = async (data) => {
    setError('');
    setLoading(true);
    if (!selectedExam) {
      setError('Please select an exam');
      setLoading(false);
      return;
    }
    const res = await createCodingQuestion({ ...data, examId: selectedExam }, token);
    setLoading(false);
    if (res.success) {
      setShowCodingQuestionForm(false);
      loadCodingQuestions(selectedExam);
    } else {
      setError(res.message || 'Failed to create coding question');
    }
  };

  const loadCodingQuestions = async (examId) => {
    const res = await getCodingQuestions(examId, token);
    if (res.success) {
      setCodingQuestions(res.questions || []);
    }
  };

  const handleSelectExam = (examId) => {
    setSelectedExam(examId);
    loadCodingQuestions(examId);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    navigate('/');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Proctor</h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Admin Dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Profile */}
              <div className={`hidden md:flex items-center space-x-3 ${isDark ? 'bg-slate-700' : 'bg-gray-100'} px-3 py-1.5 rounded-full`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-primary-400 flex items-center justify-center text-white font-semibold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{userName}</span>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isDark 
                    ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  isDark 
                    ? 'bg-slate-700 text-slate-200 hover:bg-red-900/50 hover:text-red-400' 
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/admin-dashboard')}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-500/30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Monitoring Dashboard</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-transparent rounded-xl p-1">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'exams'
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`
            }`}
          >
            <span className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Exams</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'questions'
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-lg shadow-accent-500/30'
                : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`
            }`}
          >
            <span className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Questions</span>
            </span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-xl border ${
            isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center">
              <svg className={`w-5 h-5 mr-3 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`${isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
            </div>
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === 'exams' && (
          <div className={`rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} shadow-xl`}>
            <div className={`p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Create New Exam</h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Set up a new exam with AI proctoring</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreateExam} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Exam Title</label>
                  <input
                    name="title"
                    placeholder="e.g., Mathematics Final"
                    value={examForm.title}
                    onChange={handleExamChange}
                    className={`w-full px-4 py-3 rounded-lg border transition-all ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Duration (minutes)</label>
                  <input
                    name="duration"
                    type="number"
                    placeholder="60"
                    value={examForm.duration}
                    onChange={handleExamChange}
                    className={`w-full px-4 py-3 rounded-lg border transition-all ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Exam Date</label>
                  <input
                    name="date"
                    type="date"
                    value={examForm.date}
                    onChange={handleExamChange}
                    className={`w-full px-4 py-3 rounded-lg border transition-all ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20' 
                        : 'bg-white border-gray-300 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                    }`}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg shadow-primary-500/30 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Exam'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className={`rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} shadow-xl`}>
            <div className={`p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Questions</h2>
                  <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Add questions to your exams</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowCodingQuestionForm(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      !showCodingQuestionForm
                        ? 'bg-accent-500 text-white'
                        : isDark
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    MCQ Question
                  </button>
                  <button
                    onClick={() => setShowCodingQuestionForm(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      showCodingQuestionForm
                        ? 'bg-accent-500 text-white'
                        : isDark
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Coding Question
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Select Exam</label>
                <select
                  value={selectedExam || ''}
                  onChange={(e) => handleSelectExam(e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all ${
                    isDark 
                      ? 'bg-slate-700 border-slate-600 text-white focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20' 
                      : 'bg-white border-gray-300 text-gray-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'
                  }`}
                >
                  <option value="">-- select exam --</option>
                  {exams.map((ex) => (
                    <option key={ex._id} value={ex._id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              {!showCodingQuestionForm ? (
                <form onSubmit={handleAddQuestion} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Question Text</label>
                    <input
                      name="questionText"
                      placeholder="Enter your question"
                      value={questionForm.questionText}
                      onChange={handleQuestionChange}
                      className={`w-full px-4 py-3 rounded-lg border transition-all ${
                        isDark 
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {questionForm.options.map((opt, idx) => (
                      <div key={idx}>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Option {idx + 1}</label>
                        <input
                          name={`option${idx}`}
                          placeholder={`Option ${idx + 1}`}
                          value={opt}
                          onChange={handleQuestionChange}
                          className={`w-full px-4 py-3 rounded-lg border transition-all ${
                            isDark 
                              ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Correct Answer</label>
                    <input
                      name="correctAnswer"
                      placeholder="Enter the correct answer"
                      value={questionForm.correctAnswer}
                      onChange={handleQuestionChange}
                      className={`w-full px-4 py-3 rounded-lg border transition-all ${
                        isDark 
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-lg shadow-accent-500/30 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Question'}
                  </button>
                </form>
              ) : (
                <CodingQuestionForm
                  examId={selectedExam}
                  onSubmit={handleCreateCodingQuestion}
                  onCancel={() => setShowCodingQuestionForm(false)}
                />
              )}

              {/* Show existing coding questions */}
              {codingQuestions.length > 0 && (
                <div className="mt-6">
                  <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Existing Coding Questions ({codingQuestions.length})
                  </h3>
                  <div className="space-y-2">
                    {codingQuestions.map((q) => (
                      <div
                        key={q._id}
                        className={`p-4 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{q.title}</h4>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                              {q.difficulty} • {q.points} points • {q.testCases?.length || 0} test cases
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            q.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                            q.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {q.difficulty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exams List */}
        {activeTab === 'exams' && exams.length > 0 && (
          <div className={`mt-6 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} shadow-xl overflow-hidden`}>
            <div className={`p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Existing Exams</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDark ? 'bg-slate-700/50' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Title</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Duration</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Date</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {exams.map((ex) => (
                    <tr key={ex._id} className={`${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className={`px-6 py-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{ex.title}</td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{ex.duration} mins</td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{new Date(ex.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(ex._id)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
