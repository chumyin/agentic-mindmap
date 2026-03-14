import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { createMindmapApiVitePlugin } from './src/runtime/dev-server'

export default defineConfig({
  plugins: [react(), createMindmapApiVitePlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
