import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: 'desktop-chrome',
            testIgnore: /auth\.setup\.ts/,
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: 'mobile-chrome',
            testIgnore: /auth\.setup\.ts/,
            dependencies: ['setup'],
            use: {
                ...devices['Pixel 5'],
                viewport: { width: 390, height: 844 },
            },
        },
    ],
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
            command: 'npm run dev:stable',
            url: 'http://127.0.0.1:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
})
