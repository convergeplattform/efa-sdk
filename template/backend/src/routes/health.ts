import { createHealthRouter } from '@efa-one/sdk/backend/health';
import { pool } from '../db';

// Mounts: GET /, GET /ready
// Register in index.ts as: app.use('/health', healthRouter)
export default createHealthRouter(pool);
