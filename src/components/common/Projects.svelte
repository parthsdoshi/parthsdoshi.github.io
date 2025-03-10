<script lang="ts">
  interface Project {
    title: string;
    description: string;
    link?: string;
    github?: string;
    tags: string[];
  }

  const projects: Project[] = [
    {
      title: 'MediaQ',
      description:
        'A easy no-login, no-fuss media queue where users can collaboratively queue and watch media together.',
      github: 'https://github.com/parthsdoshi/MediaQ',
      tags: ['Python', 'Flask', 'React', 'Redux', 'Web Development'],
    },
    {
      title: 'Fabel',
      description:
        'Automatically label and organize downloaded files using machine learning. Features a Flask backend serving an embedding model (BERT), a desktop app built with Electron and React, and a Chrome extension for download tracking.',
      github: 'https://github.com/parthsdoshi/fabel',
      tags: ['Python', 'Flask', 'React', 'TensorFlow', 'BERT', 'Chrome Extension', 'Electron'],
    },
    {
      title: 'Personal Website',
      description:
        'My personal website built with modern web technologies. Features server-side rendering, static site generation, and responsive design.',
      github: 'https://github.com/parthsdoshi/parthsdoshi.github.io',
      link: 'https://parthdoshi.com',
      tags: ['Astro', 'Svelte', 'TypeScript', 'Tailwind CSS', 'MDX'],
    },
    {
      title: 'Pawse',
      description: 'Pawse your laptop when your kitty gets its paws on it',
      github: 'https://github.com/parthsdoshi/pawse',
      tags: ['Python'],
    },
  ];
</script>

<section id="projects" class="py-8">
  <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Projects</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl mx-auto px-4">
    {#each projects as project (project.title)}
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      >
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
          {project.title}
        </h3>
        <p class="mt-2 text-gray-600 dark:text-gray-300">
          {project.description}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          {#each project.tags as tag (tag)}
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {tag}
            </span>
          {/each}
        </div>
        <div class="mt-4 flex gap-4">
          {#if project.github}
            <a
              href={project.github}
              class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub →
            </a>
          {/if}
          {#if project.link}
            <a
              href={project.link}
              class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit →
            </a>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>
