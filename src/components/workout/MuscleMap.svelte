<script lang="ts">
  interface Part {
    points: string;
    group?: string;
  }

  interface Props {
    muscles: string[];
    width?: number;
    labels?: boolean;
  }

  let { muscles, width = 55, labels = true }: Props = $props();

  // Which plan.ts muscle names light up each body-map group.
  const GROUPS: Record<string, string[]> = {
    'front-delts': ['Front delts', 'Side delts'],
    chest: ['Chest'],
    biceps: ['Biceps'],
    core: ['Core'],
    quads: ['Quads'],
    'upper-back': ['Upper back'],
    'rear-delts': ['Rear delts'],
    lats: ['Lats'],
    'lower-back': ['Lower back'],
    triceps: ['Triceps'],
    glutes: ['Glutes'],
    hamstrings: ['Hamstrings'],
    forearms: ['Forearms', 'Grip'],
  };

  const FRONT: Part[] = [
    { points: '34,20 50,20 46,26 38,26' },
    { points: '16,28 30,24 32,36 20,40', group: 'front-delts' },
    { points: '68,28 54,24 52,36 64,40', group: 'front-delts' },
    { points: '31,27 42,29 42,46 29,42', group: 'chest' },
    { points: '53,27 42,29 42,46 55,42', group: 'chest' },
    { points: '12,42 22,40 20,58 10,56', group: 'biceps' },
    { points: '72,42 62,40 64,58 74,56', group: 'biceps' },
    { points: '9,58 19,60 16,76 7,72', group: 'forearms' },
    { points: '75,58 65,60 68,76 77,72', group: 'forearms' },
    { points: '31,48 53,48 51,78 33,78', group: 'core' },
    { points: '32,80 52,80 54,88 30,88' },
    { points: '30,90 41,90 40,118 28,114', group: 'quads' },
    { points: '54,90 43,90 44,118 56,114', group: 'quads' },
    { points: '29,120 39,122 37,146 30,144' },
    { points: '55,120 45,122 47,146 54,144' },
  ];

  const BACK: Part[] = [
    { points: '32,20 52,20 48,38 36,38', group: 'upper-back' },
    { points: '16,28 30,24 32,36 20,40', group: 'rear-delts' },
    { points: '68,28 54,24 52,36 64,40', group: 'rear-delts' },
    { points: '30,40 41,42 41,56 28,52', group: 'lats' },
    { points: '54,40 43,42 43,56 56,52', group: 'lats' },
    { points: '34,56 50,56 48,72 36,72', group: 'lower-back' },
    { points: '12,42 22,40 20,58 10,56', group: 'triceps' },
    { points: '72,42 62,40 64,58 74,56', group: 'triceps' },
    { points: '9,58 19,60 16,76 7,72', group: 'forearms' },
    { points: '75,58 65,60 68,76 77,72', group: 'forearms' },
    { points: '31,76 42,76 41,90 29,88', group: 'glutes' },
    { points: '53,76 42,76 43,90 55,88', group: 'glutes' },
    { points: '29,92 40,92 39,118 28,114', group: 'hamstrings' },
    { points: '55,92 44,92 45,118 56,114', group: 'hamstrings' },
    { points: '29,120 39,122 37,146 30,144' },
    { points: '55,120 45,122 47,146 54,144' },
  ];

  const height = $derived(Math.round((width * 148) / 84));

  function lit(group?: string): boolean {
    if (!group) return false;
    return (GROUPS[group] ?? []).some((m) => muscles.includes(m));
  }
</script>

{#snippet figure(parts: Part[], label: string)}
  <div class="figure">
    <svg {width} {height} viewBox="0 0 84 148" fill="none" aria-label="Muscles worked, {label}">
      <circle cx="42" cy="11" r="8" class="neutral" />
      {#each parts as part (part.points)}
        <polygon points={part.points} class={lit(part.group) ? 'lit' : 'neutral'} />
      {/each}
    </svg>
    {#if labels}
      <span class="label">{label}</span>
    {/if}
  </div>
{/snippet}

{@render figure(FRONT, 'Front')}
{@render figure(BACK, 'Back')}

<style>
  .figure {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  .neutral {
    fill: #1c1e18;
    stroke: #2b2e25;
    stroke-width: 1;
  }
  .lit {
    fill: var(--accent, #c8f542);
  }
  .label {
    font-size: 8px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted2, #6f7361);
  }
</style>
