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
    // RTL readiness: the web UI uses logical Tailwind classes so a right-to-left language can be
    // added by flipping `dir`. Use ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/
    // border-e/rounded-s/rounded-e instead of the physical ml-/mr-/pl-/pr-/left-/right-/
    // text-left/text-right/border-l/border-r/rounded-l/rounded-r.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/(^|[\\s:!])-?(((m|p)(l|r)|left|right|scroll-(m|p)(l|r))-|(rounded|border)-(l|r|tl|tr|bl|br)(-|\\s|$)|(float|text)-(left|right)(\\s|$))/]',
          message:
            'Use logical Tailwind classes (ms-, me-, ps-, pe-, start-, end-, text-start, text-end, border-s, border-e, rounded-s, rounded-e) so the UI works in RTL.',
        },
        {
          selector:
            'TemplateElement[value.raw=/(^|[\\s:!])-?(((m|p)(l|r)|left|right|scroll-(m|p)(l|r))-|(rounded|border)-(l|r|tl|tr|bl|br)(-|\\s|$)|(float|text)-(left|right)(\\s|$))/]',
          message:
            'Use logical Tailwind classes (ms-, me-, ps-, pe-, start-, end-, text-start, text-end, border-s, border-e, rounded-s, rounded-e) so the UI works in RTL.',
        },
      ],
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
