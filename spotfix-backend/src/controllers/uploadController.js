const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.generateSignature = (req, res) => {
    try {
        const timestamp = Math.round((new Date).getTime() / 1000);
        // CRITICAL FIX: Reads folder from Flutter, defaults to evidence if not provided
        const folderName = req.query.folder || 'spotfix_evidence'; 

        const signature = cloudinary.utils.api_sign_request({
            timestamp: timestamp, folder: folderName
        }, process.env.CLOUDINARY_API_SECRET);

        res.status(200).json({ success: true, timestamp, signature, cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to generate signature' });
    }
};