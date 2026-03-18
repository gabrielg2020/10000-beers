import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
	level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
	serializers: {
		error: pino.stdSerializers.err,
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	...(isDevelopment && {
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
