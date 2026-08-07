import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-mono font-semibold text-slate-900">
            architect<span className="text-blue-600">ai</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">AI Software Architecture Platform</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 text-sm font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-4">
          Default credentials: admin / architect
        </p>
      </div>
    </div>
  );
}
