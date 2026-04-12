const Ticket = require('../models/Ticket');
const Ward = require('../models/Ward');
const Crew = require('../models/Crew');
const mongoose = require('mongoose'); // CRITICAL FIX: Required for Malba Grouping ID

exports.createTicket = async (req, res) => {
    try {
        // CRITICAL FIX 1: Look for evidenceImageUrls (Plural)
        const { wasteCategory, latitude, longitude, evidenceImageUrls } = req.body;
        const citizenId = req.user?.uid || 'anonymous_citizen'; 

        // CRITICAL FIX 2: Check for evidenceImageUrls
        if (!wasteCategory || !latitude || !longitude || !evidenceImageUrls || !evidenceImageUrls.length) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const ticketLocation = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
        const isMalba = wasteCategory.includes('Malba') || wasteCategory.includes('Truck');

        // ==========================================
        // EDGE CASE A: MALBA 50-METER GROUPING
        // ==========================================
        if (isMalba) {
            const userMalbaTickets = await Ticket.find({
                citizenId: citizenId,
                wasteCategory: { $regex: /Malba|Truck/i },
                location: { $near: { $geometry: ticketLocation, $maxDistance: 50 } },
                status: { $nin: ['Resolved', 'Invalid Report'] }
            });

            if (userMalbaTickets.length >= 3 && citizenId !== 'anonymous_citizen') {
                return res.status(400).json({ success: false, message: 'Spam Guard: Limit of 3 Malba reports reached.' });
            }

            const nearbyMalba = await Ticket.findOne({
                wasteCategory: { $regex: /Malba|Truck/i },
                location: { $near: { $geometry: ticketLocation, $maxDistance: 50 } },
                status: { $nin: ['Resolved', 'Invalid Report'] }
            });

            const groupId = nearbyMalba ? (nearbyMalba.malbaGroupId || nearbyMalba._id.toString()) : new mongoose.Types.ObjectId().toString();

            const matchedWard = await Ward.findOne({ boundary: { $geoIntersects: { $geometry: ticketLocation } } });
            const assignedWardId = matchedWard ? matchedWard.wardId : 'Out of Bounds';

            const ticket = await Ticket.create({
                citizenId, wasteCategory, location: ticketLocation,
                creatorOriginalCategory: wasteCategory, // NEW
                evidenceImageUrls, // NO BRACKETS NEEDED: It is already an array from Flutter!
                wardId: assignedWardId, status: 'Under Authority Review', malbaGroupId: groupId
            });

            return res.status(201).json({ success: true, message: `Malba logged. Linked to 50m Incident Zone.`, data: ticket });
        }

        // ==========================================
        // EDGE CASE B: GENERAL WASTE 30M UPVOTING 
        // ==========================================
        const duplicateTicket = await Ticket.findOne({
            wasteCategory: { $not: { $regex: /Malba|Truck/i } }, 
            location: { $near: { $geometry: ticketLocation, $maxDistance: 30 } },
            status: { $nin: ['Resolved', 'Invalid Report'] } 
        });

        if (duplicateTicket) {
            // NEW CRITICAL FIX: Block upvotes if the ticket is already being processed by officials!
            if (duplicateTicket.status !== 'Ticket Raised' && duplicateTicket.status !== 'Under Authority Review') {
                return res.status(400).json({ 
                    success: false, 
                    message: `Report blocked: The BMC is already actively processing this location (Status: ${duplicateTicket.status}).` 
                });
            }
            if (duplicateTicket.citizenId === citizenId && citizenId !== 'anonymous_citizen') {
                return res.status(400).json({ success: false, message: 'Spam Detected: You already reported this location.' });
            }

            const existingUpvote = duplicateTicket.upvoters.find(u => u.citizenId === citizenId);
            if (existingUpvote && citizenId !== 'anonymous_citizen') {
                return res.status(400).json({ success: false, message: 'Spam Detected: You already upvoted this location.' });
            }
            
            duplicateTicket.upvoteCount += 1;
            // CRITICAL FIX: Save the source of the upvote!
            duplicateTicket.upvoters.push({ 
                citizenId, 
                originalCategory: wasteCategory, 
                hasUpdated: false,
                source: ticketSource // This variable was defined at the top of your function
            });
            
            // CRITICAL FIX 3: Push the newest image into the gallery array!
            const newImage = evidenceImageUrls[0];
            if (!duplicateTicket.evidenceImageUrls.includes(newImage)) {
                duplicateTicket.evidenceImageUrls.push(newImage);
            }
            
            let currentVotes = duplicateTicket.categoryVotes.get(wasteCategory) || 0;
            duplicateTicket.categoryVotes.set(wasteCategory, currentVotes + 1);
            
            let maxVotes = 0;
            let dominantCategory = duplicateTicket.wasteCategory;
            duplicateTicket.categoryVotes.forEach((votes, cat) => {
                if (votes >= maxVotes) { maxVotes = votes; dominantCategory = cat; }
            });
            duplicateTicket.wasteCategory = dominantCategory;

            await duplicateTicket.save();
            return res.status(409).json({ success: false, message: 'Duplicate found within 30m. Upvoting existing ticket.', data: duplicateTicket });
        }

        // ==========================================
        // EDGE CASE C: BRAND NEW GENERAL WASTE TICKET
        // ==========================================
        const matchedWard = await Ward.findOne({ boundary: { $geoIntersects: { $geometry: ticketLocation } } });
        const assignedWardId = matchedWard ? matchedWard.wardId : 'Out of Bounds';

        const ticket = await Ticket.create({
            citizenId, wasteCategory, location: ticketLocation,
            creatorOriginalCategory: wasteCategory, // NEW
            evidenceImageUrls, // ALREADY AN ARRAY
            wardId: assignedWardId, status: 'Ticket Raised'
        });

        ticket.categoryVotes.set(wasteCategory, 1);
        await ticket.save();

        res.status(201).json({ success: true, message: `Auto-routed to Ward ${assignedWardId}`, data: ticket });

    } catch (error) {
        console.error("Ticket Creation Error:", error); 
        res.status(500).json({ success: false, message: 'Server Error during dispatch', error: error.message });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        
        if (req.query.citizenId) {
            filter.$or = [
                { citizenId: req.query.citizenId },
                { 'upvoters.citizenId': req.query.citizenId }
            ];
        } 

        // Add .lean() so we can modify the returned objects
        let tickets = await Ticket.find(filter).sort({ createdAt: -1 }).lean(); 

        // CRITICAL FIX: If this user is an upvoter, show them THEIR vote, not the dominant vote.
        // CRITICAL FIX: Preserve personalized view for BOTH Creator and Upvoter
        if (req.query.citizenId) {
            tickets = tickets.map(ticket => {
                if (ticket.citizenId === req.query.citizenId) {
                    // If it's the Creator, show their preserved original vote
                    if (ticket.creatorOriginalCategory) {
                        ticket.wasteCategory = ticket.creatorOriginalCategory;
                    }
                } else {
                    // If it's an Upvoter, show their specific upvote
                    const myVote = ticket.upvoters?.find(u => u.citizenId === req.query.citizenId);
                    if (myVote) {
                        ticket.wasteCategory = myVote.originalCategory; 
                    }
                }
                return ticket;
            });
        }

        res.status(200).json({ success: true, count: tickets.length, data: tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        // CRITICAL FIX: Look for resolutionImageUrls (Plural)
        const { status, inspectorNotes, resolutionImageUrls, rejectionReason, assignedTruck } = req.body;
        
        let updateData = { status };
        if (inspectorNotes) updateData.inspectorNotes = inspectorNotes;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;
        if (resolutionImageUrls) updateData.resolutionImageUrls = resolutionImageUrls; // NEW

        // ==========================================
        // VRP ALGORITHM: ROUTE THE NEAREST TRUCK
        // ==========================================
        if (status === 'Logistics Assigned' && assignedTruck) {
            const currentTicket = await Ticket.findById(id);
            if (!currentTicket) return res.status(404).json({ success: false, message: 'Ticket not found' });

            // The absolute magic of MongoDB Geospatial Queries
            const nearestCrew = await Crew.findOne({
                truckType: assignedTruck,
                isBusy: false, // Only find trucks that are currently free
                location: {
                    $near: {
                        $geometry: currentTicket.location // Sorts by spherical distance from the garbage pile!
                    }
                }
            });

            if (!nearestCrew) {
                // If every single truck of this type is busy (or doesn't exist)
                return res.status(400).json({ success: false, message: `System Error: No available ${assignedTruck} units within routing distance. Please try a different truck type or wait.` });
            }

            // Lock the truck so no one else can dispatch it
            nearestCrew.isBusy = true;
            nearestCrew.currentTicketId = currentTicket._id;
            await nearestCrew.save();

            // Save a log in the ticket notes so the Ward Officer knows which exact truck was routed
            updateData.inspectorNotes = (currentTicket.inspectorNotes || '') + `\n[SYSTEM ROUTING]: Auto-dispatched ${nearestCrew.truckId} (${assignedTruck}) to coordinates.`;
        }

        const ticket = await Ticket.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

        res.status(200).json({ success: true, data: ticket });
    } catch (error) {
        console.error("Status Update Error:", error);
        res.status(500).json({ success: false, message: 'Server Error updating ticket' });
    }
};

// @desc    Citizen updates their ticket category (Allowed ONCE)
// @route   PUT /api/tickets/:id/category
// @access  Protected
// @desc    Citizen updates their ticket category (Allowed ONCE)
// @route   PUT /api/tickets/:id/category
// @access  Protected
exports.updateTicketCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { newCategory } = req.body;
        const citizenId = req.user?.uid;

        const ticket = await Ticket.findById(id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

        if (ticket.status !== 'Ticket Raised') {
            return res.status(400).json({ success: false, message: 'Cannot edit ticket after processing has started.' });
        }

        // Check if the user is the ORIGINAL CREATOR
        if (ticket.citizenId === citizenId) {
            if (ticket.hasCitizenUpdated) {
                return res.status(400).json({ success: false, message: 'You can only update the category once.' });
            }
            
            // Swap their old vote for the new vote
            const oldCategory = ticket.creatorOriginalCategory || ticket.wasteCategory;
            let oldVotes = ticket.categoryVotes.get(oldCategory) || 1;
            ticket.categoryVotes.set(oldCategory, Math.max(0, oldVotes - 1));
            
            let newVotes = ticket.categoryVotes.get(newCategory) || 0;
            ticket.categoryVotes.set(newCategory, newVotes + 1);

            ticket.creatorOriginalCategory = newCategory; // NEW: Update their preserved vote
            ticket.hasCitizenUpdated = true;
        } 
        // Check if the user is an UPVOTER
        else {
            const upvoter = ticket.upvoters.find(u => u.citizenId === citizenId);
            if (!upvoter) {
                return res.status(403).json({ success: false, message: 'Unauthorized to edit this ticket.' });
            }
            if (upvoter.hasUpdated) {
                return res.status(400).json({ success: false, message: 'You can only update your upvote category once.' });
            }

            // Swap their specific old upvote for the new vote
            let oldVotes = ticket.categoryVotes.get(upvoter.originalCategory) || 1;
            ticket.categoryVotes.set(upvoter.originalCategory, Math.max(0, oldVotes - 1));
            let newVotes = ticket.categoryVotes.get(newCategory) || 0;
            ticket.categoryVotes.set(newCategory, newVotes + 1);

            upvoter.originalCategory = newCategory;
            upvoter.hasUpdated = true;
        }

        // Recalculate the Dominant Category based on the new tallies
        let maxVotes = 0;
        let dominantCategory = ticket.wasteCategory;
        ticket.categoryVotes.forEach((votes, cat) => {
            if (votes >= maxVotes) { maxVotes = votes; dominantCategory = cat; }
        });
        ticket.wasteCategory = dominantCategory;

        await ticket.save();
        res.status(200).json({ success: true, message: 'Category updated successfully', data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error updating category' });
    }
};