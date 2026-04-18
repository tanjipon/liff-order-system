import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
        exclude: ['__tests__/e2e/**'],
        setupFiles: ['__tests__/integration/setup.ts'],
        fileParallelism: false,
    }
})