import obsidianmd from 'eslint-plugin-obsidianmd';
export default [
  { ignores: ['node_modules/**', 'main.js', 'test/main.js', 'dist/**', 'tests/**', 'scripts/**', '*.mjs', '*.mts'] },
  ...obsidianmd.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { parserOptions: { projectService: true } } }
];
