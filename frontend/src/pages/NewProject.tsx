import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createProject } from '../lib/api';

export default function NewProject() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const project = await createProject(name, description);
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-xs text-slate-400 hover:text-slate-600">
          ← Projects
        </Link>
        <span className="text-xs text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700">New project</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., E-commerce Platform"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Description
              <span className="text-slate-400 font-normal ml-1">
                — describe what you want to build
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A marketplace platform that connects buyers and sellers with real-time messaging, payment processing, and review system..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
            <div className="flex justify-between mt-1.5">
              <p className="text-xs text-slate-400">
                Minimum 10 characters. Be as detailed as possible.
              </p>
              <p className="text-xs text-slate-400 font-mono">{description.length}</p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !name || description.length < 10}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create project'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
