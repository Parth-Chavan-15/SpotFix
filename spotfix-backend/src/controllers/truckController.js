const Contractor = require('../models/Contractor');
exports.verifyTruck = async (req, res) => {
    try {
        const { plate } = req.query;
        if (!plate) return res.status(400).json({ success: false, message: 'License plate required' });

        const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
        const contractor = await Contractor.findOne({ registeredLicensePlates: { $regex: new RegExp(`^${cleanPlate}$`, 'i') } });

        if (contractor) {
            return res.status(200).json({ success: true, data: { registered: true, plate: plate, contractor: contractor.companyName, status: 'Active Manifest' } });
        } else {
            return res.status(200).json({ success: true, data: { registered: false, plate: plate, contractor: 'UNKNOWN', status: 'Unregistered' } });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};