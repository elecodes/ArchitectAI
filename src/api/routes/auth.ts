import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { getPool } from '../../db/connection.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('auth');
const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username and password are required' } });
    return;
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE username = $1', [username]);

    if (rows.length === 0) {
      res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Invalid credentials' } });
      return;
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Invalid credentials' } });
      return;
    }

    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '24h' });

    log.info({ userId: user.id }, 'User logged in');
    res.json({ token, expiresIn: '24h' });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Login failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

export { router as authRouter };
