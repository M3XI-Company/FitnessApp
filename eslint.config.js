// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // 3D trainer: React Three Fiber JSX uses three.js props (position, args, rotation…) the DOM rule
    // doesn't know, and the scene graph / gesture handlers are driven imperatively through refs in
    // useFrame and touch callbacks — never during render — which the React Compiler rules can't see.
    files: ['src/components/trainer/**/*.tsx'],
    rules: { 'react/no-unknown-property': 'off', 'react-hooks/refs': 'off', 'react-hooks/immutability': 'off' },
  },
]);
