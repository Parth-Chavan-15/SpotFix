const admin = require('firebase-admin');
const serviceAccount = require('../config/firebaseServiceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const protectRoute = async (req, res, next) => {
    // CRITICAL FIX: Bypass Firebase Auth for the internal 1916 Call Center Portal
    if (req.body && req.body.source === 'Call') {
        return next(); 
    }

    // Fail-safe early return pattern
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken; 
        return next(); // Successfully passed to controller
    } catch (error) {
        console.error('Firebase Auth Error:', error.message);
        return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
    }
};

module.exports = { protectRoute };