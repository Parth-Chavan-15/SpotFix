const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Just pass the URI, no extra options needed for Mongoose 9+
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Database Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;