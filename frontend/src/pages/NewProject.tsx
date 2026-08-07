import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject } from '../lib/api';
import TopBar from '../components/TopBar';
import Sheet from '../components/Sheet';
import Kicker from '../components/Kicker';
import { Button } from '../components/Button';
import { TextField, TextAreaField } from '../components/Field';
import { IconArrowLeft } from '../components/icons';

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
    <div className="bg-grid min-h-screen">
      <TopBar
        left={
          <>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 font-mono text-sm text-faint transition-colors hover:text-ink"
            >
              <IconArrowLeft className="h-3.5 w-3.5" /> projects
            </button>
            <span className="font-mono text-[11px] text-hairline-strong">//</span>
            <span className="text-base font-medium text-ink">New project</span>
          </>
        }
      />

      <main className="mx-auto max-w-xl px-6 py-10">
        <Sheet className="p-8">
          <div className="mb-6 flex items-baseline justify-between">
            <Kicker>New project</Kicker>
            <span className="font-mono text-[11px] text-faint">SHEET 02</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <TextField
              label="Project name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., E-commerce Platform"
              required
              autoFocus
            />
            <TextAreaField
              label="Description"
              hint={`${description.length} chars`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A marketplace platform that connects buyers and sellers with real-time messaging, payment processing, and review system…"
              rows={8}
              required
            />
            <p className="font-mono text-xs text-faint">
              min. 10 characters — be as detailed as possible.
            </p>

            {error && (
              <div className="border-l-2 border-l-red-600 bg-red-soft px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={loading || !name || description.length < 10}>
                {loading ? 'Creating…' : 'Create project'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/')}>
                Cancel
              </Button>
            </div>
          </form>
        </Sheet>
      </main>
    </div>
  );
}
