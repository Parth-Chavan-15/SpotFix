require('dotenv').config();
const mongoose = require('mongoose');
const Ward = require('./src/models/Ward');
const Contractor = require('./src/models/Contractor');
const Landfill = require('./src/models/Landfill');
const Ticket = require('./src/models/Ticket');  
const Challan = require('./src/models/Challan'); 
const Crew = require('./src/models/Crew'); // <-- NEW CREW MODEL

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected for Seeding'))
    .catch(err => { console.error('Connection Error:', err); process.exit(1); });

const seedDatabase = async () => {
    try {
        // 1. WIPE EVERYTHING CLEAN
        await Ward.deleteMany({});
        await Contractor.deleteMany({});
        await Landfill.deleteMany({});
        await Ticket.deleteMany({});  
        await Challan.deleteMany({}); 
        await Crew.deleteMany({}); // <-- Wipe old fleets
        console.log('🗑️ Database wiped clean.');

        // 2. Seed Ward, Contractor, Landfill...
        await Ward.create({
            wardId: 'K/East', assignedOfficerRole: 'Ward_Officer_KEast',
            boundary: { type: 'Polygon', coordinates: [[[72.8200, 19.0900], [72.8900, 19.0900], [72.8900, 19.1400], [72.8200, 19.1400], [72.8200, 19.0900]]] }
        });

        await Contractor.create({
            companyName: 'L&T Infrastructure (Metro Line 3)', activeSiteAddress: 'Andheri East Metro Station Area',
            approvedDebrisVolumeTons: 5000, registeredLicensePlates: ['MH01AB1234']
        });

        await Landfill.create({
            facilityId: 'DEONAR_01', name: 'Deonar Dumping Ground',
            boundary: { type: 'Polygon', coordinates: [[[72.9100, 19.0400], [72.9400, 19.0400], [72.9400, 19.0700], [72.9100, 19.0700], [72.9100, 19.0400]]] }
        });

        // 3. SEED THE DUMMY FLEET (20 Trucks scattered around K/East Ward)
        const truckTypes = ['Mini Tipper (Narrow Streets)', 'Refuse Compactor (Standard)', 'Open Dumper (Heavy Malba)', 'JCB Excavator (Severe Dump)'];
        const dummyFleet = [];
        
        for(let i = 1; i <= 20; i++) {
            // Generate random GPS coordinates near K/East Ward center (19.11, 72.85)
            const randomLng = 72.83 + (Math.random() * 0.04);
            const randomLat = 19.09 + (Math.random() * 0.04);
            
            dummyFleet.push({
                truckId: `TRK-${1000 + i}`,
                truckType: truckTypes[i % truckTypes.length], // Cycles through the 4 types
                location: { type: 'Point', coordinates: [randomLng, randomLat] },
                isBusy: false // All trucks start available
            });
        }
        await Crew.insertMany(dummyFleet);
        console.log(`🚛 Deployed 20 Logistics Trucks to the digital grid.`);

        console.log('✅ DATABASE SEEDING COMPLETE! Fresh environment ready.');
        process.exit();
    } catch (error) {
        console.error('❌ Seeding Failed:', error);
        process.exit(1);
    }
};

seedDatabase();