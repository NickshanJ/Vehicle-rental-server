const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  createCheckoutSession,
  handleWebhook,
} = require('../controllers/paymentController');

router.post('/create-checkout-session', authenticateToken, createCheckoutSession);
router.post('/webhook', handleWebhook);
router.get('/', authenticateToken, getPayments);
router.get('/:id', authenticateToken, getPaymentById);
router.put('/:id', authenticateToken, updatePayment);
router.delete('/:id', authenticateToken, deletePayment);

module.exports = router;