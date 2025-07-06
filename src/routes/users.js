const express = require('express');
const User = require('../models/User');
const { authenticateToken, authorizeRoles, canAccessResource } = require('../utils/auth');
const router = express.Router();

// Get user profile
router.get('/profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user can access this profile
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Accesso negato'
      });
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate('sponsorId', 'firstName lastName email ambassadorCode')
      .populate('downline', 'firstName lastName email role status createdAt');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Utente non trovato'
      });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Impossibile ottenere il profilo'
    });
  }
});

// Update user profile
router.put('/profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Check if user can update this profile
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Accesso negato'
      });
    }

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.status;
    delete updateData.ambassadorCode;
    delete updateData.clientCode;
    delete updateData.sponsorId;
    delete updateData.upline;
    delete updateData.downline;
    delete updateData.level;
    delete updateData.totalEarnings;
    delete updateData.totalPurchases;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Utente non trovato'
      });
    }

    res.json({
      message: 'Profile updated successfully',
      message_it: 'Profilo aggiornato con successo',
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Impossibile aggiornare il profilo'
    });
  }
});

// Change password
router.put('/change-password/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Check if user can change this password
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Accesso negato'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current and new password required',
        message: 'Password attuale e nuova password richieste'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Utente non trovato'
      });
    }

    // Verify current password (unless admin)
    if (req.user.role !== 'admin') {
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Current password is incorrect',
          message: 'Password attuale non corretta'
        });
      }
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully',
      message_it: 'Password cambiata con successo'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: 'Impossibile cambiare la password'
    });
  }
});

// Search users (admin only)
router.get('/search', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { 
      query, 
      role, 
      status, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};

    // Search by name or email
    if (query) {
      filter.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { ambassadorCode: { $regex: query, $options: 'i' } },
        { clientCode: { $regex: query, $options: 'i' } }
      ];
    }

    if (role) filter.role = role;
    if (status) filter.status = status;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sponsorId', 'firstName lastName email');

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      error: 'Failed to search users',
      message: 'Impossibile cercare utenti'
    });
  }
});

// Get user statistics (admin only)
router.get('/stats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalAmbassadors: {
            $sum: { $cond: [{ $eq: ['$role', 'ambassador'] }, 1, 0] }
          },
          totalClients: {
            $sum: { $cond: [{ $eq: ['$role', 'client'] }, 1, 0] }
          },
          activeUsers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          pendingUsers: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalEarnings: { $sum: '$totalEarnings' },
          totalPurchases: { $sum: '$totalPurchases' }
        }
      }
    ]);

    // Get recent registrations
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email role createdAt');

    res.json({
      stats: stats[0] || {
        totalUsers: 0,
        totalAmbassadors: 0,
        totalClients: 0,
        activeUsers: 0,
        pendingUsers: 0,
        totalEarnings: 0,
        totalPurchases: 0
      },
      recentUsers
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: 'Impossibile ottenere le statistiche'
    });
  }
});

// Update user status (admin only)
router.put('/:userId/status', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Stato non valido'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Utente non trovato'
      });
    }

    res.json({
      message: 'User status updated successfully',
      message_it: 'Stato utente aggiornato con successo',
      user
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      error: 'Failed to update status',
      message: 'Impossibile aggiornare lo stato'
    });
  }
});

// Delete user (admin only)
router.delete('/:userId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Utente non trovato'
      });
    }

    // Check if user has downline
    if (user.downline.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete user with downline',
        message: 'Impossibile eliminare un utente con downline'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      message: 'User deleted successfully',
      message_it: 'Utente eliminato con successo'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: 'Impossibile eliminare l\'utente'
    });
  }
});

module.exports = router; 