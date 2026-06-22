import type { SavedSession, WorkoutSettings } from './types';

const KEY = 'lapse.sessions.v1';
const LAST_KEY = 'lapse.last.v1';

function read(): SavedSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(sessions: SavedSession[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

function makeId(): string {
  return 'sess-' + Math.random().toString(36).slice(2, 10);
}

/** Sessions ordered most-recently-saved first. */
export function listSessions(): SavedSession[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

/** Save (or overwrite by name) a named session and return it. */
export function saveSession(name: string, settings: WorkoutSettings): SavedSession {
  const sessions = read();
  const trimmed = name.trim();
  const existing = sessions.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  const session: SavedSession = existing
    ? { ...existing, settings, savedAt: Date.now() }
    : { id: makeId(), name: trimmed, settings, savedAt: Date.now() };

  const next = existing ? sessions.map((s) => (s.id === existing.id ? session : s)) : [...sessions, session];
  write(next);
  return session;
}

export function deleteSession(id: string): void {
  write(read().filter((s) => s.id !== id));
}

/** Remember the last-used settings so the form reopens where you left off. */
export function saveLastSettings(settings: WorkoutSettings): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(settings));
  } catch {
    /* non-fatal */
  }
}

export function loadLastSettings(): WorkoutSettings | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as WorkoutSettings) : null;
  } catch {
    return null;
  }
}
