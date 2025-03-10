import { writable } from 'svelte/store';

type Theme = 'light' | 'dark' | 'auto';

// Initialize from localStorage if available, otherwise default to 'auto'
const getInitialTheme = (): Theme => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved && ['light', 'dark', 'auto'].includes(saved)) {
      return saved;
    }
  }
  return 'auto';
};

// Function to actually apply the theme
function updateTheme(value: Theme) {
  if (typeof window === 'undefined') return;

  const isDark =
    value === 'dark' ||
    (value === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Force remove the opposite class first to ensure clean state
  document.documentElement.classList.remove(isDark ? 'light' : 'dark');
  document.documentElement.classList.add(isDark ? 'dark' : 'light');
}

// Create the theme store
export const theme = writable<Theme>(getInitialTheme());

// Update localStorage and apply theme when the store changes
theme.subscribe((value) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', value);
  updateTheme(value);
});

// Apply theme immediately on initialization
if (typeof window !== 'undefined') {
  updateTheme(getInitialTheme());

  // Listen for system theme changes when in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentTheme = getInitialTheme();
    if (currentTheme === 'auto') {
      updateTheme('auto');
    }
  });
}
