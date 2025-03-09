import { includeIgnoreFile } from '@eslint/compat';
import tseslint from 'typescript-eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import astroPlugin from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  ...tseslint.configs.recommended,
  ...astroPlugin.configs.recommended,
  sveltePlugin.configs.recommended,
  prettier,
  // {
  //   languageOptions: {
  //     parser: tseslint.parser,
  //     parserOptions: {
  //       project: './tsconfig.json',
  //       extraFileExtensions: ['.svelte', '.astro'],
  //     },
  //   },
  //   rules: {
  //     // Add any custom rules here
  //   },
  // },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: sveltePlugin.parser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  }
);
