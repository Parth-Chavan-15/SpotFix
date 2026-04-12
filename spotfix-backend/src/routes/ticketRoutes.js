const express = require('express');
const { createTicket, getTickets, updateTicketStatus, updateTicketCategory } = require('../controllers/ticketController'); 
const { protectRoute } = require('../middlewares/authMiddleware'); 

const router = express.Router();

// Citizens MUST be logged in to create or edit a category
router.post('/', protectRoute, createTicket); 
router.put('/:id/category', protectRoute, updateTicketCategory); 

// CRITICAL FIX: Removed 'protectRoute' so the React Web Dashboard can read & update!
router.get('/', getTickets);
router.put('/:id', updateTicketStatus);

module.exports = router;