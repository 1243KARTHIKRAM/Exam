import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getAvailableExams } from '../utils/api';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const userName = localStorage.getItem('userName') || 'Student';

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    if (role === 'admin') {
      navigate('/dashboard');
      return;
    }

    loadAvailableExams();
  }, [navigate, token, role]);

  const loadAvailableExams = async () => {
    try {
      setLoading(true);
      const data = await getAvailableExams(token);
      if (Array.isArray(data)) {
        setExams(data);
      } else {
        setError(data.message || 'Failed to load exams');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (examId) => {
    navigate(`/exam/${examId}`);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    navigate('/');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Proctor</h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Student Dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Profile */}
              <div className={`hidden md:flex items-center space-x-3 ${isDark ? 'bg-slate-700' : 'bg-gray-100'} px-3 py-1.5 rounded-full`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-semibold text-sm">
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
        {/* Page Header */}
        <div className="mb-8">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Available Exams</h2>
          <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Browse and start your exams below</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
              <p className={`mt-4 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Loading exams...</p>
            </div>
          </div>
        )}

        {/* Error State */}
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

        {/* Empty State */}
        {!loading && !error && exams.length === 0 && (
          <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${
            isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-200 bg-white'
          }`}>
            <div className="flex justify-center mb-4">
              <div className={`p-4 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                <svg className={`w-12 h-12 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>No exams available</h3>
            <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              There are no exams available at the moment. Please check back later.
            </p>
          </div>
        )}

        {/* Exam Cards Grid */}
        {!loading && !error && exams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam, index) => (
              <div
                key={exam._id}
                className={`group relative rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 hover:border-primary-500/50 hover:shadow-primary-500/10' 
                    : 'bg-white border-gray-200 hover:border-primary-300 hover:shadow-primary-500/20'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Card Header */}
                <div className={`p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-primary-600 transition-colors`}>
                        {exam.title}
                      </h3>
                      <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        Created by {exam.createdBy?.name || 'Unknown'}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      isDark ? 'bg-primary-900/50 text-primary-400' : 'bg-primary-100 text-primary-700'
                    }`}>
                      {exam.duration} min
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm">
                      <svg className={`w-4 h-4 mr-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>{formatDate(exam.date)}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <svg className={`w-4 h-4 mr-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>AI Proctoring Enabled</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartExam(exam._id)}
                    className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 flex items-center justify-center group-hover:scale-[1.02]"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Exam
                  </button>
                </div>

                {/* Decorative Corner */}
                <div className={`absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl ${
                  isDark ? 'bg-slate-700/50' : 'bg-gray-50'
                }`}>
                  <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-primary-500/20 to-transparent"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
