import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../utils/api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) navigate('/dashboard');
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.email || !form.password) return 'All fields are required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    const res = await loginUser(form);
    if (res.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('role', res.user.role);
      navigate(res.user.role === 'admin' ? '/dashboard' : '/dashboard');
    } else {
      setError(res.message || 'Login failed');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <form className="w-full max-w-md" onSubmit={handleSubmit}>
        <h2 className="text-2xl font-semibold mb-4">Login</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
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
        <button
          type="submit"
          className="mt-4 w-full bg-blue-600 text-white py-2"
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="mt-3 w-full bg-green-600 text-white py-2"
        >
          Create New Account
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
