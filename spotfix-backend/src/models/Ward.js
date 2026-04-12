const mongoose = require('mongoose');

const WardSchema = new mongoose.Schema({
    wardId: {
        type: String, // e.g., 'K/East'
        required: true,
        unique: true
    },
    assignedOfficerRole: {
        type: String, 
        required: true
    },
    boundary: {
        type: {
            type: String,
            enum: ['Polygon'], // Standard GeoJSON shape
            required: true
        },
        coordinates: {
            type: Array, // Array of arrays containing Long/Lat points
            required: true
        }
    }
});

// CRITICAL: The 2dsphere index makes the spatial math execute instantly
WardSchema.index({ boundary: '2dsphere' });

module.exports = mongoose.model('Ward', WardSchema);