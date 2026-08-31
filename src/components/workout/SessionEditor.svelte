<script lang="ts">
  import { formatTime, type LoggedSet, type Session } from './plan';

  interface Props {
    session: Session;
    onsave: (s: Session) => void;
    ondelete: () => void;
    oncancel: () => void;
  }

  let { session, onsave, ondelete, oncancel }: Props = $props();

  function makeDraft(): Session {
    const d = $state.snapshot(session) as Session;
    d.note ??= '';
    d.exerciseNotes ??= {};
    for (const s of d.sets) d.exerciseNotes[s.exerciseId] ??= '';
    return d;
  }

  let draft = $state(makeDraft());

  const groups = $derived.by(() => {
    const order: string[] = [];
    const byId: Record<string, { name: string; items: { set: LoggedSet; idx: number }[] }> = {};
    draft.sets.forEach((set, idx) => {
      if (!byId[set.exerciseId]) {
        byId[set.exerciseId] = { name: set.name, items: [] };
        order.push(set.exerciseId);
      }
      byId[set.exerciseId].items.push({ set, idx });
    });
    return order.map((id) => ({ id, ...byId[id] }));
  });

  function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function save() {
    const cleaned: Session = {
      date: draft.date,
      workout: draft.workout,
      durationSec: draft.durationSec,
      sets: draft.sets.map((s) => ({
        ...s,
        weight: Math.max(0, Math.round((Number(s.weight) || 0) * 2) / 2),
        reps: Math.max(0, Math.round(Number(s.reps) || 0)),
      })),
    };
    if (!cleaned.sets.length) {
      if (confirm('No sets left — delete this whole session?')) ondelete();
      return;
    }
    const note = (draft.note ?? '').trim();
    if (note) cleaned.note = note;
    const exNotes: Record<string, string> = {};
    for (const [id, text] of Object.entries(draft.exerciseNotes ?? {})) {
      const t = text.trim();
      if (t && cleaned.sets.some((s) => s.exerciseId === id)) exNotes[id] = t;
    }
    if (Object.keys(exNotes).length) cleaned.exerciseNotes = exNotes;
    onsave(cleaned);
  }

  function removeSession() {
    if (confirm('Delete this session from your log?')) ondelete();
  }

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') oncancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label="Edit session">
  <div class="sheet">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-[2px]" style="color: var(--accent);"
          >Edit session</span
        >
        <h2 class="display m-0 text-2xl leading-none">Workout {draft.workout}</h2>
        <span class="text-[11px]" style="color: var(--muted);"
          >{shortDate(draft.date)} · {formatTime(draft.durationSec)}</span
        >
      </div>
      <button type="button" class="close-btn" onclick={oncancel} aria-label="Close editor">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
          ><path d="M5 5l10 10M15 5L5 15" stroke="#f2f3ea" stroke-width="2.2" /></svg
        >
      </button>
    </div>

    <div class="mt-3 flex flex-col gap-4">
      {#each groups as group (group.id)}
        <div class="flex flex-col gap-1">
          <span class="text-[13px] font-bold">{group.name}</span>
          {#each group.items as item (item.idx)}
            <div class="set-row">
              <span class="set-no tab">{item.set.setNumber}</span>
              <input
                type="number"
                inputmode="decimal"
                min="0"
                class="num tab"
                bind:value={draft.sets[item.idx].weight}
                aria-label="Weight for {group.name} set {item.set.setNumber}"
              />
              <span class="unit">lb</span>
              <input
                type="number"
                inputmode="numeric"
                min="0"
                class="num tab"
                bind:value={draft.sets[item.idx].reps}
                aria-label="Reps for {group.name} set {item.set.setNumber}"
              />
              <span class="unit">reps</span>
              <button
                type="button"
                class="remove-btn"
                onclick={() => draft.sets.splice(item.idx, 1)}
                aria-label="Remove {group.name} set {item.set.setNumber}"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
                  ><path d="M5 5l10 10M15 5L5 15" stroke="#90947f" stroke-width="2" /></svg
                >
              </button>
            </div>
          {/each}
          {#if draft.exerciseNotes}
            <textarea
              class="note-input"
              placeholder="Note for {group.name}…"
              aria-label="Note for {group.name}"
              bind:value={draft.exerciseNotes[group.id]}
            ></textarea>
          {/if}
        </div>
      {/each}

      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-[2px]" style="color: var(--muted2);"
          >Session note</span
        >
        <textarea
          class="note-input"
          placeholder="Anything worth remembering?"
          aria-label="Session note"
          bind:value={draft.note}
        ></textarea>
      </div>

      <div class="flex gap-2">
        <button type="button" class="save-btn display" onclick={save}>Save changes</button>
        <button type="button" class="cancel-btn" onclick={oncancel}>Cancel</button>
      </div>
      <button type="button" class="delete-btn" onclick={removeSession}>Delete session</button>
    </div>
  </div>
</div>

<style>
  .display {
    font-family: 'Archivo Black', 'Arial Black', sans-serif;
    text-transform: uppercase;
  }
  .tab {
    font-variant-numeric: tabular-nums;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(6, 7, 5, 0.82);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 10px;
  }
  @media (min-width: 768px) {
    .overlay {
      align-items: center;
      padding: 24px;
    }
  }
  .sheet {
    width: 100%;
    max-width: 440px;
    max-height: 92dvh;
    overflow-y: auto;
    background: var(--card, #161813);
    border: 1px solid var(--line, #2b2e25);
    padding: 18px 16px 16px;
  }
  .close-btn {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    cursor: pointer;
  }
  .set-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    border-top: 1px solid var(--line2, #23261e);
  }
  .set-no {
    width: 18px;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted2, #6f7361);
  }
  .num {
    width: 72px;
    height: 40px;
    padding: 0 8px;
    text-align: center;
    font-size: 17px;
    font-weight: 700;
    background: var(--card2, #131510);
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    color: var(--text, #f2f3ea);
    font-family: inherit;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .num:focus {
    outline: 2px solid var(--accent, #c8f542);
    outline-offset: -1px;
  }
  .num::-webkit-inner-spin-button,
  .num::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
  .unit {
    font-size: 10px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--muted2, #6f7361);
  }
  .remove-btn {
    margin-left: auto;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    cursor: pointer;
  }
  .note-input {
    width: 100%;
    min-height: 44px;
    margin-top: 4px;
    padding: 8px 10px;
    background: var(--card2, #131510);
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    color: var(--text, #f2f3ea);
    font-size: 12px;
    font-family: inherit;
    line-height: 1.4;
    resize: vertical;
  }
  .note-input:focus {
    outline: 2px solid var(--accent, #c8f542);
    outline-offset: -1px;
  }
  .note-input::placeholder {
    color: var(--muted2, #6f7361);
  }
  .save-btn {
    flex: 1;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent, #c8f542);
    color: var(--on, #0e0f0d);
    border: 0;
    border-radius: 0;
    cursor: pointer;
    font-size: 13px;
    letter-spacing: 2px;
  }
  .cancel-btn {
    height: 52px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--line, #2b2e25);
    border-radius: 0;
    color: var(--text, #f2f3ea);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    font-family: inherit;
  }
  .delete-btn {
    height: 44px;
    background: transparent;
    border: 0;
    color: #ff6a3d;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    font-family: inherit;
  }
</style>
