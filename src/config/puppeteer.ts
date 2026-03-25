import { config } from './index';

export function getPuppeteerConfig() {
	const puppeteerConfig: {
		headless: boolean;
		args: string[];
		executablePath?: string;
	} = {
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-accelerated-2d-canvas',
			'--no-first-run',
			'--no-zygote',
			'--disable-gpu',
		],
	};

	if (config.application.puppeteerExecutablePath) {
		puppeteerConfig.executablePath = config.application.puppeteerExecutablePath;
	}

	return puppeteerConfig;
}
