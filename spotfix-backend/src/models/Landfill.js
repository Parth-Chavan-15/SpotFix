const mongoose = require('mongoose');

const LandfillSchema = new mongoose.Schema({
    facilityId: { type: String, required: true, unique: true },
    name: { type: String, required: true }, // e.g., 'Deonar Dumping Ground'
    boundary: {
        type: { type: String, enum: ['Polygon'], required: true },
        coordinates: { type: Array, required: true }
    }
});

LandfillSchema.index({ boundary: '2dsphere' });
module.exports = mongoose.model('Landfill', LandfillSchema);