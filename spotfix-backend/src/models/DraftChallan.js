const mongoose = require('mongoose');

const DraftChallanSchema = new mongoose.Schema({
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true },
    
    violationType: { 
        type: String, 
        enum: [
            'Pillar 1: Citizen OCR Detection', 
            'Pillar 2: IoT Mid-Route Dump', 
            'Pillar 3: Mass Balance Deficit',
            'Pillar 4: Unregistered RTO Vehicle'
        ], 
        required: true 
    },
    
    // The evidence package bundled for the Ward Officer
    evidenceUrl: { type: String }, // Citizen Photo or IoT Telemetry Graph
    deficitAmountKg: { type: Number }, // For Pillar 2 and 3
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number] } // [longitude, latitude] of the illegal dump
    },
    
    status: { 
        type: String, 
        enum: ['Draft - Awaiting Authority', 'Approved - Fine Issued', 'Rejected'], 
        default: 'Draft - Awaiting Authority' 
    },
    
    wardId: { type: String, required: true }, // Which Ward Officer reviews this
    fineAmountINR: { type: Number, required: true }
}, { timestamps: true });

DraftChallanSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('DraftChallan', DraftChallanSchema);