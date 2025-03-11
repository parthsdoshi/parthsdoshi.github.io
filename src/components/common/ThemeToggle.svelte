<script lang="ts">
  import { theme } from '../../stores/theme';

  const themes = [
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
    { value: 'auto', icon: '💻', label: 'System' },
  ] as const;

  let isOpen = false;
  let closeTimeout: ReturnType<typeof setTimeout>;
  let selectedIndex = 0;
  let focusedIndex = selectedIndex;
  let isKeyboardNavigation = false;

  function handleMouseEnter() {
    clearTimeout(closeTimeout);
    isOpen = true;
  }

  function handleMouseLeave() {
    // Add a small delay before closing to make it easier to move cursor to menu
    closeTimeout = setTimeout(() => {
      isOpen = false;
    }, 150);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      isOpen = true;
      focusedIndex = selectedIndex;
      isKeyboardNavigation = true;
      return;
    }

    if (isOpen) {
      isKeyboardNavigation = true;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusedIndex = (focusedIndex + 1) % themes.length;
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusedIndex = (focusedIndex - 1 + themes.length) % themes.length;
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          theme.set(themes[focusedIndex].value);
          isOpen = false;
          break;
        case 'Escape':
          event.preventDefault();
          isOpen = false;
          break;
      }
    }
  }

  function handleMouseMove() {
    isKeyboardNavigation = false;
  }

  // Update selectedIndex when theme changes
  $: selectedIndex = themes.findIndex((t) => t.value === $theme);
</script>

<div
  class="relative inline-block"
  role="menubar"
  tabindex="0"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:focusin={() => (isOpen = true)}
  on:focusout={() => (isOpen = false)}
  on:keydown={handleKeydown}
  on:mousemove={handleMouseMove}
>
  <button
    type="button"
    class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
    aria-label="Toggle theme menu"
    aria-expanded={isOpen}
    aria-controls="theme-menu"
    aria-haspopup="true"
  >
    {#if $theme === 'light'}
      ☀️
    {:else if $theme === 'dark'}
      🌙
    {:else}
      💻
    {/if}
  </button>
  <div
    id="theme-menu"
    class="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-opacity duration-150 {isOpen
      ? 'opacity-100 visible'
      : 'opacity-0 invisible pointer-events-none'}"
    role="menu"
    tabindex="-1"
    aria-orientation="vertical"
    aria-labelledby="theme-menu-button"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
  >
    {#each themes as { value, icon, label }, i (value)}
      <button
        class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg
          {$theme === value ? 'bg-gray-100 dark:bg-gray-700' : ''}
          {focusedIndex === i && isKeyboardNavigation
          ? 'ring-2 ring-blue-500 dark:ring-blue-400 z-10'
          : ''}"
        on:click={() => {
          theme.set(value);
          isOpen = false;
        }}
        on:mouseover={() => {
          focusedIndex = i;
          isKeyboardNavigation = false;
        }}
        on:focus={() => {
          focusedIndex = i;
          isKeyboardNavigation = true;
        }}
        role="menuitemradio"
        tabindex="-1"
        aria-checked={selectedIndex === i}
      >
        <span class="mr-2" aria-hidden="true">{icon}</span>
        {label}
      </button>
    {/each}
  </div>
</div>
