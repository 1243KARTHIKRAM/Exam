import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { 
  getDashboardStats, 
  getExamAttempts, 
  getExamStats, 
  getStudents, 
  getExams,
  detectPlagiarism,
  getPlagiarismStats
} from '../utils/api';
import ChatbotAnalytics from '../components/ChatbotAnalytics';

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [violations, setViolations] = useState([]);
  
  // Plagiarism detection state
  const [plagiarismStats, setPlagiarismStats] = useState(null);
  const [plagiarismLoading, setPlagiarismLoading] = useState(false);
  const [plagiarismThreshold, setPlagiarismThreshold] = useState(80);
  const [selectedPlagiarismExam, setSelectedPlagiarismExam] = useState('');
  const [selectedPair, setSelectedPair] = useState(null);

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  useEffect(() => {
    if (!token || userRole !== 'admin') {
      navigate('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, examsRes, studentsRes] = await Promise.all([
        getDashboardStats(token),
        getExams(token),
        getStudents(token)
      ]);
      
      if (statsRes.success) setStats(statsRes.stats);
      if (examsRes) setExams(examsRes);
      if (studentsRes.success) setStudents(studentsRes.students);
      
      // Load all attempts
      const attemptsRes = await getExamAttempts(null, null, token);
      if (attemptsRes.success) setAttempts(attemptsRes.attempts);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const res = await getExamAttempts(selectedExam || null, selectedStudent || null, token);
      if (res.success) setAttempts(res.attempts);
    } catch (error) {
      console.error('Error filtering:', error);
    }
    setLoading(false);
  };

  const viewViolations = async (studentId, examId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/student/${studentId}/violations?examId=${examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setViolations(data.violations);
        setSelectedAttempt({ studentId, examId });
      }
    } catch (error) {
      console.error('Error fetching violations:', error);
    }
  };

  const getRiskColor = (score) => {
    if (score >= 70) return 'bg-red-100 text-red-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getRiskLabel = (score) => {
    if (score >= 70) return 'High Risk';
    if (score >= 40) return 'Medium Risk';
    return 'Low Risk';
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Exam Monitoring Report', 20, 20);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
    
    // Overview Stats
    doc.setFontSize(14);
    doc.text('Overview Statistics', 20, 45);
    doc.setFontSize(10);
    doc.text(`Total Exams: ${stats?.totalExams || 0}`, 20, 55);
    doc.text(`Total Students: ${stats?.totalStudents || 0}`, 20, 62);
    doc.text(`Total Attempts: ${stats?.totalAttempts || 0}`, 20, 69);
    doc.text(`Total Violations: ${stats?.totalViolations || 0}`, 20, 76);
    doc.text(`Average Score: ${stats?.averageScore || 0}%`, 20, 83);
    doc.text(`High Risk Students: ${stats?.highRiskStudents || 0}`, 20, 90);
    
    // Attempts Table
    doc.setFontSize(14);
    doc.text('Exam Attempts', 20, 105);
    
    let yPos = 115;
    doc.setFontSize(8);
    doc.text('Student', 20, yPos);
    doc.text('Exam', 60, yPos);
    doc.text('Score', 110, yPos);
    doc.text('Violations', 130, yPos);
    doc.text('Risk', 155, yPos);
    
    yPos += 7;
    attempts.forEach((attempt, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const name = attempt.student?.name?.substring(0, 15) || 'N/A';
      const exam = attempt.exam?.title?.substring(0, 15) || 'N/A';
      doc.text(name, 20, yPos);
      doc.text(exam, 60, yPos);
      doc.text(`${attempt.score}%`, 110, yPos);
      doc.text(`${attempt.violationCount}`, 130, yPos);
      doc.text(getRiskLabel(attempt.riskScore), 155, yPos);
      yPos += 7;
    });
    
    doc.save(`exam-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Monitoring Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-indigo-700 rounded hover:bg-indigo-800 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {['overview', 'attempts', 'violations', 'students', 'plagiarism', 'chatbot'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium capitalize ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-500 text-sm">Total Exams</div>
                <div className="text-3xl font-bold text-indigo-600">{stats.totalExams}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-500 text-sm">Total Students</div>
                <div className="text-3xl font-bold text-indigo-600">{stats.totalStudents}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-500 text-sm">Total Attempts</div>
                <div className="text-3xl font-bold text-indigo-600">{stats.totalAttempts}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-500 text-sm">Average Score</div>
                <div className="text-3xl font-bold text-indigo-600">{stats.averageScore}%</div>
              </div>
            </div>

            {/* More Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-500 text-sm">Total Violations</div>
                <div className="text-3xl font-bold text-red-600">{stats.totalViolations}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-gray-500 text-sm">High Risk Students</div>
                <div className="text-3xl font-bold text-orange-600">{stats.highRiskStudents}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <button
                  onClick={exportPDF}
                  className="w-full h-full flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF Report
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Violations */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Violations</h3>
                <div className="space-y-3">
                  {stats.recentViolations?.length > 0 ? (
                    stats.recentViolations.map((v, i) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <div className="font-medium">{v.userId?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{v.examId?.title}</div>
                        </div>
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          {v.type.replace('_', ' ')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No recent violations</p>
                  )}
                </div>
              </div>

              {/* Recent Attempts */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Attempts</h3>
                <div className="space-y-3">
                  {stats.recentAttempts?.length > 0 ? (
                    stats.recentAttempts.map((a, i) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <div className="font-medium">{a.userId?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{a.examId?.title}</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-sm ${getRiskColor(a.score)}`}>
                          {a.score}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No recent attempts</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attempts Tab */}
        {activeTab === 'attempts' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Exam</label>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="border rounded px-3 py-2 w-48"
                  >
                    <option value="">All Exams</option>
                    {exams.map((exam) => (
                      <option key={exam._id} value={exam._id}>{exam.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Student</label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="border rounded px-3 py-2 w-48"
                  >
                    <option value="">All Students</option>
                    {students.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleFilter}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Apply Filters
                </button>
                <button
                  onClick={exportPDF}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Export PDF
                </button>
              </div>
            </div>

            {/* Attempts Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Violations</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attempts.map((attempt) => (
                    <tr key={attempt._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{attempt.student?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{attempt.student?.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {attempt.exam?.title || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          attempt.score >= 70 ? 'bg-green-100 text-green-800' :
                          attempt.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {attempt.score}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {attempt.violationCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getRiskColor(attempt.riskScore)}`}>
                          {attempt.riskScore}% - {getRiskLabel(attempt.riskScore)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(attempt.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => viewViolations(attempt.student?._id, attempt.exam?._id)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                        >
                          View Violations
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {attempts.length === 0 && (
                <div className="text-center py-8 text-gray-500">No exam attempts found</div>
              )}
            </div>
          </div>
        )}

        {/* Violations Tab */}
        {activeTab === 'violations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Violation Details</h3>
              {selectedAttempt ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Viewing violations for student in exam</span>
                    <button
                      onClick={() => setSelectedAttempt(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  {violations.length > 0 ? (
                    <div className="space-y-3">
                      {violations.map((v, i) => (
                        <div key={i} className="border rounded p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                v.type === 'multiple_faces' ? 'bg-red-100 text-red-800' :
                                v.type === 'no_face' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {v.type.replace('_', ' ').toUpperCase()}
                              </span>
                              <p className="text-sm text-gray-600 mt-2">
                                {new Date(v.timestamp).toLocaleString()}
                              </p>
                            </div>
                            {v.snapshot && (
                              <img 
                                src={v.snapshot} 
                                alt="Violation" 
                                className="w-32 h-24 object-cover rounded"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No violations found for this attempt</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Select an attempt to view violations</p>
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exams Taken</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Violations</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.examCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.averageScore}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-sm ${
                          student.violationCount > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {student.violationCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && (
                <div className="text-center py-8 text-gray-500">No students found</div>
              )}
            </div>
          </div>
        )}

        {/* Plagiarism Detection Tab */}
        {activeTab === 'plagiarism' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Plagiarism Detection</h2>
              <p className="text-gray-600 mb-4">
                Analyze coding submissions to detect potential plagiarism using Levenshtein distance algorithm.
              </p>
              
              {/* Exam Selection and Controls */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
                  <select
                    value={selectedPlagiarismExam}
                    onChange={(e) => setSelectedPlagiarismExam(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">All Exams</option>
                    {exams.map((exam) => (
                      <option key={exam._id} value={exam._id}>
                        {exam.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Threshold (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={plagiarismThreshold}
                    onChange={(e) => setPlagiarismThreshold(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={async () => {
                      if (!selectedPlagiarismExam) {
                        alert('Please select an exam first');
                        return;
                      }
                      setPlagiarismLoading(true);
                      try {
                        const res = await detectPlagiarism(selectedPlagiarismExam, plagiarismThreshold, null, token);
                        if (res.success) {
                          setPlagiarismStats(res.stats);
                        } else {
                          alert(res.message || 'Failed to detect plagiarism');
                        }
                      } catch (error) {
                        console.error('Error detecting plagiarism:', error);
                        alert('Error detecting plagiarism');
                      }
                      setPlagiarismLoading(false);
                    }}
                    disabled={plagiarismLoading || !selectedPlagiarismExam}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {plagiarismLoading ? 'Analyzing...' : 'Detect Plagiarism'}
                  </button>
                </div>
              </div>

              {/* Statistics Overview */}
              {plagiarismStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600">Total Submissions</div>
                    <div className="text-2xl font-bold text-blue-800">{plagiarismStats.totalSubmissions}</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600">Comparisons Made</div>
                    <div className="text-2xl font-bold text-purple-800">{plagiarismStats.totalComparisons}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-sm text-red-600">Suspicious Pairs</div>
                    <div className="text-2xl font-bold text-red-800">{plagiarismStats.suspiciousPairs}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600">Avg Similarity</div>
                    <div className="text-2xl font-bold text-green-800">{plagiarismStats.averageSimilarity}%</div>
                  </div>
                </div>
              )}

              {/* Suspicious Pairs Table */}
              {plagiarismStats && plagiarismStats.pairs && plagiarismStats.pairs.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Similarity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student 1</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student 2</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {plagiarismStats.pairs.map((pair, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                              pair.similarity >= 90 ? 'bg-red-100 text-red-800' :
                              pair.similarity >= 80 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {pair.similarity}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {pair.submission1.userName || pair.submission1.userId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {pair.submission2.userName || pair.submission2.userId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded text-sm bg-red-100 text-red-800">
                              Flagged
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedPair(pair)}
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                            >
                              View Code
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {plagiarismStats && plagiarismStats.pairs && plagiarismStats.pairs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No suspicious pairs found above the threshold of {plagiarismThreshold}%
                </div>
              )}

              {!plagiarismStats && (
                <div className="text-center py-8 text-gray-500">
                  Select an exam and click "Detect Plagiarism" to analyze submissions
                </div>
              )}
            </div>

            {/* Code Comparison Modal */}
            {selectedPair && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">
                        Code Comparison - {selectedPair.similarity}% Similar
                      </h3>
                      <button
                        onClick={() => setSelectedPair(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2 text-gray-700">
                          {selectedPair.submission1.userName || selectedPair.submission1.userId}'s Code
                        </h4>
                        <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-[60vh]">
                          <code>{selectedPair.submission1.code || 'No code available'}</code>
                        </pre>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2 text-gray-700">
                          {selectedPair.submission2.userName || selectedPair.submission2.userId}'s Code
                        </h4>
                        <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-[60vh]">
                          <code>{selectedPair.submission2.code || 'No code available'}</code>
                        </pre>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setSelectedPair(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chatbot Analytics Tab */}
        {activeTab === 'chatbot' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-2">Chatbot Analytics</h2>
              <p className="text-gray-600 mb-6">
                Analyze chatbot usage patterns to understand student questions and confusion topics.
              </p>
              <ChatbotAnalytics token={token} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
