exports.scanPlate = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
        
        // Simulating the 1.5 second delay of a real Cloud Vision API call
        setTimeout(() => {
            res.status(200).json({ success: true, plate: "MH 01 AB 1234" });
        }, 1500);
    } catch (error) {
        res.status(500).json({ success: false, message: 'OCR Processing Failed' });
    }
};