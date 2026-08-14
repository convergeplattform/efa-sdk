import { createExchangeRouter } from '@efa-one/sdk/backend/auth';
import { pool } from '../db';

// Mounts: POST /exchange, POST /logout
// Register in index.ts as: app.use('/api/auth', authRouter)
export default createExchangeRouter(pool);
