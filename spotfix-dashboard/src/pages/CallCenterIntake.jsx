import React, { useState } from 'react';
import axios from 'axios';
import { PhoneCall, MapPin, Send, CheckCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

const CallCenterIntake = () => {
  const [formData, setFormData] = useState({
    citizenPhone: '',
    wasteCategory: 'Organic / Wet Waste',
    // Defaulting to K/East Ward coordinates for rapid demo testing
    latitude: '19.1136', 
    longitude: '72.8697' 
  });
  const [status, setStatus] = useState({ message: '', isError: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ message: 'Routing to Command Center...', isError: false });

    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        source: 'Call', // Hardcoded for this portal
        evidenceImageUrls: [] // Blank array, backend will assign the placeholder
      };

      const res = await axios.post(`${API_BASE_URL}/tickets`, payload);
      
      if (res.status === 201 || res.status === 409) {
        setStatus({ message: `✅ Success: SMS sent to ${formData.citizenPhone}. Ticket routed to Ward.`, isError: false });
        setFormData({ ...formData, citizenPhone: '' }); // Clear phone for next call
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to connect to server.';
      setStatus({ message: `❌ ${errorMsg}`, isError: true });
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border-t-8 border-blue-600">
        <div className="flex items-center mb-6">
          <PhoneCall className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800">BMC 1916 Portal</h2>
            <p className="text-sm text-gray-500">Centralized Complaint Management</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Caller Mobile Number</label>
            <input 
              type="tel" required placeholder="+91 98765 43210"
              value={formData.citizenPhone} onChange={(e) => setFormData({...formData, citizenPhone: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Complaint Category</label>
            <select 
              value={formData.wasteCategory} onChange={(e) => setFormData({...formData, wasteCategory: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option>Organic / Wet Waste</option>
              <option>Plastic / Dry Waste</option>
              <option>E-Waste</option>
              <option>Hazardous Waste</option>
              <option>Mixed Garbage</option>
              <option>Illegal Malba Dump</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Latitude</label>
              <input type="text" required value={formData.latitude} onChange={(e) => setFormData({...formData, latitude: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Longitude</label>
              <input type="text" required value={formData.longitude} onChange={(e) => setFormData({...formData, longitude: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 outline-none" />
            </div>
          </div>

          <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg flex items-center justify-center transition-colors">
            <Send className="w-5 h-5 mr-2" /> Forward to Ward Office
          </button>
        </form>

        {status.message && (
          <div className={`mt-6 p-4 rounded-lg flex items-start ${status.isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
            {status.isError ? <XCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />}
            <span className="font-semibold text-sm">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallCenterIntake;