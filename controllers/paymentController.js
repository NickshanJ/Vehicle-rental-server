const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const sendEmail = require('../utils/emailService');
const generateInvoice = require('../utils/invoiceService');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const fs = require('fs');

// Get all payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find();
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Handle Stripe checkout session creation
exports.createCheckoutSession = async (req, res) => {
  try {
    const { vehicle, startDate, endDate, totalAmount } = req.body;
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Get user ID from the authenticated request
    const userId = req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!vehicle || !startDate || !endDate || !totalAmount) {
      return res.status(400).json({ message: 'Missing booking details' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: 'Vehicle Rental Payment',
              description: `Rental from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/thank-you`,
      cancel_url: `${frontendUrl}/checkout-cancelled`,
      metadata: {
        vehicle: vehicle.toString(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        totalAmount: totalAmount.toString(),
        userId: userId,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Handle webhook
exports.handleWebhook = (req, res) => {
  res.status(200).json({ received: true });
};

// Create a new payment
exports.createPayment = async (req, res) => {
  try {
    res.status(200).json({ message: 'Payment created successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a payment by ID
exports.updatePayment = async (req, res) => {
  try {
    res.status(200).json({ message: 'Payment updated successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a payment by ID
exports.deletePayment = async (req, res) => {
  try {
    res.status(200).json({ message: 'Payment deleted successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};