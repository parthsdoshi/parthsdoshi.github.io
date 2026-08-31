<script lang="ts">
  import {
    WORKOUTS,
    buildSteps,
    blockExercises,
    workoutMuscles,
    repsLabel,
    formatTime,
    type Exercise,
    type LoggedSet,
    type Session,
    type SetStep,
    type WorkoutDef,
  } from './plan';

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

  const todayNote = $derived.by(() => {
    const day = new Date().getDay();
    if (day === 0 || day === 6) return 'Weekend — rest day. Lifting anyway? Go for it.';
    if (day === 2 || day === 4) return 'Run day — 4 miles outdoors. Lifting anyway? Go for it.';
    return `Lift day — Workout ${suggestedId} is up.`;
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

{#snippet muscleChips(muscles: string[])}
  <div class="flex flex-wrap gap-1.5">
    {#each muscles as m (m)}
      <span
        class="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200"
      >
        {m}
      </span>
    {/each}
  </div>
{/snippet}

{#snippet weightControl(ex: Exercise)}
  <div class="flex items-center justify-center gap-3">
    <button
      type="button"
      class="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700 text-2xl font-bold text-gray-900 dark:text-white active:scale-95"
      onclick={() => adjustWeight(ex, -1)}
      aria-label="Decrease weight"
    >
      −
    </button>
    <div class="text-center w-28">
      <input
        type="number"
        inputmode="decimal"
        min="0"
        step={ex.weightStep}
        bind:value={weights[ex.id]}
        onblur={() => sanitizeWeight(ex)}
        aria-label="Weight in pounds"
        class="w-full text-center text-4xl font-bold bg-transparent text-gray-900 dark:text-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div class="text-xs text-gray-500 dark:text-gray-400">
        lb{ex.weightNote ? ` · ${ex.weightNote}` : ''}
      </div>
    </div>
    <button
      type="button"
      class="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700 text-2xl font-bold text-gray-900 dark:text-white active:scale-95"
      onclick={() => adjustWeight(ex, 1)}
      aria-label="Increase weight"
    >
      +
    </button>
  </div>
{/snippet}

<div class="max-w-md mx-auto pb-16">
  {#if screen === 'lock'}
    <div class="mt-16 bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Workout tracker</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Members only. Password required.</p>
      <form onsubmit={submitPassword} class="space-y-3">
        <input
          type="password"
          bind:value={password}
          placeholder="Password"
          aria-label="Password"
          class="w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {#if passwordError}
          <p class="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
        {/if}
        <button
          type="submit"
          class="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold active:scale-[0.98]"
        >
          Unlock
        </button>
      </form>
    </div>
  {:else if screen === 'home'}
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-1">35-minute lift</h1>
    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{todayNote}</p>

    {#if resumable}
      <div
        class="mb-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-2xl p-4"
      >
        <p class="font-semibold text-amber-900 dark:text-amber-200 mb-2">
          Workout {resumable.workoutId} in progress — {resumable.sets.length} sets logged
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 h-11 rounded-xl bg-amber-600 text-white font-semibold"
            onclick={resumeWorkout}
          >
            Resume
          </button>
          <button
            type="button"
            class="h-11 px-4 rounded-xl bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
            onclick={discardResumable}
          >
            Discard
          </button>
        </div>
      </div>
    {/if}

    {#each WORKOUTS as w (w.id)}
      <div class="mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">
            Workout {w.id}
            <span class="font-normal text-gray-500 dark:text-gray-400">· {w.title}</span>
          </h2>
          {#if w.id === suggestedId}
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300"
            >
              up next
            </span>
          {/if}
        </div>
        <ul class="text-sm text-gray-600 dark:text-gray-400 mb-3 space-y-0.5">
          {#each w.blocks as block (block.label)}
            <li>
              {#if block.kind === 'single'}
                <span class="font-mono text-xs text-gray-400 dark:text-gray-500">{block.label}</span
                >
                {block.exercise.name} — {block.sets}×{repsLabel(block.exercise)}
              {:else}
                <span class="font-mono text-xs text-gray-400 dark:text-gray-500"
                  >{block.label}a/b</span
                >
                {block.exercises[0].name} + {block.exercises[1].name} — {block.sets} rounds
              {/if}
            </li>
          {/each}
        </ul>
        {@render muscleChips(workoutMuscles(w))}
        <button
          type="button"
          class="mt-4 w-full h-12 rounded-xl font-semibold active:scale-[0.98] {w.id === suggestedId
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'}"
          onclick={() => startWorkout(w)}
        >
          Start Workout {w.id}
        </button>
      </div>
    {/each}

    {#if history.length}
      <h2 class="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">Recent sessions</h2>
      <div class="space-y-2">
        {#each history.slice(-5).reverse() as ses (ses.date)}
          <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow px-4 py-3 flex items-center justify-between text-sm"
          >
            <div class="text-gray-900 dark:text-white font-medium">
              Workout {ses.workout}
              <span class="text-gray-500 dark:text-gray-400 font-normal">
                · {shortDate(ses.date)}</span
              >
            </div>
            <div class="text-gray-500 dark:text-gray-400">
              {ses.sets.length} sets · {formatTime(ses.durationSec)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if screen === 'active' && workout}
    <div class="flex items-center justify-between mt-4 mb-2">
      <div class="font-bold text-gray-900 dark:text-white">Workout {workout.id}</div>
      <div class="font-mono text-lg text-gray-900 dark:text-white" aria-label="Elapsed time">
        {formatTime(elapsedSec)}
      </div>
      <button
        type="button"
        class="text-sm font-semibold text-red-600 dark:text-red-400"
        onclick={endEarly}
      >
        End
      </button>
    </div>
    <div class="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 mb-4 overflow-hidden">
      <div
        class="h-full bg-indigo-600 transition-all duration-300"
        style="width: {Math.round(workProgress * 100)}%"
      ></div>
    </div>

    {#if runningLong}
      <p class="text-xs text-amber-700 dark:text-amber-400 mb-3">
        Running long — the cut is exercise 4, never rest on the squat or press.
      </p>
    {/if}

    {#if phase === 'warmup'}
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Warm-up · 3–4 min</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          One light set of <strong class="text-gray-900 dark:text-white"
            >{steps[0]?.exercise.name}</strong
          >, then a moderate set. Skip the treadmill.
        </p>
        {#if steps[0]}
          {@render weightControl(steps[0].exercise)}
        {/if}
        <button
          type="button"
          class="mt-5 w-full h-14 rounded-xl bg-indigo-600 text-white text-lg font-semibold active:scale-[0.98]"
          onclick={startFirstSet}
        >
          Start set 1
        </button>
      </div>
    {:else if phase === 'work' && step}
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-sm text-gray-400 dark:text-gray-500">{step.blockLabel}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            Set {step.setNumber} of {step.totalSets}
          </span>
          {#if step.pairSecond}
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300"
            >
              superset — go now
            </span>
          {:else if step.partnerName}
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300"
            >
              superset
            </span>
          {/if}
        </div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{step.exercise.name}</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-2">
          Target: <strong class="text-gray-900 dark:text-white">{repsLabel(step.exercise)}</strong>
        </p>
        {#if step.exercise.note}
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{step.exercise.note}</p>
        {/if}
        {#if step.exercise.capNote && (weights[step.exercise.id] ?? 0) >= step.exercise.capNote.atWeight}
          <p class="text-sm text-amber-700 dark:text-amber-400 mb-2">
            {step.exercise.capNote.note}
          </p>
        {/if}
        <div class="mb-3">
          {@render muscleChips(step.exercise.muscles)}
        </div>
        {#if lastPerf(step.exercise.id)}
          {@const perf = lastPerf(step.exercise.id)}
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Last time: {perf?.weight} lb × {perf?.reps.join(', ')}
          </p>
        {/if}

        <div class="border-t border-gray-100 dark:border-gray-700 pt-4 mb-4">
          {@render weightControl(step.exercise)}
        </div>

        <div class="flex items-center justify-center gap-3 mb-5">
          <button
            type="button"
            class="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700 text-2xl font-bold text-gray-900 dark:text-white active:scale-95"
            onclick={() => (repsInput = Math.max(0, repsInput - 1))}
            aria-label="Decrease reps"
          >
            −
          </button>
          <div class="text-center w-28">
            <div class="text-4xl font-bold text-gray-900 dark:text-white">{repsInput}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              reps{step.exercise.perSide ? ` / ${step.exercise.perSide}` : ''}
            </div>
          </div>
          <button
            type="button"
            class="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700 text-2xl font-bold text-gray-900 dark:text-white active:scale-95"
            onclick={() => (repsInput = repsInput + 1)}
            aria-label="Increase reps"
          >
            +
          </button>
        </div>

        <button
          type="button"
          class="w-full h-14 rounded-xl bg-indigo-600 text-white text-lg font-semibold active:scale-[0.98]"
          onclick={() => advance(true)}
        >
          Log set
        </button>
        <button
          type="button"
          class="w-full h-10 mt-1 text-sm text-gray-500 dark:text-gray-400"
          onclick={() => advance(false)}
        >
          Skip set
        </button>
        <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">{nextUpText}</p>
      </div>
    {:else if phase === 'rest' && step}
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow p-5 text-center">
        <p class="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Rest</p>
        <div class="font-mono text-7xl font-bold text-gray-900 dark:text-white mb-3">
          {formatTime(restRemaining)}
        </div>
        <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-700 mb-4 overflow-hidden">
          <div
            class="h-full bg-green-500 transition-all duration-300"
            style="width: {restTotal ? Math.round((restRemaining / restTotal) * 100) : 0}%"
          ></div>
        </div>
        <div class="flex justify-center gap-2 mb-6">
          <button
            type="button"
            class="h-11 px-4 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
            onclick={() => adjustRest(-15)}
          >
            −15s
          </button>
          <button
            type="button"
            class="h-11 px-4 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold"
            onclick={() => adjustRest(30)}
          >
            +30s
          </button>
          <button
            type="button"
            class="h-11 px-4 rounded-xl bg-indigo-600 text-white font-semibold"
            onclick={skipRest}
          >
            Skip rest
          </button>
        </div>

        <div class="text-left bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
          <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Next up
          </p>
          <p class="font-bold text-gray-900 dark:text-white">
            <span class="font-mono text-sm text-gray-400 dark:text-gray-500">{step.blockLabel}</span
            >
            {step.exercise.name} — set {step.setNumber} of {step.totalSets}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {repsLabel(step.exercise)}
            {#if step.partnerName}
              · superset with {step.partnerName}{/if}
          </p>
          {@render weightControl(step.exercise)}
        </div>
      </div>
    {/if}
  {:else if screen === 'summary' && finished}
    <div class="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow p-5">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Workout {finished.workout} done 🎉
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-3">
        {formatTime(finished.durationSec)} · {finished.sets.length} sets logged
      </p>
      <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        Muscles exercised
      </p>
      <div class="mb-4">
        {@render muscleChips(sessionMuscles)}
      </div>

      <div class="space-y-3">
        {#each summaryRows as row (row.ex.id)}
          <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <p class="font-semibold text-gray-900 dark:text-white">{row.ex.name}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {row.logged[0].weight} lb × {row.logged.map((s) => s.reps).join(', ')}
                </p>
              </div>
              {#if row.hitTop}
                {#if bumped[row.ex.id]}
                  <span class="text-sm font-semibold text-green-600 dark:text-green-400">
                    ✓ {weights[row.ex.id]} lb next time
                  </span>
                {:else}
                  <button
                    type="button"
                    class="h-10 px-3 rounded-xl bg-green-600 text-white text-sm font-semibold whitespace-nowrap"
                    onclick={() => bumpWeight(row.ex)}
                  >
                    +{row.ex.weightStep} lb next time
                  </button>
                {/if}
              {/if}
            </div>
            {#if row.hitTop}
              <p class="text-xs text-green-700 dark:text-green-400 mt-1">
                Hit the top of the rep range on every set — add weight next session.
              </p>
            {/if}
            {#if row.ex.capNote && (weights[row.ex.id] ?? 0) >= row.ex.capNote.atWeight}
              <p class="text-xs text-amber-700 dark:text-amber-400 mt-1">{row.ex.capNote.note}</p>
            {/if}
          </div>
        {/each}
      </div>

      <button
        type="button"
        class="mt-6 w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold active:scale-[0.98]"
        onclick={() => (screen = 'home')}
      >
        Done
      </button>
    </div>
  {/if}
</div>
