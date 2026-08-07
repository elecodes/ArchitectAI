import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProjects, deleteProject, logout } from '../lib/api';
import Wordmark from '../components/Wordmark';
import Kicker from '../components/Kicker';
import Sheet from '../components/Sheet';
import TopBar from '../components/TopBar';
import { ButtonLink } from '../components/Button';
import { IconPlus, IconSearch, IconTrash, IconLogOut } from '../components/icons';

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
    <div className="bg-grid min-h-screen">
      <TopBar
        left={<Wordmark />}
        right={
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 font-mono text-sm text-faint transition-colors hover:text-ink"
          >
            <IconLogOut className="h-3.5 w-3.5" /> sign out
          </button>
        }
      />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="font-sans text-base font-semibold text-ink">Projects</h2>
            <span className="font-mono text-xs text-faint">{projects.length}</span>
          </div>
          <ButtonLink to="/new" size="sm">
            <IconPlus className="h-3.5 w-3.5" /> New project
          </ButtonLink>
        </div>

        {projects.length > 3 && (
          <div className="relative mb-4">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="text"
              placeholder="Filter projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sheet-input h-9 pl-9"
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-ink/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Sheet className="py-14 text-center">
            <Kicker className="block">No projects</Kicker>
            <p className="mt-2 text-sm text-ink-soft">
              {search
                ? 'Nothing matches that filter.'
                : 'Create a project to begin generating architecture.'}
            </p>
            {!search && (
              <ButtonLink to="/new" size="sm" className="mt-5">
                <IconPlus className="h-3.5 w-3.5" /> New project
              </ButtonLink>
            )}
          </Sheet>
        ) : (
          <Sheet className="divide-y divide-hairline">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-faint">
                      {String(p.id).slice(0, 4).toUpperCase()}
                    </span>
                    <span className="truncate font-sans text-base font-medium text-ink">
                      {p.name}
                    </span>
                  </div>
                  {p.description && (
                    <p className="mt-0.5 max-w-lg truncate text-sm text-ink-soft/80">
                      {p.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-5">
                  <span className="whitespace-nowrap font-mono text-xs tabular-nums text-faint">
                    {new Date(p.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, p.id, p.name)}
                    className="text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
                    title="Delete project"
                    aria-label={`Delete ${p.name}`}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
              </Link>
            ))}
          </Sheet>
        )}
      </main>
    </div>
  );
}
