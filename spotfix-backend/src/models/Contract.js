const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true },
    siteAddress: { type: String, required: true },
    
    // Ward Officer Routing & Handshake
    wardId: { type: String, required: true }, // e.g., 'K/East'
    assignedLandfill: { type: String, default: 'Unassigned' }, // Ward Officer assigns this
    
    // PILLAR 3: MASS BALANCE AUDIT
    estimatedVolumeTons: { type: Number, required: true }, // Pre-construction engineer estimate
    totalLandfilledTons: { type: Number, default: 0 },     // Auto-increments as manifests are resolved
    
    // Project Timelines
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }, // The trigger date for the final Forensic Audit
    
    status: { 
        type: String, 
        enum: [
            'Pending Ward Approval', 
            'Approved', 
            'Volume Amendment Requested', 
            'Completed', 
            'Forensic Audit Failed' // Triggered if totalLandfilled << estimatedVolume at endDate
        ], 
        default: 'Pending Ward Approval' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Contract', ContractSchema);