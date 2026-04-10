const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  make: String,
  model: String,
  year: Number,
  pricePerDay: Number,
  availability: Boolean,
  images: [String],
  description: String,
  location: String,
  status: { type: String, default: 'pending' },
  vehicleType: { type: String }, 
  mileage: { type: Number },     
  weight: { type: Number },
  topSpeed: { type: Number },
  fuelType: { type: String },
});

module.exports = mongoose.model('Vehicle', vehicleSchema);