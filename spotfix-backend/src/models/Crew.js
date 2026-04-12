const mongoose = require('mongoose');

const CrewSchema = new mongoose.Schema({
    truckId: { type: String, required: true, unique: true },
    truckType: { 
        type: String, 
        enum: ['Mini Tipper (Narrow Streets)', 'Refuse Compactor (Standard)', 'Open Dumper (Heavy Malba)', 'JCB Excavator (Severe Dump)'],
        required: true 
    },
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    isBusy: { type: Boolean, default: false },
    currentTicketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null }
}, { timestamps: true });

// CRITICAL: This 2dsphere index is what allows the instant math calculations for distance!
CrewSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Crew', CrewSchema);