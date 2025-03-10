<script lang="ts">
  import ThemeToggle from './ThemeToggle.svelte';

  const links = [
    { href: '/', text: 'Home' },
    { href: '/blog', text: 'Blog' },
    { href: '/#projects', text: 'Projects' },
    { href: 'https://parthsdoshi.github.io/resume/out/resume.pdf', text: 'Resume', external: true },
  ];
</script>

<nav
  class="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur z-50 border-b border-gray-200 dark:border-gray-700"
>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex items-center">
        <a href="/" class="text-xl font-bold text-gray-900 dark:text-white"> Parth Doshi </a>
      </div>
      <div class="flex items-center gap-8">
        <div class="hidden sm:flex sm:items-center">
          {#each links as { href, text, external } (href)}
            <a
              {href}
              class="ml-8 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              {...external ? { target: '_blank', rel: 'noopener noreferrer' } : {}}
            >
              {text}
            </a>
          {/each}
        </div>
        <ThemeToggle />
      </div>
    </div>
  </div>
</nav>
