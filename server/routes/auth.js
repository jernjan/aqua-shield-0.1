import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail, getUser, saveUser } from '../db.js';
import { v4 as uuidv4 } from 'crypto';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, name required' });
    }
    
    let existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    const userId = 'user_' + Date.now();
    
    const user = {
      id: userId,
      email,
      name,
      phone: phone || '',
      password: hashed,
      selectedFacilities: [],
      selectedVessels: [],
      createdAt: new Date().toISOString()
    };
    
    await saveUser(user);
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Register failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token middleware
export function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export default router;
