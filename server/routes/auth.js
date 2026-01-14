const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByEmail, getUser, saveUser } = require('../db.js');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, name required' });
    }
    
    // Validate role
    const validRoles = ['admin', 'regulator', 'farmer', 'vessel', 'fisher'];
    const userRole = validRoles.includes(role) ? role : 'farmer'; // Default to farmer
    
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
      role: userRole,
      selectedFacilities: [],
      selectedVessels: [],
      createdAt: new Date().toISOString()
    };
    
    await saveUser(user);
    
    const token = jwt.sign({ 
      userId: user.id, 
      email: user.email,
      role: user.role 
    }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Register failed' });
  }
});

// Demo Login - accepts userId like 'movi', 'aakerblå', 'admin'
router.post('/demo-login', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    // Read user from db
    const db = require('../db').readDB;
    const dbData = await db();
    const user = dbData.users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user data
    res.json({ 
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Login failed' });
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
function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    
    // Allow demo tokens (e.g., "demo-farmer", "demo-brønnbåt")
    if (token.startsWith('demo-')) {
      const role = token.substring(5); // Remove "demo-" prefix
      req.userId = `demo-user-${role}`;
      req.role = role;
      return next();
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
