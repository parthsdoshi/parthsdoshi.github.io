<script lang="ts">
  interface WorkEntry {
    company: string;
    logo: string;
    url: string;
    padding?: string;
    size?: string;
    invertInDarkMode?: boolean;
  }

  const experiences: WorkEntry[] = [
    {
      company: 'Fathom Health',
      logo: '/images/companies/fathom.svg',
      url: 'https://www.fathomhealth.com',
      padding: 'pt-4',
      size: 'w-40 h-40',
      invertInDarkMode: false,
    },
    {
      company: 'Microsoft',
      logo: '/images/companies/microsoft.svg',
      url: 'https://microsoft.com',
      padding: 'pt-2',
      size: 'w-40 h-40',
      invertInDarkMode: false,
    },
    {
      company: 'Cisco',
      logo: '/images/companies/cisco.svg',
      url: 'https://cisco.com',
      size: 'w-32 h-32',
      invertInDarkMode: true,
    },
    {
      company: 'Viptela',
      logo: '/images/companies/viptela.png',
      url: 'https://www.cisco.com/c/en/us/services/acquisitions/viptela.html',
      size: 'w-40 h-40',
      invertInDarkMode: true,
    },
    {
      company: 'Purdue',
      logo: '/images/companies/purdue.svg',
      url: 'https://www.cs.purdue.edu',
      padding: 'pt-3',
      size: 'w-40 h-40',
      invertInDarkMode: true,
    },
  ];
</script>

<section class="py-8">
  <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Work Experience</h2>
  <div class="flex flex-wrap justify-center items-center gap-8 w-full max-w-7xl mx-auto px-4">
    {#each experiences as exp (exp.company)}
      <a
        href={exp.url}
        target="_blank"
        rel="noopener noreferrer"
        class="block {exp.size} p-4 transition-transform hover:scale-110 {exp.padding || ''}"
      >
        <img
          src={exp.logo}
          alt={`${exp.company} logo`}
          width="160"
          height="160"
          loading="eager"
          decoding="async"
          class="w-full h-full object-contain {exp.invertInDarkMode
            ? 'dark:invert dark:brightness-200'
            : ''}"
        />
      </a>
    {/each}
  </div>
</section>
