import express from 'express';
import { authMiddleware } from './auth.js';
import { getUser, saveUser } from '../db.js';

const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await getUser(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Don't send password hash
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update selected facilities and vessels
router.post('/select-sites', authMiddleware, async (req, res) => {
  try {
    const { facilities, vessels } = req.body;
    const user = await getUser(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.selectedFacilities = facilities || [];
    user.selectedVessels = vessels || [];
    await saveUser(user);
    
    res.json({ message: 'Sites updated', selectedFacilities: user.selectedFacilities, selectedVessels: user.selectedVessels });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update sites' });
  }
});

export default router;
