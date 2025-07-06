const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'ambassador', 'client'],
    default: 'client'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  // MLM specific fields
  sponsorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  upline: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downline: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  level: {
    type: Number,
    default: 0
  },
  // Ambassador specific fields
  ambassadorCode: {
    type: String,
    unique: true,
    sparse: true
  },
  commissionRate: {
    type: Number,
    default: 0.05, // 5% default commission
    min: 0,
    max: 1
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  // Client specific fields
  clientCode: {
    type: String,
    unique: true,
    sparse: true
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  // Profile fields
  avatar: {
    type: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  dateOfBirth: {
    type: Date
  },
  // Preferences
  language: {
    type: String,
    enum: ['it', 'en', 'es', 'fr'],
    default: 'it'
  },
  timezone: {
    type: String,
    default: 'Europe/Rome'
  },
  // Timestamps
  lastLogin: {
    type: Date
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ ambassadorCode: 1 });
userSchema.index({ clientCode: 1 });
userSchema.index({ sponsorId: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate unique codes
userSchema.pre('save', async function(next) {
  if (this.isNew) {
    if (this.role === 'ambassador' && !this.ambassadorCode) {
      this.ambassadorCode = await this.generateUniqueCode('AMB');
    }
    if (this.role === 'client' && !this.clientCode) {
      this.clientCode = await this.generateUniqueCode('CLI');
    }
  }
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateUniqueCode = async function(prefix) {
  const User = this.constructor;
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    code = `${prefix}${randomNum}`;
    
    const existingUser = await User.findOne({
      $or: [{ ambassadorCode: code }, { clientCode: code }]
    });
    
    if (!existingUser) {
      isUnique = true;
    }
  }
  
  return code;
};

userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

userSchema.methods.getDownlineCount = function() {
  return this.downline.length;
};

userSchema.methods.getUplineCount = function() {
  return this.upline.length;
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByCode = function(code) {
  return this.findOne({
    $or: [{ ambassadorCode: code }, { clientCode: code }]
  });
};

module.exports = mongoose.model('User', userSchema); 