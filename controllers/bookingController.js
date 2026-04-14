const Booking = require('../models/Booking');
const User = require('../models/User');

// POST /api/bookings — create a direct booking (admin/manual use)
const createBooking = async (req, res) => {
  try {
    const { vehicle, startDate, endDate, totalAmount } = req.body;
    const booking = new Booking({
      user: req.user._id,
      vehicle,
      startDate,
      endDate,
      totalAmount,
      status: 'confirmed',
    });
    await booking.save();
    res.status(201).json({ message: 'Booking created', booking });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/bookings — admin gets all bookings
const getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'username email')
      .populate('vehicle', 'model make images');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/bookings/my-bookings — current user's bookings
// FIX: populate vehicle with model + images so Profile page and review check work
const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('vehicle', 'model make images pricePerDay')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'username email')
      .populate('vehicle', 'model make images');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/bookings/:id
const updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/bookings/:id
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/bookings/payment-confirmation — called by PaymentHandler after Stripe redirect
const paymentConfirmation = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ message: 'No paymentIntentId provided' });

    // Find booking by payment intent if you store it, otherwise just confirm
    res.json({ message: 'Payment confirmed', success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getUserBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  paymentConfirmation,
};