import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
      'packages/db/src/generated/**',
      'scripts/zip.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    // Plain JS files are tooling (helper scripts, config); services are TypeScript. They run in
    // Node, so `process`, `require` and `console` exist and printing is fine.
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Scripts and config files may print to the console.
    files: ['**/*.config.{js,mjs,ts}', '**/scripts/**'],
    rules: { 'no-console': 'off' },
  },
  prettier,
)
