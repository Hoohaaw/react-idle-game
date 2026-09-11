import { fileURLToPath, URL } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // .claude/worktrees and .worktrees/ both hold full nested copies of this repo (isolated
    // agent/SDD-task worktrees) — without this, Vitest picks up their test files too and
    // silently double-runs the suite.
    exclude: [...configDefaults.exclude, '.claude/**', '.worktrees/**'],
  },
})
