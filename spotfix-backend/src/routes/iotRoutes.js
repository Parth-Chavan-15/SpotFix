const express = require('express');
const { handleDropAlert } = require('../controllers/iotController');

const router = express.Router();

// Route: POST http://localhost:5000/api/iot/drop-alert
router.post('/drop-alert', handleDropAlert);

module.exports = router;