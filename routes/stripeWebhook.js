const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');
dotenv.config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const RentalHistory = require('../models/RentalHistory');
const sendEmail = require('../utils/emailService');
const generateInvoice = require('../utils/invoiceService');
const fs = require('fs');
const path = require('path');

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('Webhook event verified:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;

    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// FIX: This function was missing — defined here now
const handleCheckoutSessionCompleted = async (session) => {
  console.log('Checkout session completed:', session.id);
  const { vehicle, startDate, endDate, totalAmount, userId } = session.metadata;

  if (!vehicle || !startDate || !endDate || !totalAmount || !userId) {
    console.error('Missing metadata in checkout session:', session.metadata);
    return;
  }

  try {
    const booking = new Booking({
      user: userId,
      vehicle,
      startDate,
      endDate,
      totalAmount: Number(totalAmount),
      status: 'confirmed',
    });
    await booking.save();
    console.log('Booking saved from checkout session:', booking._id);

    const rentalHistory = new RentalHistory({
      user: userId,
      vehicle,
      startDate,
      endDate,
      totalAmount: Number(totalAmount),
    });
    await rentalHistory.save();
    console.log('Rental history saved');

    const populatedBooking = await Booking.findById(booking._id)
      .populate({ path: 'user', select: 'username email' })
      .populate({ path: 'vehicle', select: 'model' });

    const invoicesDir = path.join(__dirname, '../invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir);
    }

    const invoicePath = path.join(invoicesDir, `invoice_${booking._id}.pdf`);
    await generateInvoice(populatedBooking, invoicePath);

    const emailText = `
      Dear ${populatedBooking.user.username},
      Your booking for "${populatedBooking.vehicle.model}" has been confirmed!
      - Start Date: ${new Date(booking.startDate).toISOString().split('T')[0]}
      - End Date: ${new Date(booking.endDate).toISOString().split('T')[0]}
      - Total Price: ₹${booking.totalAmount}
      Please find your invoice attached.
      Thank you for choosing our service!
    `;

    await sendEmail(
      populatedBooking.user.email,
      'Booking Confirmation and Invoice',
      emailText,
      [{ filename: `invoice_${booking._id}.pdf`, path: invoicePath }]
    );
    console.log('Confirmation email sent to:', populatedBooking.user.email);
  } catch (error) {
    console.error('Error handling checkout session completed:', error.message);
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  console.log('Payment Intent succeeded:', paymentIntent.id);
  const { vehicle, startDate, endDate, totalAmount, userId } = paymentIntent.metadata;

  try {
    const booking = new Booking({
      user: userId,
      vehicle,
      startDate,
      endDate,
      totalAmount,
    });
    await booking.save();
    console.log('Booking saved:', booking);

    const rentalHistory = new RentalHistory({
      user: userId,
      vehicle,
      startDate,
      endDate,
      totalAmount,
    });
    await rentalHistory.save();
    console.log('Rental history updated:', rentalHistory);

    const populatedBooking = await Booking.findById(booking._id)
      .populate({ path: 'user', select: 'username email' })
      .populate({ path: 'vehicle', select: 'model' });
    console.log('Populated booking:', populatedBooking);

    const invoicesDir = path.join(__dirname, '../invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir);
    }

    const invoicePath = path.join(invoicesDir, `invoice_${booking._id}.pdf`);
    await generateInvoice(populatedBooking, invoicePath);

    if (!fs.existsSync(invoicePath)) {
      throw new Error(`Invoice file not found at: ${invoicePath}`);
    }

    const emailText = `
      Dear ${populatedBooking.user.username},
      Your booking for "${populatedBooking.vehicle.model}" has been confirmed!
      Booking Details:
      - Start Date: ${new Date(booking.startDate).toISOString().split('T')[0]}
      - End Date: ${new Date(booking.endDate).toISOString().split('T')[0]}
      - Total Price: ₹${booking.totalAmount}
      Please find your invoice attached.
      Thank you for choosing our service!
    `;

    await sendEmail(
      populatedBooking.user.email,
      'Booking Confirmation and Invoice',
      emailText,
      [{ filename: `invoice_${booking._id}.pdf`, path: invoicePath }]
    );
    console.log(`Email sent successfully to ${populatedBooking.user.email}`);
  } catch (error) {
    console.error('Error handling payment intent:', error.message);
  }
};

module.exports = router;