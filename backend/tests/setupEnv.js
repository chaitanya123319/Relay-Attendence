/**
 * Runs before every test file (before modules load): pins the test environment
 * so config/env picks up safe values regardless of the developer's local .env.
 */
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef0123456789abcdef';
process.env.STORAGE_DIR = path.resolve(__dirname, '..', '.test-storage');
process.env.COMPANY_TZ = 'Asia/Kolkata';
process.env.ACCESS_TOKEN_TTL_MIN = '15';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
