import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { generateTokens, verifyRefreshToken, authenticateToken, AuthRequest } from '../middleware/auth.js';
import { UserRepository } from '../repositories/UserRepository.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);
    const userRepo = new UserRepository();

    const existing = userRepo.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    userRepo.create(id, email, passwordHash, name);

    const tokens = generateTokens(id);
    res.status(201).json({ user: { id, email, name }, ...tokens });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const userRepo = new UserRepository();

    const user = userRepo.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const tokens = generateTokens(user.id);
    res.json({ user: { id: user.id, email: user.email, name: user.name }, ...tokens });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

authRouter.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(403).json({ error: 'Invalid refresh token' });
    return;
  }

  const tokens = generateTokens(payload.userId);
  res.json(tokens);
});

authRouter.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const userRepo = new UserRepository();
  const user = userRepo.findById(req.userId!);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});
