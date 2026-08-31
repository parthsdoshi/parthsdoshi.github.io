export interface Exercise {
  id: string;
  name: string;
  repsMin: number;
  repsMax: number;
  perSide?: 'leg' | 'arm' | 'side';
  muscles: string[];
  /** lb added/removed per tap of the +/- buttons */
  weightStep: number;
  defaultWeight: number;
  weightNote?: string;
  note?: string;
  /** shown once the working weight reaches atWeight */
  capNote?: { atWeight: number; note: string };
}

export interface SingleBlock {
  kind: 'single';
  label: string;
  sets: number;
  restSec: number;
  exercise: Exercise;
}

export interface SupersetBlock {
  kind: 'superset';
  label: string;
  sets: number;
  restSec: number;
  exercises: [Exercise, Exercise];
}

export type Block = SingleBlock | SupersetBlock;

export interface WorkoutDef {
  id: 'A' | 'B';
  title: string;
  blocks: Block[];
}

export interface SetStep {
  key: string;
  blockLabel: string;
  exercise: Exercise;
  setNumber: number;
  totalSets: number;
  /** 0 means superset transition: go straight to the next step */
  restAfterSec: number;
  /** first half of a superset pair — partner comes immediately after */
  partnerName?: string;
  /** second half of a superset pair — arrived at with no rest */
  pairSecond?: boolean;
}

export interface LoggedSet {
  exerciseId: string;
  name: string;
  blockLabel: string;
  setNumber: number;
  weight: number;
  reps: number;
}

export interface Session {
  date: string;
  workout: 'A' | 'B';
  durationSec: number;
  sets: LoggedSet[];
  /** free-form note about the whole session */
  note?: string;
  /** exercise id -> note jotted during the session */
  exerciseNotes?: Record<string, string>;
}

const workoutA: WorkoutDef = {
  id: 'A',
  title: 'Squat, bench, row, hinge',
  blocks: [
    {
      kind: 'single',
      label: '1',
      sets: 3,
      restSec: 120,
      exercise: {
        id: 'goblet-squat',
        name: 'Goblet squat',
        repsMin: 8,
        repsMax: 10,
        muscles: ['Quads', 'Glutes', 'Core'],
        weightStep: 5,
        defaultWeight: 0,
        weightNote: 'pick a weight that leaves 2 reps in the tank',
        capNote: {
          atWeight: 50,
          note: 'At 50 and feeling easy: move to DB front squat (two dumbbells at the shoulders).',
        },
      },
    },
    {
      kind: 'superset',
      label: '2',
      sets: 3,
      restSec: 90,
      exercises: [
        {
          id: 'db-bench',
          name: 'DB bench press',
          repsMin: 6,
          repsMax: 10,
          muscles: ['Chest', 'Front delts', 'Triceps'],
          weightStep: 5,
          defaultWeight: 45,
          weightNote: 'per dumbbell',
          capNote: {
            atWeight: 50,
            note: 'At 50s for 10: switch to incline or add a 2-second pause at the bottom and climb again.',
          },
        },
        {
          id: 'db-row',
          name: 'Chest-supported DB row',
          repsMin: 8,
          repsMax: 12,
          muscles: ['Lats', 'Upper back', 'Rear delts', 'Biceps'],
          weightStep: 5,
          defaultWeight: 30,
          weightNote: 'per dumbbell',
          note: 'Strict, pause at top. Goal: match or beat your bench weight.',
        },
      ],
    },
    {
      kind: 'superset',
      label: '3',
      sets: 2,
      restSec: 75,
      exercises: [
        {
          id: 'db-rdl',
          name: 'DB Romanian deadlift',
          repsMin: 8,
          repsMax: 10,
          muscles: ['Hamstrings', 'Glutes', 'Lower back'],
          weightStep: 5,
          defaultWeight: 35,
          weightNote: 'per dumbbell',
        },
        {
          id: 'lateral-raise',
          name: 'Lateral raise',
          repsMin: 12,
          repsMax: 15,
          muscles: ['Side delts'],
          weightStep: 5,
          defaultWeight: 10,
          weightNote: 'per dumbbell',
        },
      ],
    },
    {
      kind: 'single',
      label: '4',
      sets: 2,
      restSec: 60,
      exercise: {
        id: 'cable-crunch',
        name: 'Cable crunch',
        repsMin: 12,
        repsMax: 15,
        muscles: ['Core'],
        weightStep: 2.5,
        defaultWeight: 0,
        note: 'If time allows — this is the cut when running over.',
      },
    },
  ],
};

const workoutB: WorkoutDef = {
  id: 'B',
  title: 'Lunge, overhead press, pulldown',
  blocks: [
    {
      kind: 'single',
      label: '1',
      sets: 3,
      restSec: 120,
      exercise: {
        id: 'reverse-lunge',
        name: 'DB reverse lunge',
        repsMin: 8,
        repsMax: 8,
        perSide: 'leg',
        muscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
        weightStep: 5,
        defaultWeight: 20,
        weightNote: 'per dumbbell',
      },
    },
    {
      kind: 'superset',
      label: '2',
      sets: 3,
      restSec: 90,
      exercises: [
        {
          id: 'db-shoulder-press',
          name: 'DB shoulder press',
          repsMin: 6,
          repsMax: 10,
          muscles: ['Front delts', 'Side delts', 'Triceps'],
          weightStep: 5,
          defaultWeight: 20,
          weightNote: 'per dumbbell',
        },
        {
          id: 'sa-lat-pulldown',
          name: 'Half-kneeling single-arm lat pulldown',
          repsMin: 8,
          repsMax: 12,
          perSide: 'arm',
          muscles: ['Lats', 'Biceps', 'Core'],
          weightStep: 2.5,
          defaultWeight: 0,
          weightNote: 'your pull-up substitute',
        },
      ],
    },
    {
      kind: 'superset',
      label: '3',
      sets: 2,
      restSec: 75,
      exercises: [
        {
          id: 'cable-pull-through',
          name: 'Cable pull-through',
          repsMin: 10,
          repsMax: 12,
          muscles: ['Glutes', 'Hamstrings', 'Lower back'],
          weightStep: 2.5,
          defaultWeight: 0,
        },
        {
          id: 'face-pull',
          name: 'Face pulls',
          repsMin: 15,
          repsMax: 15,
          muscles: ['Rear delts', 'Upper back'],
          weightStep: 2.5,
          defaultWeight: 0,
        },
      ],
    },
    {
      kind: 'superset',
      label: '4',
      sets: 2,
      restSec: 60,
      exercises: [
        {
          id: 'db-curl',
          name: 'Strict DB curl',
          repsMin: 10,
          repsMax: 12,
          muscles: ['Biceps'],
          weightStep: 5,
          defaultWeight: 20,
          weightNote: 'per dumbbell',
          note: 'No swing. Earn the weight back with clean reps.',
        },
        {
          id: 'tricep-pushdown',
          name: 'Tricep pushdown',
          repsMin: 10,
          repsMax: 12,
          muscles: ['Triceps'],
          weightStep: 2.5,
          defaultWeight: 28,
        },
      ],
    },
  ],
};

export const WORKOUTS: WorkoutDef[] = [workoutA, workoutB];

export function buildSteps(w: WorkoutDef): SetStep[] {
  const steps: SetStep[] = [];
  w.blocks.forEach((block, bi) => {
    for (let s = 1; s <= block.sets; s++) {
      if (block.kind === 'single') {
        steps.push({
          key: `${bi}-${block.exercise.id}-${s}`,
          blockLabel: block.label,
          exercise: block.exercise,
          setNumber: s,
          totalSets: block.sets,
          restAfterSec: block.restSec,
        });
      } else {
        const [a, b] = block.exercises;
        steps.push({
          key: `${bi}-${a.id}-${s}`,
          blockLabel: `${block.label}a`,
          exercise: a,
          setNumber: s,
          totalSets: block.sets,
          restAfterSec: 0,
          partnerName: b.name,
        });
        steps.push({
          key: `${bi}-${b.id}-${s}`,
          blockLabel: `${block.label}b`,
          exercise: b,
          setNumber: s,
          totalSets: block.sets,
          restAfterSec: block.restSec,
          pairSecond: true,
        });
      }
    }
  });
  return steps;
}

export function blockExercises(block: Block): Exercise[] {
  return block.kind === 'single' ? [block.exercise] : [...block.exercises];
}

export function workoutMuscles(w: WorkoutDef): string[] {
  const out: string[] = [];
  for (const block of w.blocks) {
    for (const ex of blockExercises(block)) {
      for (const m of ex.muscles) {
        if (!out.includes(m)) out.push(m);
      }
    }
  }
  return out;
}

export function repsLabel(ex: Exercise): string {
  const range = ex.repsMin === ex.repsMax ? `${ex.repsMin}` : `${ex.repsMin}–${ex.repsMax}`;
  return ex.perSide ? `${range} / ${ex.perSide}` : `${range} reps`;
}

export function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
