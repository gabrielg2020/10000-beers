import type {
	AiConfig,
	AppConfig,
	ApplicationConfig,
	BotConfig,
	DatabaseConfig,
	StorageConfig,
	WhatsAppConfig,
} from './types';
import { ConfigValidationError } from './types';

function getRequiredEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
	return process.env[key] || defaultValue;
}

function validateWhatsAppId(id: string, type: 'group' | 'user'): boolean {
	if (type === 'group') {
		return /^[0-9]+@(g\.us|lid)$/.test(id);
	}
	return id.endsWith('@c.us') || id.endsWith('@lid');
}

function validateDatabaseUrl(url: string): void {
	if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
		throw new ConfigValidationError(
			'DATABASE_URL must start with postgresql:// or postgres://',
			['DATABASE_URL'],
		);
	}
}

function validatePositiveInteger(value: number, fieldName: string): void {
	if (!Number.isInteger(value) || value < 0) {
		throw new ConfigValidationError(
			`${fieldName} must be a non-negative integer, got: ${value}`,
			[fieldName],
		);
	}
}

function validateConfidenceThreshold(threshold: number): void {
	if (threshold < 0 || threshold > 1) {
		throw new ConfigValidationError(
			`AI_CONFIDENCE_THRESHOLD must be between 0 and 1, got: ${threshold}`,
			['AI_CONFIDENCE_THRESHOLD'],
		);
	}
}

function parseAdminIds(adminIdsString: string): string[] {
	if (!adminIdsString.trim()) {
		return [];
	}

	const ids = adminIdsString
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);

	const invalidIds = ids.filter((id) => !validateWhatsAppId(id, 'user'));

	if (invalidIds.length > 0) {
		throw new ConfigValidationError(
			`Invalid admin IDs (must end with @c.us or @lid): ${invalidIds.join(', ')}`,
			invalidIds,
		);
	}

	return ids;
}

function validateConfig(): void {
	const missingVars: string[] = [];

	const requiredVars = ['DATABASE_URL', 'WHATSAPP_GROUP_ID'];

	for (const varName of requiredVars) {
		if (!process.env[varName]) {
			missingVars.push(varName);
		}
	}

	if (missingVars.length > 0) {
		throw new ConfigValidationError(
			`Missing required environment variables: ${missingVars.join(', ')}`,
			missingVars,
		);
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (databaseUrl) {
		validateDatabaseUrl(databaseUrl);
	}

	const groupId = process.env.WHATSAPP_GROUP_ID;
	if (groupId && !validateWhatsAppId(groupId, 'group')) {
		throw new ConfigValidationError(
			`WHATSAPP_GROUP_ID must match format: 1234567890@g.us or 1234567890@lid, got: ${groupId}`,
			['WHATSAPP_GROUP_ID'],
		);
	}
}

function loadApplicationConfig(): ApplicationConfig {
	const nodeEnv = getOptionalEnv('NODE_ENV', 'development');

	const validEnvs = ['development', 'production', 'test'];
	if (!validEnvs.includes(nodeEnv)) {
		throw new ConfigValidationError(
			`NODE_ENV must be one of: ${validEnvs.join(', ')}, got: ${nodeEnv}`,
			['NODE_ENV'],
		);
	}

	const logLevel = getOptionalEnv(
		'LOG_LEVEL',
		nodeEnv === 'development' ? 'debug' : 'info',
	);
	const validLogLevels = ['debug', 'info', 'warn', 'error'];
	if (!validLogLevels.includes(logLevel)) {
		throw new ConfigValidationError(
			`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}, got: ${logLevel}`,
			['LOG_LEVEL'],
		);
	}

	const isDevelopment = nodeEnv === 'development';
	const isProduction = nodeEnv === 'production';
	const isTest = nodeEnv === 'test';

	const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

	const startupWaitSeconds = Number.parseInt(
		getOptionalEnv('STARTUP_WAIT', '0'),
		10,
	);

	validatePositiveInteger(startupWaitSeconds, 'STARTUP_WAIT');

	return {
		nodeEnv: nodeEnv as ApplicationConfig['nodeEnv'],
		logLevel: logLevel as ApplicationConfig['logLevel'],
		isDevelopment,
		isProduction,
		isTest,
		puppeteerExecutablePath,
		startupWaitSeconds,
	};
}

function loadDatabaseConfig(): DatabaseConfig {
	return {
		url: getRequiredEnv('DATABASE_URL'),
	};
}

function loadWhatsAppConfig(): WhatsAppConfig {
	const adminIdsRaw = getOptionalEnv('ADMIN_IDS', '');

	return {
		groupId: getRequiredEnv('WHATSAPP_GROUP_ID'),
		adminIds: parseAdminIds(adminIdsRaw),
	};
}

function loadStorageConfig(): StorageConfig {
	const maxImageSizeMB = Number.parseInt(
		getOptionalEnv('MAX_IMAGE_SIZE_MB', '10'),
		10,
	);

	validatePositiveInteger(maxImageSizeMB, 'MAX_IMAGE_SIZE_MB');

	return {
		imagePath: getOptionalEnv('IMAGE_STORAGE_PATH', '/data/images'),
		maxImageSizeMB,
	};
}

function loadBotConfig(): BotConfig {
	const cooldownMinutes = Number.parseInt(
		getOptionalEnv('SUBMISSION_COOLDOWN_MINUTES', '0'),
		10,
	);

	validatePositiveInteger(cooldownMinutes, 'SUBMISSION_COOLDOWN_MINUTES');

	const replyOnSubmission =
		getOptionalEnv('REPLY_ON_SUBMISSION', 'true') === 'true';

	return {
		submissionCooldownMinutes: cooldownMinutes,
		replyOnSubmission,
	};
}

function loadAiConfig(): AiConfig {
	const enabled = getOptionalEnv('AI_ENABLED', 'false') === 'true';

	const confidenceThreshold = Number.parseFloat(
		getOptionalEnv('AI_CONFIDENCE_THRESHOLD', '0.9'),
	);

	validateConfidenceThreshold(confidenceThreshold);

	// Only require API key if AI is enabled
	const geminiApiKey = enabled
		? getRequiredEnv('GEMINI_API_KEY')
		: getOptionalEnv('GEMINI_API_KEY', '');

	const geminiModel = getOptionalEnv('GEMINI_MODEL', 'gemini-1.5-flash');

	return {
		enabled,
		confidenceThreshold,
		geminiApiKey,
		geminiModel,
	};
}

function loadConfig(): AppConfig {
	validateConfig();

	return {
		application: loadApplicationConfig(),
		database: loadDatabaseConfig(),
		whatsapp: loadWhatsAppConfig(),
		storage: loadStorageConfig(),
		bot: loadBotConfig(),
    ai: loadAiConfig(),
	};
}

export const config = loadConfig();

export type {
	AppConfig,
	ApplicationConfig,
	BotConfig,
	DatabaseConfig,
	StorageConfig,
	WhatsAppConfig,
  AiConfig,
} from './types';
export { ConfigValidationError } from './types';
