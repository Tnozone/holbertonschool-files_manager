module.exports = {
  env: {
      browser: false,
      es6: true,
      jest: true,
  },
  extends: [
      'airbnb-base',
      'plugin:jest/all',
  ],
  globals: {
      Atomics: 'readonly',
      SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
  },
  plugins: ['jest'],
  rules: {
      'max-classes-per-file': 'off',
      'no-underscore-dangle': 'off',
      'no-console': 'off',
      'no-shadow': 'off',
      'no-restricted-syntax': [
          'error',
          'LabeledStatement',
          'WithStatement',
      ],
      'import/extensions': ['error', 'ignorePackages', {
          js: 'never',
          mjs: 'never',
          jsx: 'never'
      }],
      'import/no-unresolved': 'off',
  },
  settings: {
      'import/resolver': {
          node: {
              extensions: ['.js', '.jsx', '.mjs', '.json']
          }
      }
  },
  overrides: [
      {
          files: ['*.js', '*.mjs'],
          excludedFiles: 'babel.config.js',
      },
  ]
};
