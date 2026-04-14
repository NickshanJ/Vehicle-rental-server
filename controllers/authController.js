const User = require('../models/User');
const Admin = require('../models/Admin'); // Import the Admin model
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Booking = require('../models/Booking'); // Ensure Booking is correctly imported
const Payment = require('../models/Payment'); // Ensure Payment is correctly imported
const Review = require('../models/Review'); // Ensure Review is correctly imported
const Vehicle = require('../models/Vehicle'); // Ensure Vehicle is correctly imported
const multer = require('multer');
const path = require('path');

// Register user
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user (updated to support both users and admins)
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('loginUser: Attempting to log in with username:', username);

    // Check the `admins` collection first
    let user = await Admin.findOne({ username });
    console.log('loginUser: Admin user lookup result:', user);
    let isAdmin = true;

    // If not found in `admins`, check the `users` collection
    if (!user) {
      user = await User.findOne({ username });
      console.log('loginUser: Regular user lookup result:', user);
      isAdmin = false;
    }

    if (!user) {
      console.log('loginUser: User not found in both collections');
      return res.status(404).json({ message: 'Invalid username or password' });
    }

    console.log('loginUser: Comparing provided password:', password);
    console.log('loginUser: Stored hashed password:', user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('loginUser: Password match result:', isMatch);

    if (!isMatch) {
      console.log('loginUser: Password does not match');
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const payload = {
      user: {
        userId: user._id,
        id: user._id,  // FIX: add both id and userId for compatibility
        username: user.username,
        isAdmin,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        console.log('loginUser: Token generated:', token);

        // Include the user object in the response
        res.json({
          token,
          user: {
            id: user._id,
            _id: user._id,  // FIX: add _id for frontend compatibility
            username: user.username,
            isAdmin,
          },
        });
      }
    );
  } catch (error) {
    console.error('loginUser: Server error', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    console.log('Fetching user profile for user ID:', req.user._id);

    const user = await User.findById(req.user._id)
      .populate({
        path: 'bookings',
        populate: { path: 'vehicle', select: 'model' }
      })
      .populate({
        path: 'reviews',
        populate: { path: 'vehicle', select: 'model' }
      });

    if (!user) {
      console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch bookings directly if not present in user's bookings array
    const additionalBookings = await Booking.find({ user: req.user._id }).populate('vehicle', 'model');
    user.bookings = user.bookings.concat(additionalBookings.filter(booking => !user.bookings.includes(booking._id)));
    
    console.log('Populated bookings:', user.bookings);
    console.log('Populated reviews:', user.reviews);

    res.json({
      profile: {
        username: user.username,
        email: user.email,
        imageUrl: user.imageUrl || user.profileImage,
        profileImage: user.profileImage || user.imageUrl,
        bookings: user.bookings,
        reviews: user.reviews
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      user.password = await bcrypt.hash(req.body.password, 10);
    }

    if (req.file) {
      console.log('Uploaded file:', req.file); 
      user.imageUrl = req.file.path;
    }

    const updatedUser = await user.save();
    console.log('Updated user:', updatedUser);

    res.status(200).json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      imageUrl: updatedUser.imageUrl
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Request password reset
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiration = Date.now() + 3600000; // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiration = resetTokenExpiration;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Click the link below to reset your password:\n\n${process.env.CLIENT_URL}/reset-password/${resetToken}`, // Correctly use the CLIENT_URL from .env
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset link sent' });
  } catch (error) {
    console.error('Error sending email:', error); // Log the error
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateUserProfile,
  requestPasswordReset,
  resetPassword
};