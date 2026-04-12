const mongoose = require('mongoose');

const ChallanSchema = new mongoose.Schema({
    contractorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true },
    offendingVehicle: { type: String, required: true },
    violationType: { type: String, required: true }, // e.g., 'Illegal Mid-Route Dump'
    fineAmountINR: { type: Number, default: 50000 },
    evidenceCoordinates: { type: [Number], required: true }, // [long, lat] where it happened
    status: { 
        type: String, 
        enum: ['Draft Generated (Awaiting Approval)', 'Issued', 'Paid'],
        default: 'Draft Generated (Awaiting Approval)' // Human-in-the-loop requirement
    }
}, { timestamps: true });

module.exports = mongoose.model('Challan', ChallanSchema);