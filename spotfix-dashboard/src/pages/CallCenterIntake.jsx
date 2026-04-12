import React, { useState } from 'react';
import axios from 'axios';
import { PhoneCall, Send, CheckCircle, XCircle, AlertTriangle, MapPin } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

const CallCenterIntake = () => {
  const [formData, setFormData] = useState({
    citizenPhone: '9876543210', 
    wasteCategory: 'Organic / Wet Waste',
    latitude: '', 
    longitude: '' 
  });
  const [status, setStatus] = useState({ message: '', type: '' }); // type can be 'success', 'error', or 'warning'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.citizenPhone.length !== 10) {
        setStatus({ message: 'Phone number must be exactly 10 digits.', type: 'error' });
        return;
    }
    setStatus({ message: 'Routing to Command Center...', type: '' });

    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        source: 'Call', 
        evidenceImageUrls: [] 
      };

      const res = await axios.post(`${API_BASE_URL}/tickets`, payload);
      if (res.status === 201) {
        setStatus({ message: `Success: SMS Confirmation sent. Ticket mapped & routed to local Ward.`, type: 'success' });
      }
    } catch (error) {
      // CRITICAL FIX: Catch the 409 Merge and make it ORANGE!
      if (error.response && error.response.status === 409) {
        setStatus({ message: error.response.data.message, type: 'warning' });
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to connect to backend server.';
        setStatus({ message: errorMsg, type: 'error' });
      }
    }
  };

  const handlePhoneChange = (e) => {
      const onlyNums = e.target.value.replace(/[^0-9]/g, '');
      if (onlyNums.length <= 10) setFormData({...formData, citizenPhone: onlyNums});
  };

  return (
    <div className="min-h-[calc(100vh-76px)] bg-gray-50 flex items-start justify-center pt-16 p-6">
      <div className="bg-white rounded-xl shadow-md w-full max-w-2xl border-t-4 border-blue-600 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center space-x-3">
          <PhoneCall className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">1916 Centralized Intake</h2>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Official Operator Terminal</p>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Caller Mobile Number</label>
              <div className="flex shadow-sm">
                <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-500 font-bold text-sm">
                  +91
                </span>
                <input 
                  type="tel" required maxLength={10} placeholder="9876543210"
                  value={formData.citizenPhone} onChange={handlePhoneChange}
                  className="flex-1 p-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-gray-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Complaint Category</label>
              <select 
                value={formData.wasteCategory} onChange={(e) => setFormData({...formData, wasteCategory: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 bg-white"
              >
                <option>Organic / Wet Waste</option>
                <option>Plastic / Dry Waste</option>
                <option>E-Waste</option>
                <option>Hazardous Waste</option>
                <option>Mixed Garbage</option>
                <option>Illegal Malba Dump</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-red-500"/> Latitude
                </label>
                <input type="text" required value={formData.latitude} onChange={(e) => setFormData({...formData, latitude: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-gray-50 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-red-500"/> Longitude
                </label>
                <input type="text" required value={formData.longitude} onChange={(e) => setFormData({...formData, longitude: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-gray-50 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="pt-4">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors shadow-md">
                  <Send className="w-5 h-5 mr-2" /> Forward to Ward Queue
                </button>
            </div>
          </form>

          {status.message && (
            <div className={`mt-6 p-4 rounded-lg flex items-start border ${
              status.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 
              status.type === 'warning' ? 'bg-orange-50 text-orange-800 border-orange-300' :
              'bg-green-50 text-green-800 border-green-200'
            }`}>
              {status.type === 'error' && <XCircle className="w-5 h-5 mr-2 flex-shrink-0 text-red-500" />}
              {status.type === 'warning' && <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 text-orange-500" />}
              {status.type === 'success' && <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 text-green-500" />}
              <span className="font-semibold text-sm">{status.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallCenterIntake;