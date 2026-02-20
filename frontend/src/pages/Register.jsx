import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../utils/api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) navigate('/dashboard');
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.name || !form.email || !form.password) return 'All fields are required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return 'Invalid email';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const res = await registerUser(form);
    if (res.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('role', res.user.role);
      setSuccess('Registered successfully');
      // redirect based on role
      navigate(res.user.role === 'admin' ? '/dashboard' : '/student-dashboard');
    } else {
      setError(res.message || 'Registration failed');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form className="w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-2xl font-semibold mb-4">Register</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        {success && <div className="text-green-600 mb-2">{success}</div>}
        <div className="mb-2">
          <label className="block">Name</label>
          <input
            className="w-full p-2 border"
            name="name"
            value={form.name}
            onChange={handleChange}
          />
        </div>
        <div className="mb-2">
          <label className="block">Email</label>
          <input
            className="w-full p-2 border"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div className="mb-2">
          <label className="block">Password</label>
          <input
            className="w-full p-2 border"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
          />
        </div>
        <div className="mb-2">
          <label className="block">Role</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full p-2 border"
          >
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          className="mt-4 w-full bg-blue-600 text-white py-2"
        >
          Register
        </button>
        <p className="mt-2 text-center">
          Already have an account?{' '}
          <a href="/" className="text-blue-500 underline">
            Login
          </a>
        </p>
      </form>
    </div>
  );
}
