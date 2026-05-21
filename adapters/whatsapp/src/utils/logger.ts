import pino from 'pino';
import { config } from '../config';

export const logger = pino({
	level: config.application.logLevel,
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
	serializers: {
		error: pino.stdSerializers.err,
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	...(config.application.isDevelopment && {
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'HH:MM:ss',
				ignore: 'pid,hostname',
			},
		},
	}),
});

export function redactWhatsAppId(whatsappId: string | undefined | null): string {
	if (!whatsappId) return 'unknown';
	const atIndex = whatsappId.indexOf('@');
	if (atIndex < 6) return '***';
	const prefix = whatsappId.slice(0, 3);
	const suffix = whatsappId.slice(atIndex - 3, atIndex);
	const domain = whatsappId.slice(atIndex);
	return `${prefix}***${suffix}${domain}`;
}

export type Logger = typeof logger;
