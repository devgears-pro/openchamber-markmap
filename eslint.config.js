import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(
    [
      'coverage/**',
      'editor/main.js',
      'chat/main.js',
      'node_modules/**',
      'vendor/**',
      'test-results/**',
      'playwright-report/**',
      '.openchamber/**',
      '.worktrees/**',
      'tmp/**',
    ],
    'generated artifacts, dependencies, and the vendored fork',
  ),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      noInlineConfig: true,
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/only-throw-error': ['error', { allowThrowingUnknown: true }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-warning-comments': 'error',
      eqeqeq: 'error',
      'no-param-reassign': 'error',
      'no-else-return': 'error',
      'no-implicit-coercion': 'error',
      'object-shorthand': 'error',
      'prefer-object-spread': 'error',
      'logical-assignment-operators': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'The editor runs in a browser frame. Node APIs belong in scripts, tests, or dev.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'The editor runs in a browser frame.' },
        { name: 'Buffer', message: 'The editor runs in a browser frame.' },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
