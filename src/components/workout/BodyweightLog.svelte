<script lang="ts">
  import type { BodyweightEntry } from './plan';

  interface Props {
    entries: BodyweightEntry[];
    today: string;
    onlog: (lb: number) => void;
    ondelete: (date: string) => void;
  }

  let { entries, today, onlog, ondelete }: Props = $props();

  const latest = $derived(entries.length ? entries[entries.length - 1] : null);
  const todayEntry = $derived(entries.find((e) => e.date === today) ?? null);

  let input = $state<number | null>(null);
  $effect(() => {
    // Prefill with the most recent weigh-in until the user types.
    if (input === null && latest) input = latest.lb;
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const lb = Number(input);
    if (!Number.isFinite(lb) || lb <= 0) return;
    onlog(Math.round(lb * 10) / 10);
  }

  function dayNumber(date: string): number {
    return Math.round(new Date(`${date}T00:00:00`).getTime() / 86_400_000);
  }

  function shortDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  // ---- Trend: least-squares slope over the last 28 days of entries ----

  const trend = $derived.by(() => {
    if (entries.length < 3) return null;
    const last = dayNumber(entries[entries.length - 1].date);
    const first = dayNumber(entries[0].date);
    if (last - first < 21) return null;
    const pts = entries
      .map((e) => ({ t: dayNumber(e.date), y: e.lb }))
      .filter((p) => last - p.t <= 28);
    if (pts.length < 2) return null;
    const mt = pts.reduce((a, p) => a + p.t, 0) / pts.length;
    const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    let num = 0;
    let den = 0;
    for (const p of pts) {
      num += (p.t - mt) * (p.y - my);
      den += (p.t - mt) ** 2;
    }
    const perWeek = den ? (num / den) * 7 : 0;
    const threeWeekGain = perWeek * 3;
    let kind: 'stalled' | 'fast' | 'pace';
    if (threeWeekGain < 0.5) kind = 'stalled';
    else if (perWeek > 1.25) kind = 'fast';
    else kind = 'pace';
    return { perWeek, kind };
  });

  const trendText = $derived.by(() => {
    if (!trend) return 'Log weekly — the trend shows after 3 weeks.';
    const rate = `${trend.perWeek >= 0 ? '+' : '−'}${Math.abs(trend.perWeek).toFixed(1)} lb/wk`;
    if (trend.kind === 'stalled') return `${rate} — scale hasn’t moved in 3 weeks. Eat more.`;
    if (trend.kind === 'fast') return `${rate} — gaining fast; ease off a little.`;
    return `${rate} — on pace.`;
  });

  // ---- Sparkline: last 84 days ----

  const W = 320;
  const H = 96;
  const PAD = { l: 30, r: 44, t: 10, b: 18 };

  const chart = $derived.by(() => {
    if (!entries.length) return null;
    const lastDay = dayNumber(entries[entries.length - 1].date);
    const win = entries.filter((e) => lastDay - dayNumber(e.date) <= 84);
    if (win.length < 2) return null;
    const t0 = dayNumber(win[0].date);
    const t1 = lastDay;
    const lbs = win.map((e) => e.lb);
    let lo = Math.floor(Math.min(...lbs) - 1);
    let hi = Math.ceil(Math.max(...lbs) + 1);
    if (hi - lo < 4) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 2);
      hi = Math.ceil(mid + 2);
    }
    const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
    const y = (lb: number) => PAD.t + (1 - (lb - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const points = win.map((e) => ({ ...e, x: x(dayNumber(e.date)), y: y(e.lb) }));
    const path = points
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const ticks = [lo, (lo + hi) / 2, hi].map((v) => ({ v, y: y(v) }));
    return { points, path, ticks, showDots: points.length <= 16 };
  });

  let hover = $state<number | null>(null);
  let svgEl = $state<SVGSVGElement | null>(null);

  function onPointer(e: PointerEvent) {
    if (!chart || !svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    chart.points.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    hover = best;
  }

  const hovered = $derived(chart && hover !== null ? chart.points[hover] : null);
  const recent = $derived(entries.slice(-6).reverse());
</script>

<div class="card flex flex-col gap-3 px-4 pb-4 pt-[18px]">
  <div class="flex items-start justify-between gap-3">
    <div class="flex flex-col gap-0.5">
      <span class="display text-[15px]">Bodyweight</span>
      <span class="text-[10px] uppercase tracking-[1.6px]" style="color: var(--muted2);"
        >{latest ? `last: ${shortDate(latest.date)}` : 'weigh in weekly'}</span
      >
    </div>
    {#if latest}
      <div class="flex items-baseline gap-1">
        <span class="display text-[28px] leading-none">{latest.lb}</span>
        <span class="text-[10px] uppercase tracking-[1.6px]" style="color: var(--muted2);">lb</span>
      </div>
    {/if}
  </div>

  <form onsubmit={submit} class="flex gap-2">
    <input
      type="number"
      inputmode="decimal"
      min="0"
      step="0.1"
      bind:value={input}
      aria-label="Bodyweight in pounds"
      class="bw-input tab"
    />
    <button type="submit" class="bw-log display">{todayEntry ? 'Update today' : 'Log today'}</button
    >
  </form>

  <p
    class="m-0 text-[11px]"
    style="color: {trend?.kind === 'stalled' || trend?.kind === 'fast'
      ? '#ff6a3d'
      : trend
        ? 'var(--accent)'
        : 'var(--muted)'};"
    data-trend={trend?.kind ?? 'none'}
  >
    {trendText}
  </p>

  {#if chart}
    <div class="flex flex-col gap-1">
      <p class="tab m-0 h-4 text-[11px]" style="color: var(--muted);" aria-live="polite">
        {#if hovered}
          <span class="font-bold" style="color: var(--text);">{hovered.lb} lb</span> · {shortDate(
            hovered.date
          )}
        {:else}
          Last 12 weeks · hover or drag for values
        {/if}
      </p>
      <svg
        bind:this={svgEl}
        viewBox="0 0 {W} {H}"
        class="w-full"
        style="touch-action: pan-y; height: auto;"
        role="img"
        aria-label="Bodyweight trend, last 12 weeks"
        onpointermove={onPointer}
        onpointerdown={onPointer}
        onpointerleave={() => (hover = null)}
      >
        {#each chart.ticks as tick (tick.v)}
          <line x1={PAD.l} x2={W - PAD.r} y1={tick.y} y2={tick.y} class="grid" />
          <text x={PAD.l - 6} y={tick.y + 3} class="tick" text-anchor="end">{tick.v}</text>
        {/each}
        <text x={PAD.l} y={H - 4} class="tick">{shortDate(chart.points[0].date)}</text>
        <text x={W - PAD.r} y={H - 4} class="tick" text-anchor="end"
          >{shortDate(chart.points[chart.points.length - 1].date)}</text
        >
        {#if hovered}
          <line x1={hovered.x} x2={hovered.x} y1={PAD.t} y2={H - PAD.b} class="crosshair" />
        {/if}
        <path d={chart.path} class="series" />
        {#if chart.showDots}
          {#each chart.points as p (p.date)}
            <circle cx={p.x} cy={p.y} r="4" class="dot" />
          {/each}
        {/if}
        {#if hovered}
          <circle cx={hovered.x} cy={hovered.y} r="5" class="dot" />
        {/if}
        {#if !hovered}
          {@const end = chart.points[chart.points.length - 1]}
          <circle cx={end.x} cy={end.y} r="4.5" class="dot" />
          <text x={end.x + 9} y={end.y + 4} class="end-label">{end.lb}</text>
        {/if}
      </svg>
    </div>
  {/if}

  {#if recent.length}
    <div class="flex flex-col">
      {#each recent as e, i (e.date)}
        {@const prev = entries[entries.length - 1 - i - 1]}
        <div class="hairline-t flex items-center gap-2 py-1.5 text-[12px]">
          <span style="color: var(--muted);">{shortDate(e.date)}</span>
          <span class="tab font-bold">{e.lb} lb</span>
          {#if prev}
            <span class="tab text-[11px]" style="color: var(--muted2);"
              >{e.lb - prev.lb >= 0 ? '+' : '−'}{Math.abs(e.lb - prev.lb).toFixed(1)}</span
            >
          {/if}
          <button
            type="button"
            class="bw-remove"
            onclick={() => ondelete(e.date)}
            aria-label="Remove weigh-in {shortDate(e.date)}"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"
              ><path d="M5 5l10 10M15 5L5 15" stroke="#90947f" stroke-width="2" /></svg
            >
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .display {
    font-family: 'Archivo Black', 'Arial Black', sans-serif;
    text-transform: uppercase;
  }
  .tab {
    font-variant-numeric: tabular-nums;
  }
  .card {
    background: var(--card, #161813);
    border: 1px solid var(--line, #2b2e25);
  }
  .hairline-t {
    border-top: 1px solid var(--line2, #23261e);
  }
  .bw-input {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 12px;
    background: var(--card2, #131510);
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    color: var(--text, #f2f3ea);
    font-size: 18px;
    font-weight: 700;
    font-family: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .bw-input:focus {
    outline: 2px solid var(--accent, #c8f542);
    outline-offset: -1px;
  }
  .bw-input::-webkit-inner-spin-button,
  .bw-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
  .bw-log {
    height: 44px;
    padding: 0 16px;
    background: var(--accent, #c8f542);
    color: var(--on, #0e0f0d);
    border: 0;
    border-radius: 0;
    cursor: pointer;
    font-size: 11px;
    letter-spacing: 2px;
    white-space: nowrap;
  }
  .bw-remove {
    margin-left: auto;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    cursor: pointer;
  }
  .grid {
    stroke: var(--line2, #23261e);
    stroke-width: 1;
  }
  .tick {
    font-size: 9px;
    fill: var(--muted2, #6f7361);
    font-family: inherit;
  }
  .crosshair {
    stroke: var(--muted2, #6f7361);
    stroke-width: 1;
  }
  .series {
    fill: none;
    stroke: var(--accent, #c8f542);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .dot {
    fill: var(--accent, #c8f542);
    stroke: var(--card, #161813);
    stroke-width: 2;
  }
  .end-label {
    font-size: 11px;
    font-weight: 700;
    fill: var(--text, #f2f3ea);
    font-family: inherit;
  }
</style>
