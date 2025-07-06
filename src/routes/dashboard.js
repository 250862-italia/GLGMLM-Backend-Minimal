const express = require('express');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../utils/auth');
const router = express.Router();

// Get dashboard data for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('sponsorId', 'firstName lastName email ambassadorCode')
      .populate('downline', 'firstName lastName email role status createdAt totalEarnings totalPurchases');

    // Get basic stats
    const downlineCount = user.downline.length;
    const activeDownline = user.downline.filter(u => u.status === 'active').length;
    
    // Calculate total earnings from downline (simplified)
    const totalDownlineEarnings = user.downline.reduce((sum, u) => sum + (u.totalEarnings || 0), 0);
    const totalDownlinePurchases = user.downline.reduce((sum, u) => sum + (u.totalPurchases || 0), 0);

    // Get recent activity
    const recentDownline = user.downline
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const dashboardData = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        ambassadorCode: user.ambassadorCode,
        clientCode: user.clientCode,
        level: user.level,
        totalEarnings: user.totalEarnings,
        totalPurchases: user.totalPurchases,
        sponsor: user.sponsorId
      },
      stats: {
        downlineCount,
        activeDownline,
        totalDownlineEarnings,
        totalDownlinePurchases,
        commissionRate: user.commissionRate || 0.05
      },
      recentActivity: {
        recentDownline
      }
    };

    // Add role-specific data
    if (user.role === 'ambassador') {
      // Get monthly earnings trend (simplified)
      const monthlyEarnings = [
        { month: 'Gen', earnings: Math.floor(Math.random() * 1000) },
        { month: 'Feb', earnings: Math.floor(Math.random() * 1000) },
        { month: 'Mar', earnings: Math.floor(Math.random() * 1000) },
        { month: 'Apr', earnings: Math.floor(Math.random() * 1000) },
        { month: 'Mag', earnings: Math.floor(Math.random() * 1000) },
        { month: 'Giu', earnings: Math.floor(Math.random() * 1000) }
      ];

      dashboardData.ambassadorStats = {
        monthlyEarnings,
        averageCommission: (user.commissionRate * 100).toFixed(1) + '%',
        rank: user.level === 0 ? 'Diretto' : `Livello ${user.level}`
      };
    }

    if (user.role === 'client') {
      // Get purchase history (simplified)
      const purchaseHistory = [
        { date: '2024-01-15', amount: 150, product: 'Prodotto A' },
        { date: '2024-02-20', amount: 200, product: 'Prodotto B' },
        { date: '2024-03-10', amount: 100, product: 'Prodotto C' }
      ];

      dashboardData.clientStats = {
        purchaseHistory,
        totalSpent: user.totalPurchases,
        averageOrder: user.totalPurchases > 0 ? (user.totalPurchases / purchaseHistory.length).toFixed(2) : 0
      };
    }

    res.json(dashboardData);

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load dashboard',
      message: 'Impossibile caricare la dashboard'
    });
  }
});

// Get admin dashboard (admin only)
router.get('/admin', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    // Get overall statistics
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
    const recentRegistrations = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('firstName lastName email role status createdAt');

    // Get top ambassadors by earnings
    const topAmbassadors = await User.find({ role: 'ambassador' })
      .sort({ totalEarnings: -1 })
      .limit(5)
      .select('firstName lastName email totalEarnings downline');

    // Get top clients by purchases
    const topClients = await User.find({ role: 'client' })
      .sort({ totalPurchases: -1 })
      .limit(5)
      .select('firstName lastName email totalPurchases');

    // Get monthly growth (simplified)
    const monthlyGrowth = [
      { month: 'Gen', users: 45, ambassadors: 12, clients: 33 },
      { month: 'Feb', users: 52, ambassadors: 15, clients: 37 },
      { month: 'Mar', users: 61, ambassadors: 18, clients: 43 },
      { month: 'Apr', users: 68, ambassadors: 22, clients: 46 },
      { month: 'Mag', users: 75, ambassadors: 25, clients: 50 },
      { month: 'Giu', users: 82, ambassadors: 28, clients: 54 }
    ];

    const adminDashboard = {
      stats: stats[0] || {
        totalUsers: 0,
        totalAmbassadors: 0,
        totalClients: 0,
        activeUsers: 0,
        pendingUsers: 0,
        totalEarnings: 0,
        totalPurchases: 0
      },
      recentRegistrations,
      topAmbassadors,
      topClients,
      monthlyGrowth
    };

    res.json(adminDashboard);

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load admin dashboard',
      message: 'Impossibile caricare la dashboard admin'
    });
  }
});

// Get ambassador dashboard
router.get('/ambassador', authenticateToken, authorizeRoles('ambassador'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('downline', 'firstName lastName email role status createdAt totalEarnings totalPurchases');

    // Get downline statistics
    const downlineStats = await User.aggregate([
      { $match: { sponsorId: user._id } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$totalEarnings' },
          totalPurchases: { $sum: '$totalPurchases' }
        }
      }
    ]);

    // Get earnings by level
    const earningsByLevel = await User.aggregate([
      { $match: { upline: user._id } },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 },
          totalEarnings: { $sum: '$totalEarnings' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get recent recruits
    const recentRecruits = user.downline
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const ambassadorDashboard = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        ambassadorCode: user.ambassadorCode,
        commissionRate: user.commissionRate,
        totalEarnings: user.totalEarnings,
        level: user.level
      },
      downlineStats: {
        total: user.downline.length,
        ambassadors: downlineStats.find(s => s._id === 'ambassador')?.count || 0,
        clients: downlineStats.find(s => s._id === 'client')?.count || 0,
        totalDownlineEarnings: downlineStats.reduce((sum, s) => sum + s.totalEarnings, 0),
        totalDownlinePurchases: downlineStats.reduce((sum, s) => sum + s.totalPurchases, 0)
      },
      earningsByLevel,
      recentRecruits
    };

    res.json(ambassadorDashboard);

  } catch (error) {
    console.error('Ambassador dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load ambassador dashboard',
      message: 'Impossibile caricare la dashboard ambassador'
    });
  }
});

// Get client dashboard
router.get('/client', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('sponsorId', 'firstName lastName email ambassadorCode');

    // Get purchase recommendations (simplified)
    const recommendations = [
      { id: 1, name: 'Prodotto Premium A', price: 199, category: 'Premium' },
      { id: 2, name: 'Prodotto Standard B', price: 99, category: 'Standard' },
      { id: 3, name: 'Prodotto Base C', price: 49, category: 'Base' }
    ];

    // Get loyalty points (simplified)
    const loyaltyPoints = Math.floor(user.totalPurchases * 0.1);

    const clientDashboard = {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        clientCode: user.clientCode,
        totalPurchases: user.totalPurchases,
        sponsor: user.sponsorId
      },
      recommendations,
      loyaltyPoints,
      memberSince: user.createdAt
    };

    res.json(clientDashboard);

  } catch (error) {
    console.error('Client dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load client dashboard',
      message: 'Impossibile caricare la dashboard cliente'
    });
  }
});

module.exports = router; 