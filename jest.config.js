/** @type {import('jest').Config} */
export default {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/tests'],
	testMatch: ['**/*.test.ts'],
	moduleFileExtensions: ['ts', 'js'],
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70,
		},
	},
	transformIgnorePatterns: ['node_modules/(?!(chalk)/)'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^chalk$': '<rootDir>/tests/__mocks__/chalk.ts',
	},
	setupFiles: ['<rootDir>/tests/setup.ts'],
	globalTeardown: '<rootDir>/tests/teardown.ts',
	forceExit: true,
	maxWorkers: 1,
};
