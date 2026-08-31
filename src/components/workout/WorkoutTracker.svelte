<script lang="ts">
  import {
    WORKOUTS,
    buildSteps,
    blockExercises,
    workoutMuscles,
    repsLabel,
    formatTime,
    type Block,
    type Exercise,
    type LoggedSet,
    type Session,
    type SetStep,
    type WorkoutDef,
  } from './plan';
  import MuscleMap from './MuscleMap.svelte';

  // SHA-256 of the password; the plaintext never ships in the bundle.
  const PASS_HASH = 'cad0535decc38b248b40e7aef9a1cfd91ce386fa5c46f05ea622649e7faf18fb';

  const KEY_AUTH = 'workout:auth';
  const KEY_WEIGHTS = 'workout:weights';
  const KEY_HISTORY = 'workout:history';
  const KEY_ACTIVE = 'workout:active';

  interface ActiveSnapshot {
    workoutId: 'A' | 'B';
    stepIdx: number;
    phase: 'warmup' | 'work' | 'rest';
    sets: LoggedSet[];
    startedAt: number;
    restEndsAt: number;
    restTotal: number;
  }

  type Screen = 'lock' | 'home' | 'active' | 'summary';

  let screen = $state<Screen>('lock');
  let password = $state('');
  let passwordError = $state('');

  let weights = $state<Record<string, number>>({});
  let history = $state<Session[]>([]);
  let resumable = $state<ActiveSnapshot | null>(null);

  // Active session state
  let workout = $state<WorkoutDef | null>(null);
  let steps = $state<SetStep[]>([]);
  let stepIdx = $state(0);
  let phase = $state<'warmup' | 'work' | 'rest'>('warmup');
  let sets = $state<LoggedSet[]>([]);
  let startedAt = $state(0);
  let restEndsAt = $state(0);
  let restTotal = $state(0);
  let repsInput = $state(0);
  let now = $state(Date.now());

  // Summary state
  let finished = $state<Session | null>(null);
  let bumped = $state<Record<string, boolean>>({});

  let loaded = false;

  function readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  // Initial load — this component is only rendered client-side (client:only).
  {
    try {
      if (localStorage.getItem(KEY_AUTH) === PASS_HASH) screen = 'home';
      weights = readJson(KEY_WEIGHTS, {});
      history = readJson(KEY_HISTORY, []);
      resumable = readJson(KEY_ACTIVE, null);
    } catch {
      // localStorage unavailable — everything still works, nothing persists
    }
    for (const w of WORKOUTS) {
      for (const block of w.blocks) {
        for (const ex of blockExercises(block)) {
          if (!(ex.id in weights)) weights[ex.id] = ex.defaultWeight;
        }
      }
    }
    loaded = true;
  }

  $effect(() => {
    const json = JSON.stringify(weights);
    if (loaded) {
      try {
        localStorage.setItem(KEY_WEIGHTS, json);
      } catch {
        /* ignore */
      }
    }
  });

  $effect(() => {
    const json = JSON.stringify(history);
    if (loaded) {
      try {
        localStorage.setItem(KEY_HISTORY, json);
      } catch {
        /* ignore */
      }
    }
  });

  // Persist the in-progress session so a reload or locked phone loses nothing.
  $effect(() => {
    if (screen !== 'active' || !workout) return;
    const snap: ActiveSnapshot = {
      workoutId: workout.id,
      stepIdx,
      phase,
      sets,
      startedAt,
      restEndsAt,
      restTotal,
    };
    try {
      localStorage.setItem(KEY_ACTIVE, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  });

  // ---- Auth ----

  async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function submitPassword(e: SubmitEvent) {
    e.preventDefault();
    try {
      const hash = await sha256Hex(password);
      if (hash === PASS_HASH) {
        try {
          localStorage.setItem(KEY_AUTH, hash);
        } catch {
          /* ignore */
        }
        passwordError = '';
        screen = 'home';
      } else {
        passwordError = 'Wrong password.';
        password = '';
      }
    } catch {
      passwordError = 'This page needs HTTPS to unlock.';
    }
  }

  // ---- Timers ----

  $effect(() => {
    if (screen !== 'active') return;
    now = Date.now();
    const t = setInterval(() => (now = Date.now()), 500);
    return () => clearInterval(t);
  });

  const elapsedSec = $derived(startedAt ? Math.floor((now - startedAt) / 1000) : 0);
  const restRemaining = $derived(Math.max(0, Math.ceil((restEndsAt - now) / 1000)));
  const step = $derived(steps[stepIdx] as SetStep | undefined);
  const runningLong = $derived(elapsedSec > 28 * 60);

  $effect(() => {
    if (screen === 'active' && phase === 'rest' && restRemaining <= 0) {
      endRest();
    }
  });

  // ---- Sound / vibration / wake lock ----

  let audioCtx: AudioContext | null = null;

  function ensureAudio() {
    try {
      audioCtx ??= new AudioContext();
      if (audioCtx.state === 'suspended') void audioCtx.resume();
    } catch {
      audioCtx = null;
    }
  }

  function chime() {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* ignore */
    }
    if (!audioCtx) return;
    try {
      const t0 = audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = t0 + i * 0.3;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.25);
      }
    } catch {
      /* ignore */
    }
  }

  let wakeLock: WakeLockSentinel | null = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  $effect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && screen === 'active') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  // ---- History helpers ----

  const lastSession = $derived(history.length ? history[history.length - 1] : null);
  const suggestedId = $derived<'A' | 'B'>(lastSession?.workout === 'A' ? 'B' : 'A');

  const homeEyebrow = $derived.by(() => {
    const today = new Date();
    const day = today.getDay();
    const kind =
      day === 0 || day === 6 ? 'rest day' : day === 2 || day === 4 ? 'run day' : 'lift day';
    const ds = today.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${ds} · ${kind}`;
  });

  function lastPerf(exId: string): { date: string; weight: number; reps: number[] } | null {
    for (let i = history.length - 1; i >= 0; i--) {
      const ses = history[i];
      const done = ses.sets.filter((s) => s.exerciseId === exId);
      if (done.length) {
        return {
          date: ses.date,
          weight: done[done.length - 1].weight,
          reps: done.map((s) => s.reps),
        };
      }
    }
    return null;
  }

  function defaultReps(ex: Exercise, setNumber: number): number {
    for (let i = history.length - 1; i >= 0; i--) {
      const match = history[i].sets.find(
        (s) => s.exerciseId === ex.id && s.setNumber === setNumber
      );
      if (match) return match.reps;
    }
    return ex.repsMin;
  }

  function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function repRange(ex: Exercise): string {
    return ex.repsMin === ex.repsMax ? `${ex.repsMin}` : `${ex.repsMin}–${ex.repsMax}`;
  }

  function listLine(block: Block): string {
    if (block.kind === 'single') {
      const ex = block.exercise;
      const side = ex.perSide ? ` / ${ex.perSide}` : '';
      return `${ex.name} — ${block.sets}×${repRange(ex)}${side}`;
    }
    return `${block.exercises[0].name} + ${block.exercises[1].name} — ${block.sets} rounds`;
  }

  // ---- Session flow ----

  function startWorkout(def: WorkoutDef) {
    workout = def;
    steps = buildSteps(def);
    stepIdx = 0;
    sets = [];
    phase = 'warmup';
    startedAt = Date.now();
    restEndsAt = 0;
    restTotal = 0;
    resumable = null;
    screen = 'active';
    void requestWakeLock();
  }

  function resumeWorkout() {
    const snap = resumable;
    if (!snap) return;
    const def = WORKOUTS.find((w) => w.id === snap.workoutId);
    if (!def) return;
    workout = def;
    steps = buildSteps(def);
    stepIdx = Math.min(snap.stepIdx, steps.length - 1);
    phase = snap.phase;
    sets = snap.sets;
    startedAt = snap.startedAt;
    restEndsAt = snap.restEndsAt;
    restTotal = snap.restTotal;
    resumable = null;
    if (phase === 'work' || phase === 'warmup') prepReps();
    screen = 'active';
    void requestWakeLock();
  }

  function discardResumable() {
    resumable = null;
    try {
      localStorage.removeItem(KEY_ACTIVE);
    } catch {
      /* ignore */
    }
  }

  function prepReps() {
    const s = steps[stepIdx];
    if (s) repsInput = defaultReps(s.exercise, s.setNumber);
  }

  function startFirstSet() {
    ensureAudio();
    phase = 'work';
    prepReps();
  }

  function advance(logIt: boolean) {
    const s = step;
    if (!s || !workout) return;
    ensureAudio();
    if (logIt) {
      sets.push({
        exerciseId: s.exercise.id,
        name: s.exercise.name,
        blockLabel: s.blockLabel,
        setNumber: s.setNumber,
        weight: weights[s.exercise.id] ?? 0,
        reps: repsInput,
      });
    }
    if (stepIdx >= steps.length - 1) {
      completeWorkout();
      return;
    }
    stepIdx += 1;
    if (s.restAfterSec === 0) {
      // Superset: partner exercise immediately, no rest.
      phase = 'work';
      prepReps();
    } else {
      now = Date.now();
      restTotal = s.restAfterSec;
      restEndsAt = now + s.restAfterSec * 1000;
      phase = 'rest';
    }
  }

  function endRest() {
    phase = 'work';
    restEndsAt = 0;
    prepReps();
    chime();
  }

  function skipRest() {
    phase = 'work';
    restEndsAt = 0;
    prepReps();
  }

  function adjustRest(deltaSec: number) {
    restEndsAt = Math.max(now, restEndsAt + deltaSec * 1000);
  }

  function completeWorkout() {
    if (!workout) return;
    const session: Session = {
      date: new Date().toISOString(),
      workout: workout.id,
      durationSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      sets,
    };
    if (session.sets.length) history.push(session);
    try {
      localStorage.removeItem(KEY_ACTIVE);
    } catch {
      /* ignore */
    }
    releaseWakeLock();
    if (session.sets.length) {
      finished = session;
      bumped = {};
      screen = 'summary';
    } else {
      screen = 'home';
    }
  }

  function endEarly() {
    if (sets.length === 0 || confirm('End workout and save what you logged so far?')) {
      completeWorkout();
    }
  }

  // ---- Weights ----

  function roundWeight(x: number): number {
    return Math.round(x * 2) / 2;
  }

  function adjustWeight(ex: Exercise, dir: 1 | -1) {
    weights[ex.id] = Math.max(0, roundWeight((weights[ex.id] ?? 0) + dir * ex.weightStep));
  }

  function sanitizeWeight(ex: Exercise) {
    const v = weights[ex.id];
    weights[ex.id] = Number.isFinite(v) ? Math.max(0, roundWeight(v)) : 0;
  }

  // ---- Backup ----

  let importStatus = $state('');
  let importFileInput = $state<HTMLInputElement | null>(null);

  function exportData() {
    const payload = {
      app: 'workout-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      weights,
      history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function isLoggedSet(x: unknown): x is LoggedSet {
    if (typeof x !== 'object' || x === null) return false;
    const s = x as Record<string, unknown>;
    return (
      typeof s.exerciseId === 'string' &&
      typeof s.name === 'string' &&
      typeof s.blockLabel === 'string' &&
      typeof s.setNumber === 'number' &&
      typeof s.weight === 'number' &&
      typeof s.reps === 'number'
    );
  }

  function isSession(x: unknown): x is Session {
    if (typeof x !== 'object' || x === null) return false;
    const s = x as Record<string, unknown>;
    return (
      typeof s.date === 'string' &&
      (s.workout === 'A' || s.workout === 'B') &&
      typeof s.durationSec === 'number' &&
      Array.isArray(s.sets)
    );
  }

  async function importData(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const data = (parsed ?? {}) as { weights?: unknown; history?: unknown };
      const importedHistory = (Array.isArray(data.history) ? data.history : [])
        .filter(isSession)
        .map((s) => ({ ...s, sets: s.sets.filter(isLoggedSet) }));
      const importedWeights: Record<string, number> = {};
      if (data.weights && typeof data.weights === 'object') {
        for (const [k, v] of Object.entries(data.weights)) {
          if (typeof v === 'number' && Number.isFinite(v)) importedWeights[k] = Math.max(0, v);
        }
      }
      if (!importedHistory.length && !Object.keys(importedWeights).length) {
        importStatus = 'Import failed — that is not a workout backup file.';
        return;
      }
      if (
        !confirm(
          `Replace current data (${history.length} sessions) with this backup (${importedHistory.length} sessions)?`
        )
      ) {
        importStatus = '';
        return;
      }
      importedHistory.sort((a, b) => a.date.localeCompare(b.date));
      history = importedHistory;
      const merged = { ...importedWeights };
      for (const w of WORKOUTS) {
        for (const block of w.blocks) {
          for (const ex of blockExercises(block)) {
            if (!(ex.id in merged)) merged[ex.id] = ex.defaultWeight;
          }
        }
      }
      weights = merged;
      importStatus = `Imported ${importedHistory.length} session${importedHistory.length === 1 ? '' : 's'}.`;
    } catch {
      importStatus = 'Import failed — could not read that file.';
    }
  }

  // ---- Summary ----

  interface SummaryRow {
    ex: Exercise;
    logged: LoggedSet[];
    hitTop: boolean;
  }

  const summaryRows = $derived.by((): SummaryRow[] => {
    if (!finished) return [];
    const def = WORKOUTS.find((w) => w.id === finished.workout);
    if (!def) return [];
    const rows: SummaryRow[] = [];
    for (const block of def.blocks) {
      for (const ex of blockExercises(block)) {
        const logged = finished.sets.filter((s) => s.exerciseId === ex.id);
        if (!logged.length) continue;
        const hitTop = logged.length >= block.sets && logged.every((s) => s.reps >= ex.repsMax);
        rows.push({ ex, logged, hitTop });
      }
    }
    return rows;
  });

  const sessionMuscles = $derived.by((): string[] => {
    const out: string[] = [];
    for (const row of summaryRows) {
      for (const m of row.ex.muscles) {
        if (!out.includes(m)) out.push(m);
      }
    }
    return out;
  });

  function bumpWeight(ex: Exercise) {
    weights[ex.id] = roundWeight((weights[ex.id] ?? 0) + ex.weightStep);
    bumped[ex.id] = true;
  }

  const workProgress = $derived(steps.length ? stepIdx / steps.length : 0);

  const nextUpText = $derived.by((): string => {
    const s = step;
    if (!s) return '';
    const next = steps[stepIdx + 1];
    if (!next) return 'Last set of the day — finish strong.';
    if (s.restAfterSec === 0) return `Superset: ${next.exercise.name} right after, no rest`;
    return `Then rest ${formatTime(s.restAfterSec)} → ${next.exercise.name} (set ${next.setNumber} of ${next.totalSets})`;
  });
</script>

{#snippet iconMinus(color: string)}
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
    ><path d="M4 10h12" stroke={color} stroke-width="2.2" /></svg
  >
{/snippet}

{#snippet iconPlus(color: string)}
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
    ><path d="M4 10h12M10 4v12" stroke={color} stroke-width="2.2" /></svg
  >
{/snippet}

{#snippet chips(muscles: string[])}
  <div class="flex flex-wrap gap-1.5">
    {#each muscles as m (m)}
      <span class="chip">{m}</span>
    {/each}
  </div>
{/snippet}

{#snippet weightRow(ex: Exercise, sub: string, bordered: boolean)}
  <div
    class="flex items-center justify-between py-4 {bordered ? 'hairline-t' : ''}"
    style="min-height: 84px;"
  >
    <div class="flex flex-col gap-0.5">
      <span class="row-label">Weight</span>
      <span class="row-sub">{sub}</span>
    </div>
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="stepper"
        onclick={() => adjustWeight(ex, -1)}
        aria-label="Decrease weight"
      >
        {@render iconMinus('#f2f3ea')}
      </button>
      <input
        type="number"
        inputmode="decimal"
        min="0"
        step={ex.weightStep}
        bind:value={weights[ex.id]}
        onblur={() => sanitizeWeight(ex)}
        aria-label="Weight in pounds"
        class="display num-input tab"
      />
      <button
        type="button"
        class="stepper"
        onclick={() => adjustWeight(ex, 1)}
        aria-label="Increase weight"
      >
        {@render iconPlus('#f2f3ea')}
      </button>
    </div>
  </div>
{/snippet}

<div class="wrap min-h-screen w-full">
  <div class="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-5 pb-8 pt-5">
    {#if screen === 'lock'}
      <div class="relative flex flex-1 flex-col justify-center overflow-hidden">
        <div class="watermark display" aria-hidden="true">35</div>
        <div class="relative flex flex-col gap-11">
          <div class="flex flex-col gap-3.5">
            <div class="h-1.5 w-11" style="background: var(--accent);"></div>
            <h1 class="display m-0 text-[56px] leading-[0.94] tracking-tight">Training<br />log</h1>
            <p class="eyebrow m-0">35-minute program · Mon / Wed / Fri</p>
          </div>
          <form onsubmit={submitPassword} class="flex flex-col gap-3">
            <input
              type="password"
              bind:value={password}
              placeholder="Password"
              aria-label="Password"
              class="pw-input"
            />
            {#if passwordError}
              <p class="m-0 text-sm" style="color: #ff6a3d;">{passwordError}</p>
            {/if}
            <button type="submit" class="btn-accent h-[60px]">
              <span class="display text-[15px] tracking-[2.5px]">Unlock</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
                ><path d="M4 10h12M11 5l5 5-5 5" stroke="#0e0f0d" stroke-width="2.2" /></svg
              >
            </button>
          </form>
        </div>
      </div>
    {:else if screen === 'home'}
      <div class="flex flex-col gap-2 pt-2">
        <p class="eyebrow m-0">{homeEyebrow}</p>
        <h1 class="display m-0 text-[34px] leading-none">Workout {suggestedId}<br />is up.</h1>
      </div>

      {#if resumable}
        <div class="card mt-4 flex flex-col gap-3 p-4" style="border-color: var(--accent);">
          <p class="m-0 text-sm font-bold">
            Workout {resumable.workoutId} in progress — {resumable.sets.length} sets logged
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn-accent h-11 flex-1 text-xs font-bold uppercase tracking-[2px]"
              onclick={resumeWorkout}
            >
              Resume
            </button>
            <button
              type="button"
              class="btn-ghost h-11 px-4 text-xs font-bold uppercase tracking-[2px]"
              onclick={discardResumable}
            >
              Discard
            </button>
          </div>
        </div>
      {/if}

      {#each WORKOUTS as w (w.id)}
        {#if w.id === suggestedId}
          <div class="card mt-4 flex flex-col gap-3.5 px-4 pb-4 pt-[18px]">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5">
                <span class="display text-[17px]">Workout {w.id}</span>
                <span class="row-sub">{w.title}</span>
              </div>
              <span class="tag-accent">Up next</span>
            </div>
            <div class="flex flex-col gap-[7px] text-[13px]" style="color: #c9ccbb;">
              {#each w.blocks as block (block.label)}
                <div class="flex gap-2.5">
                  <span
                    class="w-[26px] shrink-0 text-[11px] font-bold"
                    style="color: var(--muted2);"
                    >{block.kind === 'single' ? block.label : `${block.label}ab`}</span
                  >
                  {listLine(block)}
                </div>
              {/each}
            </div>
            {@render chips(workoutMuscles(w))}
            <button type="button" class="btn-accent h-14" onclick={() => startWorkout(w)}>
              <span class="display text-sm tracking-[2.2px]">Start workout {w.id}</span>
            </button>
          </div>
        {:else}
          <div class="card2 mt-4 flex flex-col gap-3 p-4">
            <div class="flex flex-col gap-0.5">
              <span class="display text-[15px]" style="color: #c9ccbb;">Workout {w.id}</span>
              <span class="row-sub">{w.title}</span>
            </div>
            <button type="button" class="btn-outline h-12" onclick={() => startWorkout(w)}>
              Start workout {w.id}
            </button>
          </div>
        {/if}
      {/each}

      {#if history.length}
        <div class="mt-6 flex flex-col">
          <p class="eyebrow m-0 mb-1 text-[10px]">Recent</p>
          {#each history.slice(-5).reverse() as ses (ses.date)}
            <div class="hairline-t flex items-center justify-between py-3.5 text-[13px]">
              <span class="font-bold"
                >{ses.workout}
                <span class="font-normal" style="color: var(--muted);">— {shortDate(ses.date)}</span
                ></span
              >
              <span class="tab" style="color: var(--muted);"
                >{ses.sets.length} sets · {formatTime(ses.durationSec)}</span
              >
            </div>
          {/each}
        </div>
      {/if}

      <div class="hairline-t mt-6 flex flex-col gap-2 pt-4">
        <p class="display m-0 text-[13px]">Backup</p>
        <p class="m-0 text-[11px]" style="color: var(--muted);">
          Your log lives only in this browser. Export a JSON backup to keep it safe or move it to
          another device.
        </p>
        <div class="mt-1 flex gap-2">
          <button
            type="button"
            class="btn-ghost h-11 flex-1 text-xs font-bold uppercase tracking-[2px]"
            onclick={exportData}
          >
            Export data
          </button>
          <button
            type="button"
            class="btn-ghost h-11 flex-1 text-xs font-bold uppercase tracking-[2px]"
            onclick={() => importFileInput?.click()}
          >
            Import backup
          </button>
          <input
            type="file"
            accept=".json,application/json"
            class="hidden"
            bind:this={importFileInput}
            onchange={importData}
            aria-label="Import backup file"
          />
        </div>
        {#if importStatus}
          <p
            class="m-0 text-sm"
            style="color: {importStatus.startsWith('Import failed') ? '#ff6a3d' : 'var(--accent)'};"
          >
            {importStatus}
          </p>
        {/if}
      </div>
    {:else if screen === 'active' && workout}
      <div class="flex flex-col gap-3.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-[2.2px]">Workout {workout.id}</span>
          <span class="tab text-base font-bold" style="color: #c9ccbb;" aria-label="Elapsed time"
            >{formatTime(elapsedSec)}</span
          >
          <button
            type="button"
            class="btn-ghost h-11 px-3.5 text-[10px] font-bold uppercase tracking-[1.8px]"
            style="color: var(--muted);"
            onclick={endEarly}
          >
            End
          </button>
        </div>
        <div class="stripes flex h-1">
          <div style="width: {Math.round(workProgress * 100)}%; background: var(--accent);"></div>
        </div>
      </div>

      {#if runningLong}
        <p class="m-0 mt-3 text-xs" style="color: #ff6a3d;">
          Running long — the cut is exercise 4, never rest on the squat or press.
        </p>
      {/if}

      {#if phase === 'warmup'}
        <div class="mt-6 flex flex-col gap-2.5">
          <span class="row-label" style="color: var(--muted2);">Warm-up · 3–4 min</span>
          <h2 class="display m-0 text-[32px] leading-none">{steps[0]?.exercise.name}</h2>
          <p class="m-0 text-sm" style="color: var(--muted);">
            One light set, then a moderate set. Skip the treadmill.
          </p>
        </div>
        {#if steps[0]}
          <div class="mt-4">
            {@render weightRow(
              steps[0].exercise,
              `lb${steps[0].exercise.weightNote ? ` · ${steps[0].exercise.weightNote}` : ''}`,
              true
            )}
          </div>
        {/if}
        <button type="button" class="btn-accent mt-auto h-16" onclick={startFirstSet}>
          <span class="display text-base tracking-[2.4px]">Start set 1</span>
        </button>
      {:else if phase === 'work' && step}
        <div class="mt-6 flex flex-col gap-2.5">
          <div class="flex items-center gap-2.5">
            <span class="row-label" style="color: var(--muted2);"
              >{step.blockLabel} — Set {step.setNumber} of {step.totalSets}</span
            >
            {#if step.pairSecond}
              <span class="tag-outline">superset — go now</span>
            {:else if step.partnerName}
              <span class="tag-outline">superset</span>
            {/if}
          </div>
          <h2 class="display m-0 text-[36px] leading-[0.98]">{step.exercise.name}</h2>
          <div class="flex items-baseline gap-2.5">
            <span class="tab text-[15px] font-bold">{repsLabel(step.exercise)}</span>
            <span class="row-sub">target</span>
          </div>
          {#if step.exercise.note}
            <p class="m-0 text-xs" style="color: var(--muted);">{step.exercise.note}</p>
          {/if}
          {#if step.exercise.capNote && (weights[step.exercise.id] ?? 0) >= step.exercise.capNote.atWeight}
            <p class="m-0 text-xs" style="color: #ff6a3d;">{step.exercise.capNote.note}</p>
          {/if}
          <div class="flex items-center gap-[18px] py-1">
            <MuscleMap muscles={step.exercise.muscles} width={50} />
            <div class="flex flex-col items-start gap-1.5">
              {#each step.exercise.muscles as m (m)}
                <span class="chip">{m}</span>
              {/each}
            </div>
          </div>
          {#if lastPerf(step.exercise.id)}
            {@const perf = lastPerf(step.exercise.id)}
            <p class="tab m-0 text-xs" style="color: var(--muted);">
              Last time — {perf?.weight} lb × {perf?.reps.join(' · ')}
            </p>
          {/if}
        </div>

        <div class="mt-3 flex flex-col">
          {@render weightRow(
            step.exercise,
            `lb${step.exercise.weightNote ? ` · ${step.exercise.weightNote}` : ''}`,
            true
          )}
          <div
            class="hairline-t hairline-b flex items-center justify-between py-4"
            style="min-height: 84px;"
          >
            <div class="flex flex-col gap-0.5">
              <span class="row-label">Reps</span>
              <span class="row-sub"
                >{step.exercise.perSide ? `per ${step.exercise.perSide}` : 'this set'}</span
              >
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="stepper"
                onclick={() => (repsInput = Math.max(0, repsInput - 1))}
                aria-label="Decrease reps"
              >
                {@render iconMinus('#f2f3ea')}
              </button>
              <span class="display num-display tab">{repsInput}</span>
              <button
                type="button"
                class="stepper"
                onclick={() => (repsInput = repsInput + 1)}
                aria-label="Increase reps"
              >
                {@render iconPlus('#f2f3ea')}
              </button>
            </div>
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-2.5 pt-4">
          <button type="button" class="btn-accent h-16" onclick={() => advance(true)}>
            <span class="display text-base tracking-[2.4px]">Log set</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
              ><path d="M4 10l4 4 8-8" stroke="#0e0f0d" stroke-width="2.4" /></svg
            >
          </button>
          <button
            type="button"
            class="h-11 bg-transparent text-[11px] font-bold uppercase tracking-[2px]"
            style="color: var(--muted2); border: 0; cursor: pointer;"
            onclick={() => advance(false)}
          >
            Skip set
          </button>
          <div class="card flex items-center gap-2.5 px-3.5 py-3">
            <span
              class="shrink-0 text-[9px] font-bold uppercase tracking-[1.8px]"
              style="color: var(--accent);">Up next →</span
            >
            <span class="text-xs" style="color: #c9ccbb;">{nextUpText}</span>
          </div>
        </div>
      {:else if phase === 'rest' && step}
        <div class="flex flex-col items-center gap-1.5 pt-11">
          <span class="text-xs font-bold uppercase tracking-[4px]" style="color: var(--muted2);"
            >Rest</span
          >
          <span class="display rest-countdown tab" style="color: var(--accent);"
            >{formatTime(restRemaining)}</span
          >
        </div>
        <div class="stripes mt-6 flex h-3">
          <div
            style="width: {restTotal
              ? Math.round((restRemaining / restTotal) * 100)
              : 0}%; background: var(--accent); transition: width 0.3s;"
          ></div>
        </div>
        <div class="mt-4 flex gap-2.5">
          <button
            type="button"
            class="btn-ghost h-[52px] flex-1 text-[13px] font-bold tracking-[1.5px]"
            onclick={() => adjustRest(-15)}
          >
            −15s
          </button>
          <button
            type="button"
            class="btn-ghost h-[52px] flex-1 text-[13px] font-bold tracking-[1.5px]"
            onclick={() => adjustRest(30)}
          >
            +30s
          </button>
          <button type="button" class="btn-accent h-[52px] flex-[1.4]" onclick={skipRest}>
            <span class="display text-xs tracking-[2px]">Skip rest</span>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"
              ><path d="M6 4l6 6-6 6M14 4v12" stroke="#0e0f0d" stroke-width="2.2" /></svg
            >
          </button>
        </div>

        <div class="card mt-auto flex flex-col gap-3 px-4 py-[18px]">
          <div class="flex items-center gap-2.5">
            <span
              class="text-[9px] font-bold uppercase tracking-[1.8px]"
              style="color: var(--accent);">Up next</span
            >
            <span class="row-label" style="color: var(--muted2);"
              >{step.blockLabel} — Set {step.setNumber} of {step.totalSets}</span
            >
          </div>
          <span class="display text-2xl leading-none">{step.exercise.name}</span>
          <span class="text-xs" style="color: var(--muted);">
            {repsLabel(step.exercise)}{step.partnerName
              ? ` · superset with ${step.partnerName}`
              : ''}
          </span>
          <div class="hairline-t flex items-center justify-between pt-3.5">
            <div class="flex items-baseline gap-2">
              <input
                type="number"
                inputmode="decimal"
                min="0"
                step={step.exercise.weightStep}
                bind:value={weights[step.exercise.id]}
                onblur={() => step && sanitizeWeight(step.exercise)}
                aria-label="Weight in pounds"
                class="display num-input-sm tab"
              />
              <span class="row-sub"
                >lb{step.exercise.weightNote ? ` · ${step.exercise.weightNote}` : ''}</span
              >
            </div>
            <div class="flex gap-2.5">
              <button
                type="button"
                class="stepper-sm"
                onclick={() => step && adjustWeight(step.exercise, -1)}
                aria-label="Decrease weight"
              >
                {@render iconMinus('#f2f3ea')}
              </button>
              <button
                type="button"
                class="stepper-sm"
                onclick={() => step && adjustWeight(step.exercise, 1)}
                aria-label="Increase weight"
              >
                {@render iconPlus('#f2f3ea')}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {:else if screen === 'summary' && finished}
      <div class="flex flex-col gap-2 pt-2">
        <p class="eyebrow m-0">
          {shortDate(finished.date)} · {formatTime(finished.durationSec)} total · {finished.sets
            .length} sets
        </p>
        <h1 class="display m-0 text-[38px] leading-[0.96]">
          Workout {finished.workout}.<br /><span style="color: var(--accent);">Done.</span>
        </h1>
      </div>

      <div class="mt-4 flex flex-col gap-2">
        <p class="eyebrow m-0 text-[10px]">Muscles exercised</p>
        <div class="flex items-start gap-4">
          <MuscleMap muscles={sessionMuscles} width={55} />
          <div class="flex flex-1 flex-wrap content-start gap-1.5">
            {#each sessionMuscles as m (m)}
              <span class="chip">{m}</span>
            {/each}
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-col">
        {#each summaryRows as row, i (row.ex.id)}
          <div
            class="hairline-t flex flex-col gap-1 py-3 {i === summaryRows.length - 1
              ? 'hairline-b'
              : ''}"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex flex-col gap-0.5">
                <span class="text-[13px] font-bold">{row.ex.name}</span>
                <span class="tab text-[11px]" style="color: var(--muted);">
                  {row.logged[0].weight} lb × {row.logged.map((s) => s.reps).join(' · ')}
                </span>
              </div>
              {#if row.hitTop}
                {#if bumped[row.ex.id]}
                  <span
                    class="text-[11px] font-bold uppercase tracking-[1.4px]"
                    style="color: var(--accent);"
                  >
                    ✓ {weights[row.ex.id]} lb next
                  </span>
                {:else}
                  <button
                    type="button"
                    class="btn-accent h-10 whitespace-nowrap px-2.5 text-[9px] font-bold uppercase tracking-[1.4px]"
                    onclick={() => bumpWeight(row.ex)}
                  >
                    +{row.ex.weightStep} lb next
                  </button>
                {/if}
              {/if}
            </div>
            {#if row.hitTop}
              <p class="m-0 text-[11px]" style="color: var(--accent);">
                Hit the top of the rep range on every set — add weight next session.
              </p>
            {/if}
            {#if row.ex.capNote && (weights[row.ex.id] ?? 0) >= row.ex.capNote.atWeight}
              <p class="m-0 text-[11px]" style="color: #ff6a3d;">{row.ex.capNote.note}</p>
            {/if}
          </div>
        {/each}
      </div>

      <button type="button" class="btn-accent mt-auto h-14" onclick={() => (screen = 'home')}>
        <span class="display text-sm tracking-[2.2px]">Done</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .wrap {
    --bg: #0e0f0d;
    --card: #161813;
    --card2: #131510;
    --line: #2b2e25;
    --line2: #23261e;
    --text: #f2f3ea;
    --chipt: #b3b6a3;
    --muted: #90947f;
    --muted2: #6f7361;
    --accent: #c8f542;
    --on: #0e0f0d;
    background: var(--bg);
    color: var(--text);
    font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
  }
  .display {
    font-family: 'Archivo Black', 'Arial Black', sans-serif;
    text-transform: uppercase;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 2.6px;
    text-transform: uppercase;
    color: var(--muted);
  }
  .chip {
    padding: 4px 8px;
    border: 1px solid var(--line);
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--chipt);
    white-space: nowrap;
  }
  .tag-accent {
    padding: 5px 9px;
    background: var(--accent);
    color: var(--on);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
  }
  .tag-outline {
    padding: 4px 8px;
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
  }
  .card2 {
    background: var(--card2);
    border: 1px solid var(--line2);
  }
  .hairline-t {
    border-top: 1px solid var(--line2);
  }
  .hairline-b {
    border-bottom: 1px solid var(--line2);
  }
  .stripes {
    background: repeating-linear-gradient(135deg, #1c1e18 0 6px, #23261e 6px 12px);
    overflow: hidden;
  }
  .tab {
    font-variant-numeric: tabular-nums;
  }
  .row-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .row-sub {
    font-size: 10px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--muted2);
  }
  .btn-accent {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--accent);
    color: var(--on);
    border: 0;
    border-radius: 0;
    cursor: pointer;
  }
  .btn-accent:active {
    transform: scale(0.98);
  }
  .btn-ghost {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 0;
    cursor: pointer;
  }
  .btn-outline {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 0;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .stepper {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 0;
    cursor: pointer;
  }
  .stepper:active {
    transform: scale(0.95);
  }
  .stepper-sm {
    width: 46px;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 0;
    cursor: pointer;
  }
  .num-display {
    width: 76px;
    text-align: center;
    font-size: 34px;
  }
  .num-input {
    width: 76px;
    text-align: center;
    font-size: 34px;
    background: transparent;
    color: var(--text);
    border: 0;
    padding: 0;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .num-input:focus {
    outline: none;
  }
  .num-input::-webkit-inner-spin-button,
  .num-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
  .num-input-sm {
    width: 64px;
    font-size: 28px;
    background: transparent;
    color: var(--text);
    border: 0;
    padding: 0;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .num-input-sm:focus {
    outline: none;
  }
  .num-input-sm::-webkit-inner-spin-button,
  .num-input-sm::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
  .rest-countdown {
    font-size: clamp(84px, 28vw, 116px);
    line-height: 1;
  }
  .pw-input {
    height: 60px;
    padding: 0 18px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 0;
    color: var(--text);
    font-size: 16px;
    font-family: inherit;
  }
  .pw-input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }
  .pw-input::placeholder {
    color: var(--muted2);
  }
  .watermark {
    position: absolute;
    top: -30px;
    right: -30px;
    font-size: 300px;
    line-height: 1;
    color: transparent;
    -webkit-text-stroke: 1px #23261e;
    pointer-events: none;
    user-select: none;
  }
</style>
