const Landfill = require('../models/Landfill');
const Contractor = require('../models/Contractor');
const Challan = require('../models/Challan');

// @desc    Receive Drop Alert from ESP32 Tiffin Sensor
// @route   POST /api/iot/drop-alert
// @access  Public (Hardware Endpoint)
exports.handleDropAlert = async (req, res) => {
    try {
        const { licensePlate, droppedWeightKg, latitude, longitude } = req.body;

        if (!licensePlate || !droppedWeightKg || !latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Missing telemetry data' });
        }

        const dropLocation = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)] // Longitude first
        };

        // 1. Check if this GPS point is inside ANY official BMC Landfill
        const isLegalDump = await Landfill.findOne({
            boundary: {
                $geoIntersects: {
                    $geometry: dropLocation
                }
            }
        });

        if (isLegalDump) {
            return res.status(200).json({ 
                success: true, 
                message: `Legal dump logged at ${isLegalDump.name}. Manifest updated.` 
            });
        }

        // 2. IF WE REACH HERE: It is an illegal dump. Find the culprit.
        const culprit = await Contractor.findOne({ registeredLicensePlates: licensePlate });

        if (!culprit) {
            // Trigger Vahan API fallback logic here in the future
            return res.status(404).json({ 
                success: false, 
                message: 'Code Red: Illegal dump detected, but vehicle is UNREGISTERED. Alerting Traffic Police.' 
            });
        }

        // 3. Generate the "Human-in-the-Loop" Draft Challan
        const newChallan = await Challan.create({
            contractorId: culprit._id,
            offendingVehicle: licensePlate,
            violationType: `Illegal Mid-Route Dump (${droppedWeightKg}kg Malba)`,
            evidenceCoordinates: dropLocation.coordinates,
            fineAmountINR: 50000 
        });

        res.status(201).json({
            success: true,
            alert: 'CODE RED: ILLEGAL DUMPING DETECTED',
            message: `Draft Challan of 50,000 INR generated for ${culprit.companyName}`,
            challanData: newChallan
        });

    } catch (error) {
        console.error('IoT Telemetry Error:', error);
        res.status(500).json({ success: false, message: 'Server Error processing telemetry' });
    }
};