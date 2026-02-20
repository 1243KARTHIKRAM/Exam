import { useState, useEffect } from 'react';
import { getChatbotAnalytics } from '../utils/api';

const ChatbotAnalytics = ({ token }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await getChatbotAnalytics({}, token);
      if (response.success) {
        setAnalytics(response.data);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError('Failed to load analytics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'questions', label: 'Most Asked Questions' },
    { id: 'confusion', label: 'Confusion Topics' },
    { id: 'frequency', label: 'Chat Frequency' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="text-sm opacity-80">Total Questions</div>
          <div className="text-3xl font-bold mt-2">{analytics?.totalQuestions || 0}</div>
          <div className="text-sm opacity-80 mt-2">Questions asked to chatbot</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="text-sm opacity-80">Unique Users</div>
          <div className="text-3xl font-bold mt-2">{analytics?.uniqueUsers || 0}</div>
          <div className="text-sm opacity-80 mt-2">Students using chatbot</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="text-sm opacity-80">Active Exams</div>
          <div className="text-3xl font-bold mt-2">{analytics?.chatFrequencyPerExam?.length || 0}</div>
          <div className="text-sm opacity-80 mt-2">Exams with chats</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-sm transition-colors-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Questions per Day Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Questions per Day (Last 7 Days)</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {analytics?.questionsPerDay?.map((day, index) => {
                const maxCount = Math.max(...(analytics?.questionsPerDay?.map(d => d.count) || [1]));
                const height = (day.count / maxCount) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-blue-100 rounded-t relative" style={{ height: `${height}%`, minHeight: '4px' }}>
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600">
                        {day.count}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                      {day._id?.slice(5) || ''}
                    </div>
                  </div>
                );
              })}
              {(!analytics?.questionsPerDay || analytics.questionsPerDay.length === 0) && (
                <div className="w-full text-center text-gray-500 py-8">No data available</div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Top Confusion Topics</h3>
              <div className="space-y-3">
                {analytics?.confusionTopics?.slice(0, 5).map((topic, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="capitalize">{topic.topic}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 rounded-full" 
                          style={{ width: `${topic.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">{topic.count} ({topic.percentage}%)</span>
                    </div>
                  </div>
                ))}
                {(!analytics?.confusionTopics || analytics.confusionTopics.length === 0) && (
                  <div className="text-gray-500 text-center py-4">No data available</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Most Asked Question</h3>
              {analytics?.mostAskedQuestions?.[0] ? (
                <div>
                  <div className="bg-blue-50 rounded-lg p-4 mb-3">
                    <p className="text-gray-800 italic">"{analytics.mostAskedQuestions[0].question}"</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Asked {analytics.mostAskedQuestions[0].count} times</span>
                    <span className="text-gray-500">
                      First: {new Date(analytics.mostAskedQuestions[0].firstAsked).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Most Asked Questions</h3>
            <p className="text-sm text-gray-500 mt-1">Questions sorted by frequency</p>
          </div>
          <div className="divide-y divide-gray-200">
            {analytics?.mostAskedQuestions?.map((q, index) => (
              <div key={index} className="p-6 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">"{q.question}"</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {q.count} times
                      </span>
                      <span>First asked: {new Date(q.firstAsked).toLocaleDateString()}</span>
                      <span>Last asked: {new Date(q.lastAsked).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!analytics?.mostAskedQuestions || analytics.mostAskedQuestions.length === 0) && (
              <div className="p-6 text-center text-gray-500">No questions logged yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'confusion' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Confusion Topics Analysis</h3>
            <p className="text-sm text-gray-500 mt-1">Topics that students ask about most frequently</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics?.confusionTopics?.map((topic, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold capitalize text-lg">{topic.topic}</h4>
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      {topic.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500"
                      style={{ width: `${topic.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">{topic.count}</span> questions asked about this topic
                  </p>
                </div>
              ))}
              {(!analytics?.confusionTopics || analytics.confusionTopics.length === 0) && (
                <div className="col-span-2 text-center text-gray-500 py-8">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'frequency' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Chat Frequency per Exam</h3>
            <p className="text-sm text-gray-500 mt-1">Number of questions asked during each exam</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Chat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Chat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics?.chatFrequencyPerExam?.map((exam, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{exam.examTitle}</div>
                      <div className="text-xs text-gray-500">{exam.examId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {exam.totalQuestions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {exam.uniqueUsers}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exam.firstChat ? new Date(exam.firstChat).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exam.lastChat ? new Date(exam.lastChat).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
                {(!analytics?.chatFrequencyPerExam || analytics.chatFrequencyPerExam.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No exam data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotAnalytics;
