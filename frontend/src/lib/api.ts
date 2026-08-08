const API_BASE = '/api';

let token: string | null = localStorage.getItem('token');

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

export function getToken(): string | null {
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export async function login(username: string, password: string): Promise<{ token: string }> {
  const data = await request<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

export function logout() {
  setToken(null);
  window.location.href = '/login';
}

// Projects
export async function createProject(name: string, description?: string) {
  return request<any>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function listProjects() {
  return request<any[]>('/projects');
}

export async function deleteProject(id: string) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' });
}

// Generation
export async function generateSpec(projectId: string, description: string) {
  return request<any>('/specs', {
    method: 'POST',
    body: JSON.stringify({ projectId, description }),
  });
}

export async function generateArchitecture(specificationId: string) {
  return request<any>('/architecture', {
    method: 'POST',
    body: JSON.stringify({ specificationId }),
  });
}

export async function generateTasks(architectureId: string) {
  return request<any>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ architectureId }),
  });
}

// Artifacts
export async function getArtifact(id: string) {
  return request<any>(`/artifacts/${id}`);
}

// Feedback
export async function submitFeedback(
  artifactId: string,
  rating: 'helpful' | 'needs_improvement',
  comment?: string,
) {
  return request<any>(`/artifacts/${artifactId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
}

// Review
export async function reviewRepository(path: string, customIgnore?: string[]) {
  return request<any>('/review', {
    method: 'POST',
    body: JSON.stringify({ path, customIgnore }),
  });
}

// Vision
export async function generateVision(
  projectId: string,
  description: string,
  specificationId?: string,
) {
  return request<any>('/vision', {
    method: 'POST',
    body: JSON.stringify({ projectId, description, specificationId }),
  });
}

// Risk Assessment
export async function generateRisks(specificationId: string, architectureId: string) {
  return request<any>('/risks', {
    method: 'POST',
    body: JSON.stringify({ specificationId, architectureId }),
  });
}

// Diagrams
export async function generateDiagrams(architectureId: string, projectName?: string) {
  return request<any>('/diagrams', {
    method: 'POST',
    body: JSON.stringify({ architectureId, projectName }),
  });
}
