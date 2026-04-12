const mongoose = require('mongoose');

const ContractorSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    activeSiteAddress: { type: String, required: true },
    approvedDebrisVolumeTons: { type: Number, required: true },
    // Array of strings to quickly match an IoT sensor or OCR scan to a company
    registeredLicensePlates: [{ type: String, required: true }] 
});

module.exports = mongoose.model('Contractor', ContractorSchema);