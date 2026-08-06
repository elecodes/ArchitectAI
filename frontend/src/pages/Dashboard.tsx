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
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <h1 className="text-xl font-bold">ArchitectAI</h1>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Logout
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Link
            to="/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            + New Project
          </Link>
        </div>

        {/* Search */}
        {projects.length > 0 && (
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 mt-2 text-sm">Loading projects...</p>
          </div>
        ) : filtered.length === 0 && search ? (
          <p className="text-center py-8 text-gray-400 text-sm">No projects match "{search}"</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border">
            <p className="text-gray-500 text-lg">No projects yet</p>
            <p className="text-gray-400 text-sm mt-2">
              Create your first project to generate architecture artifacts.
            </p>
            <Link
              to="/new"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-lg border hover:border-blue-300 transition p-4 flex justify-between items-start"
              >
                <Link to={`/project/${p.id}`} className="flex-1">
                  <h3 className="font-medium text-gray-900">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Created{' '}
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(p.id, p.name);
                  }}
                  className="text-gray-400 hover:text-red-600 ml-4 text-sm"
                  title="Delete project"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-8">
          {projects.length} project{projects.length !== 1 ? 's' : ''} total
        </p>
      </main>
    </div>
  );
}
