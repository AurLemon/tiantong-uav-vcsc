import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginImport from 'eslint-plugin-import-x'
import hooksPlugin from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      'public',
      'vite.config.ts',
      'jest.config.ts',
      'src/service-worker.js',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        page: 'readonly',
        REACT_APP_ENV: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react: pluginReact,
      'import-x': pluginImport,
      'react-hooks': hooksPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: {
          extensions: ['.js', '.ts', '.tsx', '.json'],
        },
        alias: {
          map: [['@', './src']],
          extensions: ['.js', '.ts', '.tsx', '.json'],
        },
      },

      react: {
        version: 'detect',
      },
    },
    rules: {
      ...pluginImport.configs.recommended.rules,
      ...pluginImport.configs.typescript.rules,
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': 'off',
      'no-self-assign': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'import-x/no-unresolved': 'off',
      'import-x/named': 'off',
      'import-x/default': 'off',
      'import-x/namespace': 'off',
      'import-x/no-absolute-path': 'error',
      'import-x/no-dynamic-require': 'warn',
      'import-x/no-webpack-loader-syntax': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-cycle': 'warn',
      'import-x/no-useless-path-segments': 'warn',
      'import-x/no-relative-parent-imports': 'off',
      'import-x/first': 'error',
      'import-x/no-duplicates': 'off',
      'import-x/extensions': [
        'off',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      indent: 'off',
      semi: ['warn', 'never'],
      quotes: 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  eslintConfigPrettier
)
