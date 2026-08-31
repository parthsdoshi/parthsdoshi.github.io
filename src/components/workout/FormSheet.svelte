<script lang="ts">
  import type { Exercise } from './plan';
  import { FORM_GUIDES, FORM_IMG_BASE } from './form';

  interface Props {
    exercise: Exercise;
    onclose: () => void;
  }

  let { exercise, onclose }: Props = $props();

  const guide = $derived(FORM_GUIDES[exercise.id]);
  let hiddenImages = $state<Record<string, boolean>>({});

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label="Form guide: {exercise.name}">
  <div class="sheet">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-[2px]" style="color: var(--accent);"
          >Form</span
        >
        <h2 class="display m-0 text-2xl leading-none">{exercise.name}</h2>
      </div>
      <button type="button" class="close-btn" onclick={onclose} aria-label="Close form guide">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"
          ><path d="M5 5l10 10M15 5L5 15" stroke="#f2f3ea" stroke-width="2.2" /></svg
        >
      </button>
    </div>

    {#if exercise.note}
      <p class="m-0 mt-2 text-xs" style="color: #ff6a3d;">{exercise.note}</p>
    {/if}

    {#if guide}
      <div class="mt-3 grid grid-cols-2 gap-2">
        {#each guide.images as img (img)}
          {#if !hiddenImages[img]}
            <img
              src="{FORM_IMG_BASE}{img}"
              alt="{exercise.name} demonstration"
              loading="lazy"
              class="w-full border"
              style="border-color: var(--line); background: #fff;"
              onerror={() => (hiddenImages[img] = true)}
            />
          {/if}
        {/each}
      </div>
      <ol class="steps m-0 mt-3 flex flex-col gap-2 p-0">
        {#each guide.steps as s, i (i)}
          <li class="flex gap-2.5 text-[13px] leading-snug" style="color: #c9ccbb;">
            <span
              class="tab shrink-0 text-[11px] font-bold"
              style="color: var(--muted2); width: 16px;">{i + 1}</span
            >
            {s}
          </li>
        {/each}
      </ol>
      <p class="m-0 mt-3 text-[10px]" style="color: var(--muted2);">
        Guide: “{guide.source}” — Free Exercise DB (public domain)
      </p>
    {:else}
      <p class="m-0 mt-3 text-sm" style="color: var(--muted);">No guide for this one yet.</p>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(6, 7, 5, 0.82);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 16px;
  }
  @media (min-width: 768px) {
    .overlay {
      align-items: center;
    }
  }
  .sheet {
    width: 100%;
    max-width: 420px;
    max-height: 85vh;
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
  .steps {
    list-style: none;
  }
</style>
