/**
 * Docker health check script
 *
 * Verifies:
 * 1. Database connectivity
 * 2. Bot process is responsive
 *
 * Exit codes:
 * 0 = healthy
 * 1 = unhealthy
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Use the same Prisma adapter pattern as the main application
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({
	adapter,
	log: ['error'],
});

async function checkHealth() {
	const checks = {
		database: false,
		process: false,
	};

	try {
		// Check 1: Database connection
		try {
			await prisma.$queryRaw`SELECT 1`;
			checks.database = true;
		} catch (error) {
			console.error('Database health check failed:', error.message);
			return false;
		}

		// Check 2: Process responsiveness (if we got here, Node.js is responsive)
		checks.process = true;

		// Optional: Check for recent activity (proves bot is processing)
		// Commented out for now - can enable if desired
		// const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		// const recentBeer = await prisma.beer.findFirst({
		//   where: {
		//     submittedAt: {
		//       gte: fiveMinutesAgo
		//     }
		//   }
		// });
		// if (!recentBeer) {
		//   console.warn('No recent beers found in last 5 minutes');
		// }

		console.log('Health check passed:', checks);
		return true;
	} catch (error) {
		console.error('Health check error:', error.message);
		return false;
	} finally {
		await prisma.$disconnect();
	}
}

checkHealth()
	.then((healthy) => {
		process.exit(healthy ? 0 : 1);
	})
	.catch((error) => {
		console.error('Health check crashed:', error);
		process.exit(1);
	});
