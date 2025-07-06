const express = require('express');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../utils/auth');
const router = express.Router();

// Get client's purchase history
router.get('/purchases', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Simplified purchase history (in a real app, this would come from a separate collection)
    const purchaseHistory = [
      {
        id: 1,
        date: '2024-06-15',
        product: 'Prodotto Premium A',
        amount: 199,
        status: 'completed',
        orderNumber: 'ORD-001'
      },
      {
        id: 2,
        date: '2024-06-10',
        product: 'Prodotto Standard B',
        amount: 99,
        status: 'completed',
        orderNumber: 'ORD-002'
      },
      {
        id: 3,
        date: '2024-06-05',
        product: 'Prodotto Base C',
        amount: 49,
        status: 'completed',
        orderNumber: 'ORD-003'
      },
      {
        id: 4,
        date: '2024-05-28',
        product: 'Prodotto Premium D',
        amount: 299,
        status: 'completed',
        orderNumber: 'ORD-004'
      },
      {
        id: 5,
        date: '2024-05-20',
        product: 'Prodotto Standard E',
        amount: 149,
        status: 'completed',
        orderNumber: 'ORD-005'
      }
    ];

    const total = purchaseHistory.length;
    const paginatedHistory = purchaseHistory.slice(skip, skip + parseInt(limit));

    res.json({
      purchases: paginatedHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({
      error: 'Failed to get purchase history',
      message: 'Impossibile ottenere lo storico acquisti'
    });
  }
});

// Get client's loyalty points
router.get('/loyalty', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Calculate loyalty points (simplified)
    const totalPoints = Math.floor(user.totalPurchases * 0.1);
    const availablePoints = totalPoints - (user.redeemedPoints || 0);
    
    // Get loyalty history
    const loyaltyHistory = [
      {
        id: 1,
        date: '2024-06-15',
        type: 'earned',
        points: 20,
        description: 'Acquisto Prodotto Premium A'
      },
      {
        id: 2,
        date: '2024-06-10',
        type: 'earned',
        points: 10,
        description: 'Acquisto Prodotto Standard B'
      },
      {
        id: 3,
        date: '2024-06-01',
        type: 'redeemed',
        points: -50,
        description: 'Sconto 10€ su ordine'
      }
    ];

    res.json({
      summary: {
        totalPoints,
        availablePoints,
        redeemedPoints: user.redeemedPoints || 0,
        tier: availablePoints >= 100 ? 'Gold' : availablePoints >= 50 ? 'Silver' : 'Bronze'
      },
      history: loyaltyHistory
    });

  } catch (error) {
    console.error('Get loyalty error:', error);
    res.status(500).json({
      error: 'Failed to get loyalty information',
      message: 'Impossibile ottenere le informazioni fedeltà'
    });
  }
});

// Get client's recommendations
router.get('/recommendations', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    // Simplified product recommendations based on purchase history
    const recommendations = [
      {
        id: 1,
        name: 'Prodotto Premium A',
        price: 199,
        category: 'Premium',
        description: 'Prodotto di alta qualità per clienti esigenti',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.8,
        reviews: 125
      },
      {
        id: 2,
        name: 'Prodotto Standard B',
        price: 99,
        category: 'Standard',
        description: 'Prodotto di qualità media per uso quotidiano',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.5,
        reviews: 89
      },
      {
        id: 3,
        name: 'Prodotto Base C',
        price: 49,
        category: 'Base',
        description: 'Prodotto essenziale per iniziare',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.2,
        reviews: 67
      },
      {
        id: 4,
        name: 'Prodotto Premium D',
        price: 299,
        category: 'Premium',
        description: 'Prodotto esclusivo per veri appassionati',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.9,
        reviews: 45
      }
    ];

    res.json({
      recommendations,
      basedOn: 'I tuoi acquisti precedenti'
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: 'Impossibile ottenere le raccomandazioni'
    });
  }
});

// Get client's sponsor information
router.get('/sponsor', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('sponsorId', 'firstName lastName email phone ambassadorCode');

    if (!user.sponsorId) {
      return res.status(404).json({
        error: 'No sponsor found',
        message: 'Nessuno sponsor trovato'
      });
    }

    res.json({
      sponsor: {
        id: user.sponsorId._id,
        firstName: user.sponsorId.firstName,
        lastName: user.sponsorId.lastName,
        email: user.sponsorId.email,
        phone: user.sponsorId.phone,
        ambassadorCode: user.sponsorId.ambassadorCode
      }
    });

  } catch (error) {
    console.error('Get sponsor error:', error);
    res.status(500).json({
      error: 'Failed to get sponsor information',
      message: 'Impossibile ottenere le informazioni sponsor'
    });
  }
});

// Update client preferences
router.put('/preferences', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const { language, notifications, marketing } = req.body;

    const updateData = {};
    if (language) updateData.language = language;
    if (notifications !== undefined) updateData.notifications = notifications;
    if (marketing !== undefined) updateData.marketing = marketing;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      message: 'Preferences updated successfully',
      message_it: 'Preferenze aggiornate con successo',
      user
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: 'Impossibile aggiornare le preferenze'
    });
  }
});

// Get client's statistics
router.get('/stats', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Calculate statistics
    const totalSpent = user.totalPurchases || 0;
    const averageOrder = totalSpent > 0 ? (totalSpent / 5).toFixed(2) : 0; // Assuming 5 orders
    const memberSince = user.createdAt;
    const daysAsMember = Math.floor((new Date() - new Date(memberSince)) / (1000 * 60 * 60 * 24));

    // Get monthly spending (simplified)
    const monthlySpending = [
      { month: 'Gen', amount: 150 },
      { month: 'Feb', amount: 200 },
      { month: 'Mar', amount: 100 },
      { month: 'Apr', amount: 300 },
      { month: 'Mag', amount: 250 },
      { month: 'Giu', amount: 180 }
    ];

    const stats = {
      summary: {
        totalSpent,
        averageOrder,
        totalOrders: 5, // Simplified
        daysAsMember,
        loyaltyTier: totalSpent >= 1000 ? 'Gold' : totalSpent >= 500 ? 'Silver' : 'Bronze'
      },
      monthlySpending
    };

    res.json(stats);

  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: 'Impossibile ottenere le statistiche'
    });
  }
});

// Get available products
router.get('/products', authenticateToken, authorizeRoles('client'), async (req, res) => {
  try {
    const { category, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Simplified product catalog
    const products = [
      {
        id: 1,
        name: 'Prodotto Premium A',
        price: 199,
        category: 'Premium',
        description: 'Prodotto di alta qualità per clienti esigenti',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.8,
        reviews: 125,
        inStock: true
      },
      {
        id: 2,
        name: 'Prodotto Standard B',
        price: 99,
        category: 'Standard',
        description: 'Prodotto di qualità media per uso quotidiano',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.5,
        reviews: 89,
        inStock: true
      },
      {
        id: 3,
        name: 'Prodotto Base C',
        price: 49,
        category: 'Base',
        description: 'Prodotto essenziale per iniziare',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.2,
        reviews: 67,
        inStock: true
      },
      {
        id: 4,
        name: 'Prodotto Premium D',
        price: 299,
        category: 'Premium',
        description: 'Prodotto esclusivo per veri appassionati',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.9,
        reviews: 45,
        inStock: false
      },
      {
        id: 5,
        name: 'Prodotto Standard E',
        price: 149,
        category: 'Standard',
        description: 'Prodotto versatile per diverse esigenze',
        image: 'https://via.placeholder.com/300x200',
        rating: 4.3,
        reviews: 78,
        inStock: true
      }
    ];

    // Filter by category if specified
    let filteredProducts = products;
    if (category) {
      filteredProducts = products.filter(p => p.category === category);
    }

    // Sort products
    filteredProducts.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'price') {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    res.json({
      products: filteredProducts,
      categories: ['Premium', 'Standard', 'Base'],
      total: filteredProducts.length
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      error: 'Failed to get products',
      message: 'Impossibile ottenere i prodotti'
    });
  }
});

module.exports = router; 