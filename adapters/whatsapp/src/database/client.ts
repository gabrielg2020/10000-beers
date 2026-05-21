import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prismaClientSingleton = () => {
	return new PrismaClient({
		adapter,
	}).$extends({
		query: {
			async $allOperations({ operation, model, args, query }) {
				const start = Date.now();
				const result = await query(args);
				const duration = Date.now() - start;
				logger.debug({ model, operation, duration }, 'Database query');
				return result;
			},
		},
	});
};

declare global {
	var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prismaGlobal = prisma;
}
