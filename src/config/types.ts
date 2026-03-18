export interface AppConfig {
  database: DatabaseConfig;
  whatsapp: WhatsAppConfig;
  storage: StorageConfig;
  bot: BotConfig;
  application: ApplicationConfig;
}

export interface DatabaseConfig {
  url: string;
}

export interface WhatsAppConfig {
  groupId: string;
  adminIds: string[];
}

export interface StorageConfig {
  imagePath: string;
  maxImageSizeMB: number;
}

export interface BotConfig {
  submissionCooldownMinutes: number;
  replyOnSubmission: boolean;
}

export interface ApplicationConfig {
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

export class ConfigValidationError extends Error {
	constructor(
		message: string,
		public readonly invalidFields: string[],
	) {
		super(message);
		this.name = 'ConfigValidationError';
	}
}
