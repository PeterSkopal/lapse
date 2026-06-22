import './style.css';
import { AudioEngine } from './audio';
import { buildPhases, WorkoutEngine } from './engine';
import type { EngineState } from './engine';
import * as store from './storage';
import type { Phase, PhaseType, SavedSession, WorkoutSettings } from './types';
import { ScreenWakeLock } from './wake-lock';

const DEFAULTS: WorkoutSettings = {
  laps: 3,
  exercises: 5,
  exerciseSeconds: 30,
  breakSeconds: 15,
  lapBreakSeconds: 60,
};

interface FieldDef {
  key: keyof WorkoutSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const FIELDS: readonly FieldDef[] = [
  { key: 'laps', label: 'Laps', min: 1, max: 50, step: 1, unit: '' },
  { key: 'exercises', label: 'Exercises per lap', min: 1, max: 50, step: 1, unit: '' },
  { key: 'exerciseSeconds', label: 'Exercise length', min: 1, max: 3600, step: 5, unit: 's' },
  { key: 'breakSeconds', label: 'Break between exercises', min: 0, max: 3600, step: 5, unit: 's' },
  { key: 'lapBreakSeconds', label: 'Break between laps', min: 0, max: 3600, step: 5, unit: 's' },
];

const PHASE_LABEL: Record<PhaseType, string> = {
  prep: 'Get ready',
  work: 'Work',
  rest: 'Break',
  lapRest: 'Lap break',
  done: 'Done',
};

const RING_R = 110;
const RING_CIRC = 2 * Math.PI * RING_R;

const app = document.getElementById('app')!;
const audio = new AudioEngine();
const wakeLock = new ScreenWakeLock();

let settings: WorkoutSettings = { ...DEFAULTS, ...(store.loadLastSettings() ?? {}) };
let engine: WorkoutEngine | null = null;

// ---------- helpers ----------

function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function clampField(key: keyof WorkoutSettings, value: number): number {
  const f = FIELDS.find((x) => x.key === key)!;
  if (Number.isNaN(value)) return f.min;
  return Math.min(f.max, Math.max(f.min, Math.round(value)));
}

function totalDuration(s: WorkoutSettings): number {
  return buildPhases(s).reduce((sum, p) => sum + p.duration, 0);
}

function sessionSummary(s: WorkoutSettings): string {
  return `${s.laps}×${s.exercises} · ${s.exerciseSeconds}s / ${s.breakSeconds}s / ${s.lapBreakSeconds}s · ${clock(totalDuration(s))}`;
}

function nextLabel(next: Phase | null): string {
  if (!next || next.type === 'done') return 'Finish';
  switch (next.type) {
    case 'work':
      return `Exercise ${next.exercise}`;
    case 'rest':
      return 'Break';
    case 'lapRest':
      return 'Lap break';
    case 'prep':
      return 'Get ready';
  }
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------- setup screen ----------

function renderSetup(): void {
  document.body.removeAttribute('data-phase');

  const fieldsHtml = FIELDS.map(
    (f) => `
      <div class="field" data-key="${f.key}">
        <label class="field__label" for="f-${f.key}">${f.label}</label>
        <div class="stepper">
          <button type="button" class="stepper__btn" data-step="-1" aria-label="Decrease ${f.label}">–</button>
          <div class="stepper__value">
            <input class="stepper__input" id="f-${f.key}" type="number" inputmode="numeric"
                   value="${settings[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}" />
            ${f.unit ? `<span class="stepper__unit">${f.unit}</span>` : ''}
          </div>
          <button type="button" class="stepper__btn" data-step="1" aria-label="Increase ${f.label}">+</button>
        </div>
      </div>`,
  ).join('');

  app.innerHTML = `
    <main class="setup">
      <header class="brand">
        <span class="brand__mark" aria-hidden="true"></span>
        <div>
          <h1 class="brand__name">Lapse</h1>
          <p class="brand__tag">Interval trainer</p>
        </div>
      </header>

      <form class="card" id="setup-form" novalidate>
        ${fieldsHtml}
        <div class="estimate">Total time<strong id="estimate">${clock(totalDuration(settings))}</strong></div>
        <button type="submit" class="btn btn--primary btn--block">Start workout</button>
      </form>

      <section class="card" aria-label="Saved workouts">
        <div class="save-row">
          <input id="session-name" class="text-input" type="text" maxlength="40"
                 placeholder="Name this workout to save it…" autocomplete="off" />
          <button id="save-btn" class="btn btn--ghost" type="button">Save</button>
        </div>
        <div id="sessions" class="sessions"></div>
      </section>

      <p class="footnote">Screen stays awake during a workout · works offline</p>
    </main>`;

  wireSetup();
  renderSessions();
}

function renderSessions(): void {
  const host = document.getElementById('sessions')!;
  const sessions = store.listSessions();
  if (sessions.length === 0) {
    host.innerHTML = `<p class="sessions__empty">No saved workouts yet.</p>`;
    return;
  }
  host.innerHTML = sessions
    .map(
      (s: SavedSession) => `
      <div class="session" data-id="${s.id}" role="button" tabindex="0">
        <div class="session__info">
          <span class="session__name">${esc(s.name)}</span>
          <span class="session__meta">${sessionSummary(s.settings)}</span>
        </div>
        <button type="button" class="iconbtn session__del" data-del="${s.id}" aria-label="Delete ${esc(s.name)}">✕</button>
      </div>`,
    )
    .join('');
}

function wireSetup(): void {
  const form = document.getElementById('setup-form') as HTMLFormElement;
  const estimate = document.getElementById('estimate')!;

  const refresh = () => {
    estimate.textContent = clock(totalDuration(settings));
  };

  const setField = (key: keyof WorkoutSettings, value: number) => {
    settings = { ...settings, [key]: clampField(key, value) };
    const input = document.getElementById(`f-${key}`) as HTMLInputElement;
    input.value = String(settings[key]);
    refresh();
  };

  // Stepper +/- buttons.
  form.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.stepper__btn');
    if (!btn) return;
    const field = btn.closest<HTMLElement>('.field')!;
    const key = field.dataset.key as keyof WorkoutSettings;
    const def = FIELDS.find((f) => f.key === key)!;
    const step = Number(btn.dataset.step) * def.step;
    setField(key, settings[key] + step);
  });

  // Typed input.
  form.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('stepper__input')) return;
    const key = input.closest<HTMLElement>('.field')!.dataset.key as keyof WorkoutSettings;
    settings = { ...settings, [key]: Number(input.value) };
    refresh();
  });
  form.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('stepper__input')) return;
    const key = input.closest<HTMLElement>('.field')!.dataset.key as keyof WorkoutSettings;
    setField(key, Number(input.value));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Normalise every field before starting.
    for (const f of FIELDS) setField(f.key, settings[f.key]);
    store.saveLastSettings(settings);
    startWorkout(settings);
  });

  // Save / load / delete sessions.
  const nameInput = document.getElementById('session-name') as HTMLInputElement;
  document.getElementById('save-btn')!.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      nameInput.classList.remove('shake');
      void nameInput.offsetWidth; // restart animation
      nameInput.classList.add('shake');
      return;
    }
    store.saveSession(name, settings);
    nameInput.value = '';
    renderSessions();
  });

  const sessionsHost = document.getElementById('sessions')!;
  sessionsHost.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const del = target.closest<HTMLButtonElement>('[data-del]');
    if (del) {
      e.stopPropagation();
      store.deleteSession(del.dataset.del!);
      renderSessions();
      return;
    }
    const row = target.closest<HTMLElement>('.session');
    if (row) loadSession(row.dataset.id!);
  });
  sessionsHost.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('.session');
    if (row) {
      e.preventDefault();
      loadSession(row.dataset.id!);
    }
  });
}

function loadSession(id: string): void {
  const found = store.listSessions().find((s) => s.id === id);
  if (!found) return;
  settings = { ...found.settings };
  for (const f of FIELDS) {
    const input = document.getElementById(`f-${f.key}`) as HTMLInputElement | null;
    if (input) input.value = String(settings[f.key]);
  }
  document.getElementById('estimate')!.textContent = clock(totalDuration(settings));
  document.querySelector('.setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- run screen ----------

function startWorkout(s: WorkoutSettings): void {
  audio.unlock();
  void wakeLock.enable();

  engine = new WorkoutEngine(s, {
    onTick: updateRun,
    onPhaseEnter: (phase) => {
      if (phase.type === 'work') audio.workStart();
      else if (phase.type === 'rest') audio.restStart();
      else if (phase.type === 'lapRest') audio.lapEnd();
    },
    onCountdownTick: () => audio.countdownTick(),
    onComplete: () => {
      audio.finish();
      void wakeLock.disable();
      renderDone(s);
    },
  });

  renderRun(s);
  engine.start();
}

function renderRun(s: WorkoutSettings): void {
  app.innerHTML = `
    <main class="run">
      <header class="run__top">
        <button class="iconbtn" data-act="stop" aria-label="End workout">✕</button>
        <div class="run__time">
          <span id="elapsed">0:00</span>
          <span class="run__total" id="total">${clock(totalDuration(s))}</span>
        </div>
        <button class="iconbtn" data-act="mute" id="mute-btn" aria-label="Mute sounds">🔊</button>
      </header>

      <div class="dial">
        <svg class="dial__svg" viewBox="0 0 240 240" aria-hidden="true">
          <circle class="dial__track" cx="120" cy="120" r="${RING_R}" />
          <circle class="dial__bar" id="ring" cx="120" cy="120" r="${RING_R}"
                  stroke-dasharray="${RING_CIRC}" stroke-dashoffset="0" />
        </svg>
        <div class="dial__center">
          <div class="dial__phase" id="phase-label">Get ready</div>
          <div class="dial__count" id="count">–</div>
          <div class="dial__sub" id="sub"></div>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><span class="stat__val" id="lap">1/${s.laps}</span><span class="stat__lbl">Lap</span></div>
        <div class="stat"><span class="stat__val" id="ex">1/${s.exercises}</span><span class="stat__lbl">Exercise</span></div>
      </div>

      <footer class="controls">
        <button class="btn btn--ghost" data-act="skip">Skip ›</button>
        <button class="btn btn--primary" data-act="toggle" id="toggle">Pause</button>
      </footer>
    </main>`;

  runRefs = {
    phase: document.getElementById('phase-label')!,
    count: document.getElementById('count')!,
    sub: document.getElementById('sub')!,
    ring: document.getElementById('ring') as unknown as SVGCircleElement,
    elapsed: document.getElementById('elapsed')!,
    lap: document.getElementById('lap')!,
    ex: document.getElementById('ex')!,
    toggle: document.getElementById('toggle')!,
    root: document.querySelector('.run')!,
  };
  wireRun();
}

function wireRun(): void {
  const root = document.querySelector('.run')!;
  root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act || !engine) return;
    switch (act) {
      case 'toggle':
        engine.togglePause();
        break;
      case 'skip':
        engine.skip();
        break;
      case 'stop':
        endWorkout();
        break;
      case 'mute': {
        audio.setMuted(!audio.isMuted);
        const btn = document.getElementById('mute-btn')!;
        btn.textContent = audio.isMuted ? '🔇' : '🔊';
        btn.setAttribute('aria-label', audio.isMuted ? 'Unmute sounds' : 'Mute sounds');
        break;
      }
    }
  });
}

interface RunRefs {
  phase: HTMLElement;
  count: HTMLElement;
  sub: HTMLElement;
  ring: SVGCircleElement;
  elapsed: HTMLElement;
  lap: HTMLElement;
  ex: HTMLElement;
  toggle: HTMLElement;
  root: HTMLElement;
}

let runRefs: RunRefs | null = null;

function updateRun(state: EngineState): void {
  const r = runRefs;
  if (!r) return;

  document.body.dataset.phase = state.phase.type;
  r.phase.textContent = PHASE_LABEL[state.phase.type];
  r.count.textContent = String(state.remaining);
  r.sub.textContent = `Next · ${nextLabel(state.nextPhase)}`;
  r.elapsed.textContent = clock(state.elapsedTotal);
  r.lap.textContent = `${state.phase.lap}/${settings.laps}`;
  r.ex.textContent = `${state.phase.exercise}/${settings.exercises}`;
  r.toggle.textContent = state.paused ? 'Resume' : 'Pause';
  r.ring.style.strokeDashoffset = String(RING_CIRC * state.progress);
  r.root.classList.toggle('run--paused', state.paused);
}

function clearRefs(): void {
  runRefs = null;
}

function endWorkout(): void {
  engine?.stop();
  engine = null;
  void wakeLock.disable();
  clearRefs();
  renderSetup();
}

function renderDone(s: WorkoutSettings): void {
  document.body.dataset.phase = 'done';
  app.innerHTML = `
    <main class="run run--end">
      <div class="done">
        <div class="done__check" aria-hidden="true">✓</div>
        <h2 class="done__title">Workout complete</h2>
        <p class="done__summary">${plural(s.laps, 'lap')} · ${plural(s.exercises, 'exercise')} · ${clock(totalDuration(s))}</p>
        <div class="controls controls--stack">
          <button class="btn btn--primary btn--block" data-act="again">Go again</button>
          <button class="btn btn--ghost btn--block" data-act="home">Home</button>
        </div>
      </div>
    </main>`;

  app.querySelector('.done')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'again') {
      clearRefs();
      startWorkout(s);
    } else if (act === 'home') {
      clearRefs();
      renderSetup();
    }
  });
}

renderSetup();
