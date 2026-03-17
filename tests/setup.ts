import { config } from 'dotenv';

config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
