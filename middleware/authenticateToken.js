const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // FIX: JWT payload may store ID as either "userId" or "id" depending on
    // how it was signed in authController. Read both to be safe.
    const userId = decoded.user?.userId || decoded.user?.id || decoded.userId || decoded.id;

    if (!userId) {
      return res.status(403).json({ message: 'Invalid token: no user ID found' });
    }

    const user = await User.findById(userId) || await Admin.findById(userId);
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Error verifying token:', err);
    res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = authenticateToken;