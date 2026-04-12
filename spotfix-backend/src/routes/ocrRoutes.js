const express = require('express');
const multer = require('multer');
const { scanPlate } = require('../controllers/ocrController');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post('/scan-plate', upload.single('image'), scanPlate);
module.exports = router;