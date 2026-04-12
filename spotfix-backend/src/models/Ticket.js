const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    citizenId: { type: String, required: true },
    wasteCategory: { type: String, required: true }, // Removed strict enum to allow dynamic Malba/Truck payloads
    // NEW: Preserves the creator's personalized view against majority overrides!
    creatorOriginalCategory: { type: String },
    location: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true }
    },
    wardId: { type: String, default: 'Pending Dispatch' },
    status: {
        type: String,
        // CRITICAL FIX: Added 'Field Verified' to the workflow pipeline
        enum: ['Ticket Raised', 'Verification Pending', 'Field Verified', 'Under Authority Review', 'Logistics Assigned', 'Invalid Report', 'Resolved'],
        default: 'Ticket Raised'
    },
    
    evidenceImageUrls: [{ type: String, required: true }], // CRITICAL UPGRADE: From a single String to an Array of Strings for the Image Gallery

    // CRITICAL FIX: Tracks the origin of the complaint for the Omnichannel Dashboard
    source: { 
        type: String, 
        enum: ['App', 'Twitter', 'Call', 'IoT'], 
        default: 'App' 
    },

    // 1. Tally system for the most popular dropdown selection
    upvoteCount: { type: Number, default: 1 },
    categoryVotes: { type: Map, of: Number, default: {} }, 
    // 2. Allows user to fix their mistake ONLY ONCE
    hasCitizenUpdated: { type: Boolean, default: false },
    // NEW: Track who upvoted so they can edit their specific vote later
    upvoters: [{
        citizenId: String,
        originalCategory: String,
        hasUpdated: { type: Boolean, default: false },
        source: { type: String, enum: ['App', 'Twitter', 'Call', 'IoT'], default: 'App' } // NEW: Track upvoter's origin
    }],
    
    // 3. Links distinct Rogue Trucks within 50m together for the Inspector
    malbaGroupId: { type: String, default: null },

    inspectorNotes: { type: String, default: '' },
    rejectionReason: { type: String, default: '' }, // NEW: For the Citizen to see why it was rejected
    resolutionImageUrls: [{ type: String }],
    isDuplicate: { type: Boolean, default: false }
}, 
{ timestamps: true }
);

TicketSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Ticket', TicketSchema);