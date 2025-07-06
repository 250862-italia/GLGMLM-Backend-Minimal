const express = require('express');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../utils/auth');
const router = express.Router();

// Get ambassador's downline
router.get('/downline', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, role } = req.query;
    const skip = (page - 1) * limit;

    const filter = { sponsorId: req.user._id };
    if (status) filter.status = status;
    if (role) filter.role = role;

    const downline = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      downline,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get downline error:', error);
    res.status(500).json({
      error: 'Failed to get downline',
      message: 'Impossibile ottenere il downline'
    });
  }
});

// Get ambassador's earnings
router.get('/earnings', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Get earnings by period (simplified calculation)
    const earnings = await User.aggregate([
      { $match: { sponsorId: req.user._id } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$totalEarnings' },
          totalPurchases: { $sum: '$totalPurchases' },
          memberCount: { $sum: 1 }
        }
      }
    ]);

    // Calculate commission (simplified)
    const commissionRate = req.user.commissionRate || 0.05;
    const totalCommission = (earnings[0]?.totalPurchases || 0) * commissionRate;

    // Get earnings by level
    const earningsByLevel = await User.aggregate([
      { $match: { upline: req.user._id } },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$totalEarnings' },
          totalPurchases: { $sum: '$totalPurchases' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get monthly earnings (simplified)
    const monthlyEarnings = [
      { month: 'Gen', earnings: Math.floor(Math.random() * 1000), commission: Math.floor(Math.random() * 100) },
      { month: 'Feb', earnings: Math.floor(Math.random() * 1000), commission: Math.floor(Math.random() * 100) },
      { month: 'Mar', earnings: Math.floor(Math.random() * 1000), commission: Math.floor(Math.random() * 100) },
      { month: 'Apr', earnings: Math.floor(Math.random() * 1000), commission: Math.floor(Math.random() * 100) },
      { month: 'Mag', earnings: Math.floor(Math.random() * 1000), commission: Math.floor(Math.random() * 100) },
      { month: 'Giu', earnings: Math.floor(Math.random() * 1000), commission: Math.floor(Math.random() * 100) }
    ];

    res.json({
      summary: {
        totalEarnings: earnings[0]?.totalEarnings || 0,
        totalCommission: totalCommission,
        memberCount: earnings[0]?.memberCount || 0,
        commissionRate: (commissionRate * 100).toFixed(1) + '%'
      },
      earningsByLevel,
      monthlyEarnings
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      error: 'Failed to get earnings',
      message: 'Impossibile ottenere i guadagni'
    });
  }
});

// Get ambassador's network tree
router.get('/network', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    const { levels = 3 } = req.query;

    // Get direct downline
    const directDownline = await User.find({ sponsorId: req.user._id })
      .select('firstName lastName email role status createdAt level')
      .sort({ createdAt: -1 });

    // Build network tree
    const buildNetworkTree = async (userId, currentLevel = 0, maxLevel = parseInt(levels)) => {
      if (currentLevel >= maxLevel) return [];

      const downline = await User.find({ sponsorId: userId })
        .select('firstName lastName email role status createdAt level')
        .sort({ createdAt: -1 });

      const tree = [];
      for (const member of downline) {
        const memberNode = {
          id: member._id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          role: member.role,
          status: member.status,
          level: member.level,
          createdAt: member.createdAt,
          children: await buildNetworkTree(member._id, currentLevel + 1, maxLevel)
        };
        tree.push(memberNode);
      }

      return tree;
    };

    const networkTree = await buildNetworkTree(req.user._id);

    res.json({
      ambassador: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        level: req.user.level
      },
      network: networkTree
    });

  } catch (error) {
    console.error('Get network error:', error);
    res.status(500).json({
      error: 'Failed to get network',
      message: 'Impossibile ottenere la rete'
    });
  }
});

// Get ambassador's statistics
router.get('/stats', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    // Get basic stats
    const basicStats = await User.aggregate([
      { $match: { sponsorId: req.user._id } },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          activeMembers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalAmbassadors: { $sum: { $cond: [{ $eq: ['$role', 'ambassador'] }, 1, 0] } },
          totalClients: { $sum: { $cond: [{ $eq: ['$role', 'client'] }, 1, 0] } },
          totalEarnings: { $sum: '$totalEarnings' },
          totalPurchases: { $sum: '$totalPurchases' }
        }
      }
    ]);

    // Get growth over time (simplified)
    const growthData = await User.aggregate([
      { $match: { sponsorId: req.user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get top performers
    const topPerformers = await User.find({ sponsorId: req.user._id })
      .sort({ totalEarnings: -1 })
      .limit(5)
      .select('firstName lastName email role totalEarnings totalPurchases');

    const stats = {
      basic: basicStats[0] || {
        totalMembers: 0,
        activeMembers: 0,
        totalAmbassadors: 0,
        totalClients: 0,
        totalEarnings: 0,
        totalPurchases: 0
      },
      growth: growthData,
      topPerformers
    };

    res.json(stats);

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: 'Impossibile ottenere le statistiche'
    });
  }
});

// Generate referral link
router.get('/referral-link', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralLink = `${baseUrl}/register?sponsor=${req.user.ambassadorCode}`;

    res.json({
      referralLink,
      ambassadorCode: req.user.ambassadorCode,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}`
    });

  } catch (error) {
    console.error('Generate referral link error:', error);
    res.status(500).json({
      error: 'Failed to generate referral link',
      message: 'Impossibile generare il link di referral'
    });
  }
});

// Get ambassador's commission history
router.get('/commission-history', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Simplified commission history (in a real app, this would come from a separate collection)
    const commissionHistory = [
      {
        id: 1,
        date: '2024-06-15',
        member: 'Mario Rossi',
        amount: 150,
        commission: 7.5,
        type: 'direct_sale'
      },
      {
        id: 2,
        date: '2024-06-14',
        member: 'Giulia Bianchi',
        amount: 200,
        commission: 10,
        type: 'downline_sale'
      },
      {
        id: 3,
        date: '2024-06-13',
        member: 'Luca Verdi',
        amount: 100,
        commission: 5,
        type: 'direct_sale'
      }
    ];

    const total = commissionHistory.length;
    const paginatedHistory = commissionHistory.slice(skip, skip + parseInt(limit));

    res.json({
      commissionHistory: paginatedHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get commission history error:', error);
    res.status(500).json({
      error: 'Failed to get commission history',
      message: 'Impossibile ottenere lo storico commissioni'
    });
  }
});

module.exports = router; 