import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, Smartphone, MessageSquare, Phone, Radio, MapPin, CheckCircle, XCircle, Clock, ClipboardList, Truck, Trash2, HardHat } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api'; 

const WardOfficerDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null); 
  
  // NEW: Master Toggle (General vs Malba)
  const [mainCategory, setMainCategory] = useState('general');
  // NEW: 5-Stage Pipeline Tabs
  const [activeTab, setActiveTab] = useState('inbox');
  
  const [dispatchModal, setDispatchModal] = useState({ isOpen: false, ticketId: null, truckType: 'Mini Tipper (Narrow Streets)' });
  
  // NEW: Mock data for Contractor Approvals
  const [pendingContracts, setPendingContracts] = useState([
    { id: 'PROJ-993', company: 'L&T Infrastructure', site: 'Bandra Coastal Road', volume: 12000 }
  ]);

  useEffect(() => {
    fetchTickets(); 
    const interval = setInterval(fetchTickets, 3000); 
    return () => clearInterval(interval); 
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/tickets`);
      const activeTickets = res.data.data.filter(t => 
        ['Ticket Raised', 'Under Authority Review', 'Verification Pending', 'Field Verified', 'Logistics Assigned', 'Resolved'].includes(t.status)
      );
      setTickets(activeTickets);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setLoading(false);
    }
  };

  const updateTicketStatus = async (id, newStatus, payload = {}) => {
    try {
      await axios.put(`${API_BASE_URL}/tickets/${id}`, { status: newStatus, ...payload });
      fetchTickets(); 
    } catch (error) {
      alert('Failed to update ticket.');
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'Twitter': return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case 'Call': return <Phone className="w-5 h-5 text-green-500" />;
      case 'IoT': return <Radio className="w-5 h-5 text-purple-500" />;
      default: return <Smartphone className="w-5 h-5 text-gray-600" />;
    }
  };

  // 1. FILTER BY MAIN CATEGORY (General vs Malba)
  const filteredByMain = tickets.filter(t => {
    const isMalba = t.wasteCategory.includes('Malba') || t.wasteCategory.includes('Truck');
    return mainCategory === 'malba' ? isMalba : !isMalba;
  });

  // 2. FILTER BY WORKFLOW TAB
  const inboxTickets = filteredByMain.filter(t => t.status === 'Ticket Raised' || t.status === 'Under Authority Review');
  const pendingTickets = filteredByMain.filter(t => t.status === 'Verification Pending');
  const verifiedTickets = filteredByMain.filter(t => t.status === 'Field Verified');
  const inCleaningTickets = filteredByMain.filter(t => t.status === 'Logistics Assigned'); 
  const resolvedTickets = filteredByMain.filter(t => t.status === 'Resolved');

  const displayTickets = activeTab === 'inbox' ? inboxTickets 
                       : activeTab === 'pending' ? pendingTickets 
                       : activeTab === 'verified' ? verifiedTickets 
                       : activeTab === 'cleaning' ? inCleaningTickets
                       : resolvedTickets;

  // 3. GROUPING LOGIC FOR MALBA
  const groupedMalba = displayTickets.reduce((acc, ticket) => {
    const groupId = ticket.malbaGroupId || 'ungrouped';
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(ticket);
    return acc;
  }, {});

  if (loading) return <div className="p-10 text-center text-xl font-bold text-gray-600">Loading Command Center...</div>;

  // REUSABLE UI: Individual Ticket Card
  const renderTicketCard = (ticket) => {
    let appCount = ticket.source === 'App' ? 1 : 0;
    let callCount = ticket.source === 'Call' ? 1 : 0;
    let twitterCount = ticket.source === 'Twitter' ? 1 : 0; // NEW
    
    if (ticket.upvoters && ticket.upvoters.length > 0) {
        ticket.upvoters.forEach(u => {
            if (u.source === 'App') appCount++;
            if (u.source === 'Call') callCount++;
            if (u.source === 'Twitter') twitterCount++; // NEW
        });
    }

    return (
      <div key={ticket._id} className={`bg-white rounded-xl shadow-md overflow-hidden border-t-4 ${mainCategory === 'malba' ? 'border-brown-600' : 'border-green-600'} mb-6`}>
        <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50">
          <div className="flex items-center space-x-2">
            {getSourceIcon(ticket.source)}
            <span className="font-bold text-gray-800">{ticket.wasteCategory}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold px-2 py-1 bg-gray-200 text-gray-800 rounded-full flex items-center">
               {ticket.status}
            </span>
            {ticket.upvoteCount > 1 && (
              <span className="mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                🔥 {ticket.upvoteCount} Citizens Reported
              </span>
            )}
          </div>
        </div>

        <div className="flex overflow-x-auto p-4 space-x-3 bg-gray-100 hide-scrollbar">
          {ticket.status === 'Resolved' && <div className="flex items-center rotate-180" style={{ writingMode: 'vertical-rl' }}><span className="text-xs font-bold text-red-500 uppercase tracking-widest">Before</span></div>}
          {ticket.evidenceImageUrls && ticket.evidenceImageUrls.length > 0 ? (
            ticket.evidenceImageUrls.map((img, idx) => (
              <img key={`ev-${idx}`} src={img} onClick={() => setSelectedImage(img)} className="h-32 w-32 object-cover rounded-lg border border-gray-300 shadow-sm flex-shrink-0 cursor-pointer" alt="Evidence" />
            ))
          ) : <div className="h-32 w-32 flex items-center justify-center bg-gray-200 rounded-lg text-gray-500">No Image</div>}

          {ticket.status === 'Resolved' && ticket.resolutionImageUrls && ticket.resolutionImageUrls.length > 0 && (
            <>
              <div className="flex items-center rotate-180 border-l-2 border-gray-300 pl-2 ml-2" style={{ writingMode: 'vertical-rl' }}><span className="text-xs font-bold text-green-500 uppercase tracking-widest">After</span></div>
              {ticket.resolutionImageUrls.map((img, idx) => (
                <img key={`res-${idx}`} src={img} onClick={() => setSelectedImage(img)} className="h-32 w-32 object-cover rounded-lg border border-green-500 shadow-md flex-shrink-0 cursor-pointer border-4" alt="Resolution" />
              ))}
            </>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start text-sm text-gray-600 mb-4">
            <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-red-500" />
            <p>Lat: {ticket.location.coordinates[1].toFixed(5)}, Lng: {ticket.location.coordinates[0].toFixed(5)}</p>
          </div>

          {ticket.status === 'Field Verified' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800 font-bold uppercase mb-1">Inspector's Assessment:</p>
              <p className="text-sm text-gray-800 italic">"{ticket.inspectorNotes}"</p>
            </div>
          )}
          
          {ticket.status === 'Logistics Assigned' && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs text-orange-800 font-bold uppercase mb-1">Active Dispatch Details:</p>
              <p className="text-sm text-gray-800 italic">"{ticket.inspectorNotes.split('[SYSTEM ROUTING]:')[1] || 'Crew dispatched.'}"</p>
            </div>
          )}

          {/* CRITICAL FIX: This is the Omnichannel Breakdown UI that was missing! */}
          <div className="mb-5 flex items-center justify-between border-t border-b border-gray-100 py-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Complaint Sources:</span>
            <div className="flex space-x-3">
               <span className={`flex items-center text-sm font-bold ${appCount > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                 <Smartphone className="w-4 h-4 mr-1" /> {appCount}
               </span>
               <span className={`flex items-center text-sm font-bold ${callCount > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                 <Phone className="w-4 h-4 mr-1" /> {callCount}
               </span>
               {/* NEW TWITTER BADGE (Using safe MessageSquare icon) */}
               <span className={`flex items-center text-sm font-bold ${twitterCount > 0 ? 'text-sky-500' : 'text-gray-300'}`}>
                 <MessageSquare className="w-4 h-4 mr-1" /> {twitterCount}
               </span>
            </div>
          </div>

          <div className="mt-4">
            {activeTab === 'inbox' && (
              <button onClick={() => updateTicketStatus(ticket._id, 'Verification Pending')} className="w-full flex items-center justify-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                <MapPin className="w-4 h-4 mr-2" /> Assign to Site Inspector
              </button>
            )}
            {activeTab === 'pending' && (
              <div className="w-full text-center p-3 bg-gray-100 text-gray-600 rounded-lg font-semibold flex items-center justify-center">
                <Clock className="w-4 h-4 mr-2 animate-pulse" /> Awaiting Inspector Assessment...
              </div>
            )}
            {activeTab === 'cleaning' && (
              <div className="w-full text-center p-3 bg-orange-100 text-orange-700 border border-orange-300 rounded-lg font-semibold flex items-center justify-center">
                <Truck className="w-4 h-4 mr-2 animate-bounce" /> Logistics Crew Currently On-Site
              </div>
            )}
            {activeTab === 'verified' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDispatchModal({ isOpen: true, ticketId: ticket._id, truckType: 'Mini Tipper (Narrow Streets)' })} className="flex items-center justify-center py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
                  <Truck className="w-4 h-4 mr-2" /> Assign Truck & Dispatch
                </button>
                <button onClick={() => { const reason = window.prompt("Reason for rejection:"); if (reason) updateTicketStatus(ticket._id, 'Invalid Report', { rejectionReason: reason }); }} className="flex items-center justify-center py-2.5 bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-700 rounded-lg font-semibold transition-colors">
                  <XCircle className="w-4 h-4 mr-2" /> Reject Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-800">K/East Ward Operations Queue</h2>
          <p className="text-gray-500 mt-1">Omnichannel Live Dispatch System</p>
        </div>
        
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1 space-x-1">
          <button onClick={() => { setMainCategory('general'); setActiveTab('inbox'); }} className={`flex items-center px-4 py-2 rounded-md font-bold transition-all ${mainCategory === 'general' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Trash2 className="w-5 h-5 mr-2" /> General Garbage
          </button>
          <button onClick={() => { setMainCategory('malba'); setActiveTab('inbox'); }} className={`flex items-center px-4 py-2 rounded-md font-bold transition-all ${mainCategory === 'malba' ? 'bg-brown-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`} style={{ backgroundColor: mainCategory === 'malba' ? '#78350f' : '' }}>
            <HardHat className="w-5 h-5 mr-2" /> C&D Grievances
          </button>
          {/* NEW: Landfill Approvals Tab */}
          <button onClick={() => setMainCategory('approvals')} className={`flex items-center px-4 py-2 rounded-md font-bold transition-all border-l border-gray-200 ml-2 pl-3 ${mainCategory === 'approvals' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'}`}>
            <ClipboardList className="w-5 h-5 mr-2" /> Landfill Allocations
          </button>
        </div>
      </div>

      {mainCategory !== 'approvals' ? (
        <>
          <div className="flex flex-wrap gap-3 mb-8 border-b pb-4">
            <button onClick={() => setActiveTab('inbox')} className={`flex items-center px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'inbox' ? 'bg-blue-100 text-blue-800 border-2 border-blue-500' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              <ShieldAlert className="w-4 h-4 mr-2" /> Inbox ({inboxTickets.length})
            </button>
            <button onClick={() => setActiveTab('pending')} className={`flex items-center px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'pending' ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              <Clock className="w-4 h-4 mr-2" /> Pending Assessment ({pendingTickets.length})
            </button>
            <button onClick={() => setActiveTab('verified')} className={`flex items-center px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'verified' ? 'bg-red-100 text-red-800 border-2 border-red-500' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              <ClipboardList className="w-4 h-4 mr-2" /> Action Required ({verifiedTickets.length})
            </button>
            <button onClick={() => setActiveTab('cleaning')} className={`flex items-center px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'cleaning' ? 'bg-orange-100 text-orange-800 border-2 border-orange-500' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              <Truck className="w-4 h-4 mr-2" /> In Cleaning ({inCleaningTickets.length})
            </button>
            <button onClick={() => setActiveTab('resolved')} className={`flex items-center px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'resolved' ? 'bg-gray-800 text-white border-2 border-gray-900' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
              <CheckCircle className="w-4 h-4 mr-2" /> Archive / Resolved ({resolvedTickets.length})
            </button>
          </div>

          {mainCategory === 'general' || displayTickets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayTickets.map(renderTicketCard)}
              {displayTickets.length === 0 && (
                <div className="col-span-full p-12 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-800">Queue Cleared</h3>
                  <p className="text-gray-500 mt-2">No tickets currently in this stage.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMalba).map(([groupId, groupTickets]) => (
                <div key={groupId} className="bg-red-50 rounded-2xl border-2 border-red-200 p-6 shadow-sm relative">
                  <div className="absolute -top-4 left-6 bg-red-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-md flex items-center">
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    50m Incident Zone Detected (Group: {groupId.slice(-6)})
                  </div>
                  <p className="text-red-800 font-semibold mb-4 mt-2">The system has clustered {groupTickets.length} report(s) originating from the same physical hotspot.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupTickets.map(renderTicketCard)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* NEW: LANDFILL ALLOCATIONS UI */
        <div className="max-w-4xl mx-auto">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 flex items-start">
            <ShieldAlert className="w-6 h-6 text-indigo-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-indigo-900 mb-1">Contractor Approval Required</h3>
              <p className="text-sm text-indigo-800">Assign a specific landfill based on current daily capacities before authorizing C&D dumping manifests.</p>
            </div>
          </div>

          <div className="space-y-4">
            {pendingContracts.map(contract => (
              <div key={contract.id} className="bg-white border border-gray-200 rounded-xl p-6 flex justify-between items-center shadow-sm">
                <div>
                  <h4 className="text-lg font-extrabold text-gray-800">{contract.company}</h4>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Site: {contract.site} (ID: {contract.id})</p>
                  <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-md text-sm border border-amber-200">
                    Requested Volume: {contract.volume} Tons
                  </span>
                </div>
                <div className="flex flex-col items-end w-72">
                  <label className="text-xs font-bold text-gray-500 mb-1 uppercase">Assign Landfill Target</label>
                  <select className="w-full p-2 border border-gray-300 rounded-lg mb-3 outline-none focus:border-indigo-500 text-sm font-semibold">
                    <option>Deonar (Capacity: 85%)</option>
                    <option>Mulund (Capacity: 30%)</option>
                    <option>Kanjurmarg (Capacity: 45%)</option>
                  </select>
                  <button 
                    onClick={() => {
                      setPendingContracts(pendingContracts.filter(c => c.id !== contract.id));
                      alert(`Contract ${contract.id} Approved and linked to selected landfill.`);
                    }} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Authorize & Sign Contract
                  </button>
                </div>
              </div>
            ))}
            {pendingContracts.length === 0 && (
              <div className="text-center p-10 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-bold">No pending allocations.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-all"
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl scale-100" alt="Enlarged Evidence" />
          <button className="absolute top-6 right-6 text-white hover:text-red-400">
            <XCircle className="w-10 h-10" />
          </button>
        </div>
      )}

      {dispatchModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <Truck className="w-6 h-6 text-green-600 mr-2" />
              <h3 className="text-xl font-bold text-gray-800">Assign Logistics Crew</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Select the appropriate vehicle type. The system will auto-route to the nearest available crew.</p>
            <select 
              value={dispatchModal.truckType}
              onChange={(e) => setDispatchModal({ ...dispatchModal, truckType: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg mb-6 font-semibold text-gray-700 focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="Mini Tipper (Narrow Streets)">Mini Tipper (Narrow Streets)</option>
              <option value="Refuse Compactor (Standard)">Refuse Compactor (Standard)</option>
              <option value="Open Dumper (Heavy Malba)">Open Dumper (Heavy Malba)</option>
              <option value="JCB Excavator (Severe Dump)">JCB Excavator (Severe Dump)</option>
            </select>
            <div className="flex space-x-3">
              <button onClick={() => setDispatchModal({ isOpen: false, ticketId: null, truckType: 'Mini Tipper (Narrow Streets)' })} className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">Cancel</button>
              <button 
                onClick={() => {
                  updateTicketStatus(dispatchModal.ticketId, 'Logistics Assigned', { assignedTruck: dispatchModal.truckType });
                  setDispatchModal({ isOpen: false, ticketId: null, truckType: 'Mini Tipper (Narrow Streets)' });
                }}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardOfficerDashboard;