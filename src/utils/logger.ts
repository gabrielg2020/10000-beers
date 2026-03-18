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

export type Logger = typeof logger;
