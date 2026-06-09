/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: {
    react: { version: 'detect' }
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
    ]
  },
  overrides: [
    {
      // The injected Frida agent runs inside the target process under
      // GumJS — not Node, not a browser. Declare the runtime globals it
      // relies on so `no-undef` doesn't fire on Java/Process/rpc/etc.,
      // and disable the React-hooks rules (they false-positive on
      // `Java.use` / our `useClass` helper — this code is not React).
      files: ['src/agent/**/*.ts'],
      env: { browser: false, node: false, es2022: true },
      rules: {
        'react-hooks/rules-of-hooks': 'off',
        'react-hooks/exhaustive-deps': 'off'
      },
      globals: {
        Java: 'readonly',
        ObjC: 'readonly',
        Process: 'readonly',
        Module: 'readonly',
        Memory: 'readonly',
        Interceptor: 'readonly',
        Stalker: 'readonly',
        Thread: 'readonly',
        NativePointer: 'readonly',
        NativeFunction: 'readonly',
        NativeCallback: 'readonly',
        ptr: 'readonly',
        NULL: 'readonly',
        send: 'readonly',
        recv: 'readonly',
        rpc: 'writable',
        hexdump: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly'
      }
    }
  ],
  ignorePatterns: ['dist', 'out', 'node_modules', 'resources']
}
