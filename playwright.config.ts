import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: {
			DATABASE_URL: 'local.db',
			ENABLE_TEST_RESET: 'true'
		}
	},
	testMatch: '**/*.e2e.{ts,js}',
	// All tests share `local.db`. Run serially so concurrent runs don't
	// trash each other's state (we reset the DB via /__test__/reset in
	// beforeEach, but two workers can race on that endpoint).
	workers: 1
});
