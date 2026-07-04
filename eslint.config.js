// @ts-check
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * ESLint 9 flat config — covers three separate module systems:
 *  - backend/  → CommonJS (Node.js)
 *  - frontend/ → ESM (browser / Vite / React)
 *  - bot/      → CommonJS (Node.js)
 */

/** Shared rules that apply everywhere. */
const sharedRules = {
  // Possible errors
  'no-console': 'off', // fine for Node services; frontend may override
  'no-debugger': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',

  // Best practices
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
  'object-shorthand': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  curly: ['error', 'all'],

  // Style (handled by Prettier for formatting, ESLint for semantics)
  'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
  'spaced-comment': ['error', 'always', { markers: ['/'] }]
};

export default [
  // ─── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/coverage/**',
      '**/*.min.js'
    ]
  },

  // ─── Backend — CommonJS, Node 20 ────────────────────────────────────────────
  {
    files: ['backend/**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      ...sharedRules
    }
  },

  // ─── Bot — CommonJS, Node 20 ────────────────────────────────────────────────
  {
    files: ['bot/**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      ...sharedRules
    }
  },

  // ─── Frontend — ESM, browser + React ────────────────────────────────────────
  {
    files: ['frontend/**/*.{js,jsx,mjs}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...sharedRules,
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Override: JSX component names (PascalCase), framer-motion primitives
      // (motion, AnimatePresence), and React itself are "used" via JSX syntax
      // which the base rule cannot detect without a JSX-aware parser plugin.
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^(_|[A-Z]|motion$|AnimatePresence$|React$)'
        }
      ],

      // React
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform
      'react/prop-types': 'off', // project uses JSDoc, not PropTypes
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-unknown-property': 'error',
      'react/display-name': 'warn',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },

  // ─── Config files at root — CommonJS / Node ─────────────────────────────────
  {
    files: ['*.{js,cjs,mjs}', '*.config.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      ...sharedRules
    }
  }
];
