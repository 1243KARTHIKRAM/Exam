import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/StudentDashboard';
import ExamPage from './pages/ExamPage';
import AdminDashboard from './pages/AdminDashboard';
import Chatbot from './components/Chatbot';

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/exam/:id" element={<ExamPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
      <Chatbot />
    </ThemeProvider>
  );
}

export default App;
