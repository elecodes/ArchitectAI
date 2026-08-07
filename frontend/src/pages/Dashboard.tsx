import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, deleteProject, logout } from '../lib/api';

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-mono font-semibold text-slate-900">
          architect<span className="text-blue-600">ai</span>
        </h1>
        <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-600">
          Sign out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-slate-700">Projects</h2>
            <span className="text-xs text-slate-400 font-mono">{projects.length}</span>
          </div>
          <Link
            to="/new"
            className="px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
          >
            New project
          </Link>
        </div>

        {/* Search */}
        {projects.length > 3 && (
          <input
            type="text"
            placeholder="Filter projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-white mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}

        {/* Project list */}
        {loading ? (
          <div className="text-xs text-slate-400 py-8 text-center">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500">{search ? 'No matches' : 'No projects'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {!search && 'Create a project to begin generating architecture.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-slate-800 truncate">{p.name}</span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5 max-w-lg">
                      {p.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, p.id, p.name)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
