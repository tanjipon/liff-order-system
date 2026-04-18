import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
    testDir: '__tests__/e2e',
    use: {
        baseURL: 'http://localhost:3000'
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true
    }
})