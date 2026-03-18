import { config } from 'dotenv';

config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.WHATSAPP_GROUP_ID = '123456789@g.us';
process.env.AI_ENABLED = 'false';
process.env.AI_CONFIDENCE_THRESHOLD = '0.9';
process.env.GEMINI_MODEL = 'gemini-1.5-flash';
