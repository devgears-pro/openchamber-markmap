import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'editor/main.js',
      'eslint.config.js',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      '.openchamber/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-warning-comments': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression',
          message: 'Use a type guard or a typed helper instead of a type assertion.',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'dev/**/*.ts', 'scripts/**/*.ts', '*.config.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
);
