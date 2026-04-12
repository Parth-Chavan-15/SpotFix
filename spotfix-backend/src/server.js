require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

connectDB();
const app = express();

app.use(helmet()); 
app.use(cors()); 
app.use(express.json()); 
app.use(morgan('dev')); 

app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'SpotFix Core Backend is Live' });
});

// ROUTE IMPORTS
const ticketRoutes = require('./routes/ticketRoutes');
const iotRoutes = require('./routes/iotRoutes'); 
const uploadRoutes = require('./routes/uploadRoutes');
const ocrRoutes = require('./routes/ocrRoutes'); 
const truckRoutes = require('./routes/truckRoutes'); 

// CRITICAL FIX: ALL APP.USE ROUTE MOUNTS MUST BE ABOVE APP.LISTEN
app.use('/api/tickets', ticketRoutes);
app.use('/api/iot', iotRoutes); 
app.use('/api/upload', uploadRoutes); 
app.use('/api/ocr', ocrRoutes); 
app.use('/api/trucks', truckRoutes); 

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`SpotFix Enterprise Server running on port ${PORT}`);
});