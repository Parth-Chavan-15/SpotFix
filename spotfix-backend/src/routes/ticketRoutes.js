const express = require('express');
const { createTicket, getTickets, updateTicketStatus, updateTicketCategory, twitterWebhook } = require('../controllers/ticketController'); 
const { protectRoute } = require('../middlewares/authMiddleware'); 

const router = express.Router();

// NEW: Public Webhook for Twitter
router.post('/webhook/twitter', twitterWebhook);

router.post('/', protectRoute, createTicket); 
router.put('/:id/category', protectRoute, updateTicketCategory); 
router.get('/', getTickets); // Removed 'protectRoute' so the React Web Dashboard can read & update!
router.put('/:id', updateTicketStatus);

module.exports = router;