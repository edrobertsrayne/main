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
	testMatch: '**/*.e2e.{ts,js}'
});
