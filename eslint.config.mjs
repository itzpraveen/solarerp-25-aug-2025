// ESLint flat config for ESLint v9+
// Uses Next.js recommended rules and project-specific overrides.
// Ensure modern module resolution for shared configs/plugins
import next from 'eslint-config-next';

export default [
  ...next,
  {
    rules: {
      // Allow <img> and legacy links where practical
      '@next/next/no-img-element': 'off',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
