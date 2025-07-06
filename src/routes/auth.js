const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateToken, authenticateToken } = require('../utils/auth');
const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      phone, 
      role = 'client',
      sponsorCode 
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Campi obbligatori mancanti'
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'Utente già esistente'
      });
    }

    // Find sponsor if code provided
    let sponsor = null;
    if (sponsorCode) {
      sponsor = await User.findByCode(sponsorCode);
      if (!sponsor) {
        return res.status(400).json({
          error: 'Invalid sponsor code',
          message: 'Codice sponsor non valido'
        });
      }
    }

    // Create new user
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phone,
      role
    };

    if (sponsor) {
      userData.sponsorId = sponsor._id;
      userData.level = sponsor.level + 1;
    }

    const user = new User(userData);
    await user.save();

    // Update sponsor's downline if exists
    if (sponsor) {
      sponsor.downline.push(user._id);
      await sponsor.save();

      // Build upline chain
      let currentSponsor = sponsor;
      const upline = [];
      while (currentSponsor.sponsorId) {
        upline.push(currentSponsor.sponsorId);
        currentSponsor = await User.findById(currentSponsor.sponsorId);
        if (!currentSponsor) break;
      }
      user.upline = upline;
      await user.save();
    }

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        ambassadorCode: user.ambassadorCode,
        clientCode: user.clientCode
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Registrazione fallita'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required',
        message: 'Email e password richieste'
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Credenziali non valide'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Credenziali non valide'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account not active',
        message: 'Account non attivo'
      });
    }

    // Generate token
    const tokenExpiry = rememberMe ? '30d' : '7d';
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: tokenExpiry }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        ambassadorCode: user.ambassadorCode,
        clientCode: user.clientCode,
        language: user.language
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Accesso fallito'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('sponsorId', 'firstName lastName email ambassadorCode')
      .populate('downline', 'firstName lastName email role status');

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        ambassadorCode: user.ambassadorCode,
        clientCode: user.clientCode,
        sponsor: user.sponsorId,
        downline: user.downline,
        level: user.level,
        totalEarnings: user.totalEarnings,
        totalPurchases: user.totalPurchases,
        language: user.language,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user data',
      message: 'Impossibile ottenere i dati utente'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      message: 'Logout successful',
      message_it: 'Logout effettuato con successo'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Logout fallito'
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Email richiesta'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If the email exists, a reset link has been sent',
        message_it: 'Se l\'email esiste, è stato inviato un link di reset'
      });
    }

    // Generate reset token (in a real app, you'd send this via email)
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password-reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    // For now, just return the token (in production, send via email)
    res.json({
      message: 'Password reset link sent',
      message_it: 'Link di reset password inviato',
      resetToken // Remove this in production
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Failed to process request',
      message: 'Impossibile elaborare la richiesta'
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Token and new password required',
        message: 'Token e nuova password richiesti'
      });
    }

    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.type !== 'password-reset') {
      return res.status(400).json({
        error: 'Invalid token type',
        message: 'Tipo di token non valido'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Token non valido'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password reset successful',
      message_it: 'Reset password completato con successo'
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'Token non valido o scaduto'
      });
    }
    
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      message: 'Impossibile resettare la password'
    });
  }
});

module.exports = router; 