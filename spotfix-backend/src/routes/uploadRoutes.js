const express = require('express');
const { generateSignature } = require('../controllers/uploadController');
const { protectRoute } = require('../middlewares/authMiddleware');

const router = express.Router();

// This route is protected! Only Firebase users can get a signature.
router.get('/signature', protectRoute, generateSignature);

module.exports = router;