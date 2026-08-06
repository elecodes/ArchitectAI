import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, logout } from '../lib/api';

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">ArchitectAI</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Logout
        </button>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Link
            to="/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + New Project
          </Link>
        </div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>No projects yet.</p>
            <p className="text-sm mt-2">Create your first project to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="block p-4 bg-white rounded-lg border hover:border-blue-300 transition"
              >
                <h3 className="font-medium">{p.name}</h3>
                {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
