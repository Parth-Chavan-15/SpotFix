const express = require('express');
const { verifyTruck } = require('../controllers/truckController');
const { protectRoute } = require('../middlewares/authMiddleware'); 
const router = express.Router();
router.get('/verify', protectRoute, verifyTruck);
module.exports = router;