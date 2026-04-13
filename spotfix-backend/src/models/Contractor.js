const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
    licensePlate: { type: String, required: true, uppercase: true }, // For Pillar 1 OCR matching
    vehicleClass: { type: String, enum: ['HGV', 'LCV'], default: 'HGV' },
    iotSensorId: { type: String, required: true } // Pillar 2: Links the truck to the ESP32 Tiffin Box
});

const ContractorSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    bmcRegistrationId: { type: String, required: true, unique: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    
    // The contractor's authorized fleet
    registeredFleet: [VehicleSchema],
    
    // Safety lock: If true, they cannot generate new manifests (Triggered by Unresolved Transits)
    isDashboardLocked: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Contractor', ContractorSchema);