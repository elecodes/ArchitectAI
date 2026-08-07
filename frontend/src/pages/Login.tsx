import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../lib/api';
import Wordmark from '../components/Wordmark';
import Kicker from '../components/Kicker';
import Sheet from '../components/Sheet';
import { Button } from '../components/Button';
import { TextField } from '../components/Field';

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
    <div className="bg-grid flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark size="lg" />
          <Kicker className="mt-2 block">Software Architecture Studio</Kicker>
        </div>

        <Sheet className="p-8">
          <div className="mb-6 flex items-baseline justify-between">
            <Kicker>Sign in</Kicker>
            <span className="font-mono text-[11px] text-faint">SHEET 01</span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              autoFocus
              autoComplete="username"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            {error && (
              <div className="border-l-2 border-l-red-600 bg-red-soft px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Authenticating…' : 'Sign in'}
            </Button>
          </form>
        </Sheet>

        <p className="mt-4 text-center font-mono text-xs text-faint">
          default credentials — admin / architect
        </p>
      </div>
    </div>
  );
}
