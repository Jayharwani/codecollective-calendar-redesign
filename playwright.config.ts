import { defineConfig, devices } from '@playwright/test';

/**
 * The suite runs against a production build, because that is what the
 * accessibility and performance numbers have to hold for.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Generous, because the suite loads 1,600+ events and a WebGL map on
  // whatever machine it happens to run on.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // The headless shell has no GPU, so MapLibre's WebGL canvas paints
        // nothing. SwiftShader gives it a software renderer.
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build:only && npx vite preview --port 4173 --strictPort',
    // Built against the committed snapshot rather than the live feed. Every
    // page load otherwise re-fetched 2.6 MB from codecollective.us, which made
    // the suite slow, non-deterministic and rude to a third party.
    env: { VITE_DATA_SOURCE: 'snapshot' },
    port: 4173,
    // Always rebuild. Reusing a preview left running by hand silently tests
    // stale output, which cost real debugging time.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
