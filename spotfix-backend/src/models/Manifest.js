const mongoose = require('mongoose');

const ManifestSchema = new mongoose.Schema({
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true },
    
    truckPlate: { type: String, required: true },
    iotSensorId: { type: String, required: true }, 
    
    // Weight Tracking
    originWeightKg: { type: Number, required: true },
    landfillWeightKg: { type: Number, default: null }, // Populated by Weighbridge Official
    
    dispatchTime: { type: Date, default: Date.now },
    
    status: { 
        type: String, 
        enum: [
            'In_Transit', 
            'Resolved_Disposed', 
            'Unresolved_Transit', // Triggered by 11:59 PM End-of-Day Audit (Locks Contractor Dashboard)
            'IoT_Discrepancy_Flagged' // Triggered by ESP32 sudden weight drop
        ], 
        default: 'In_Transit' 
    },

    // If Unresolved_Transit occurs, the contractor must provide a reason to unlock their dashboard
    resolutionNotes: { type: String, default: '' } 
}, { timestamps: true });

module.exports = mongoose.model('Manifest', ManifestSchema);