const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: ['dist/**', '.webpack/**', 'out/**', 'figma-plugin/**', 'test-slides/**', 'resources/**'],
  },
  ...compat.config(require('./.eslintrc.json')).map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
];
