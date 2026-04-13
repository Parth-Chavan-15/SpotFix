import React, { useState } from 'react';
import { HardHat, Truck, FileText, AlertTriangle, CheckCircle, Scale, MapPin, Building, Cpu, ShieldCheck, LogOut, UserCircle } from 'lucide-react';

const ContractorPortal = () => {
  // NEW: Internal Authentication State
  const [auth, setAuth] = useState({ isAuthenticated: false, role: null, entityName: '' });
  const [activeTab, setActiveTab] = useState('');
  
  // Mock Data
  const [contracts, setContracts] = useState([
    { id: 'PROJ-992', site: 'Andheri East Metro Site', volume: 5000, status: 'Approved', assignedLandfill: 'Deonar Dumping Ground' }
  ]);

  const [manifests, setManifests] = useState([
    { id: 'MNF-8821', contractId: 'PROJ-992', truck: 'MH-02-EE-7711', origin: 'Andheri East Metro Site', expectedWeight: 4500, status: 'In Transit' }
  ]);

  const [weighbridgeForm, setWeighbridgeForm] = useState({ isOpen: false, manifestId: '', actualWeight: '' });
  const [alert, setAlert] = useState(null);

  const handleLogin = (role, name) => {
    setAuth({ isAuthenticated: true, role, entityName: name });
    setActiveTab(role === 'contractor' ? 'registration' : 'weighbridge');
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, role: null, entityName: '' });
    setAlert(null);
  };

  const handleWeighbridgeSubmit = (e) => {
    e.preventDefault();
    const manifest = manifests.find(m => m.id === weighbridgeForm.manifestId);
    const actual = parseFloat(weighbridgeForm.actualWeight);
    const expected = manifest.expectedWeight;
    const deficitPercentage = ((expected - actual) / expected) * 100;

    if (deficitPercentage > 5) {
      setAlert({ type: 'danger', message: `VOLUMETRIC AUDIT FAILED: Weight deficit of ${expected - actual}kg (${deficitPercentage.toFixed(1)}%) detected. IoT Telemetry suggests illegal mid-route dump. Alert routed to Ward Officer.`});
    } else {
      setAlert({ type: 'success', message: `AUDIT PASSED: ${actual}kg unloaded successfully. Manifest digitally signed and closed.`});
    }
    setManifests(manifests.map(m => m.id === manifest.id ? { ...m, status: 'Resolved' } : m));
    setWeighbridgeForm({ isOpen: false, manifestId: '', actualWeight: '' });
  };

  // --------------------------------------------------------
  // VIEW 1: LOGIN GATEWAY
  // --------------------------------------------------------
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-76px)] bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-2xl w-full">
          <div className="text-center mb-10 border-b border-slate-100 pb-8">
            <HardHat className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h2 className="text-3xl font-extrabold text-slate-800">C&D Logistics Network</h2>
            <p className="text-slate-500 font-semibold mt-2 uppercase tracking-widest text-sm">Secure Authentication Required</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => handleLogin('contractor', 'L&T Infrastructure')} className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 transition-all group">
              <Building className="w-10 h-10 text-slate-400 group-hover:text-orange-600 mb-3 transition-colors" />
              <span className="font-bold text-slate-800 text-lg">Contractor Login</span>
              <span className="text-xs font-semibold text-slate-500 mt-1">Fleet & Manifests</span>
            </button>

            <button onClick={() => handleLogin('landfill', 'Deonar Checkpoint Authority')} className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
              <ShieldCheck className="w-10 h-10 text-slate-400 group-hover:text-emerald-600 mb-3 transition-colors" />
              <span className="font-bold text-slate-800 text-lg">Landfill Official</span>
              <span className="text-xs font-semibold text-slate-500 mt-1">Weighbridge Audits</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // VIEW 2 & 3: AUTHENTICATED DASHBOARDS
  // --------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-76px)] bg-slate-50 p-8">
      {/* Dynamic Header */}
      <div className="max-w-6xl mx-auto mb-8 flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            {auth.role === 'contractor' ? <Building className="w-8 h-8 text-orange-600" /> : <ShieldCheck className="w-8 h-8 text-emerald-600" />}
            <h2 className="text-3xl font-extrabold text-slate-800">
              {auth.role === 'contractor' ? 'Contractor Operations' : 'Landfill Operations'}
            </h2>
          </div>
          <p className="text-slate-500 font-semibold uppercase tracking-wider text-sm flex items-center">
            <UserCircle className="w-4 h-4 mr-1.5" /> Logged in as: <strong className="ml-1 text-slate-800">{auth.entityName}</strong>
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Navigation dynamically changes based on role */}
          {auth.role === 'contractor' && (
            <div className="flex space-x-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={() => setActiveTab('registration')} className={`px-5 py-2 rounded-lg font-bold transition-colors ${activeTab === 'registration' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Fleet Integration</button>
              <button onClick={() => setActiveTab('contracts')} className={`px-5 py-2 rounded-lg font-bold transition-colors ${activeTab === 'contracts' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Disposal Contracts</button>
              <button onClick={() => setActiveTab('manifests')} className={`px-5 py-2 rounded-lg font-bold transition-colors ${activeTab === 'manifests' ? 'bg-orange-100 text-orange-800' : 'text-slate-500 hover:bg-slate-100'}`}>Generate Manifest</button>
            </div>
          )}
          {auth.role === 'landfill' && (
            <div className="flex space-x-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
              <button className="px-5 py-2 rounded-lg font-bold transition-colors bg-emerald-100 text-emerald-800">Incoming Weighbridge Queue</button>
            </div>
          )}

          <button onClick={handleLogout} className="flex items-center justify-center p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors tooltip" title="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Global Alert System */}
        {alert && (
          <div className={`mb-6 p-4 rounded-xl border-l-4 flex items-start shadow-sm ${alert.type === 'danger' ? 'bg-red-50 border-red-600 text-red-900' : 'bg-emerald-50 border-emerald-600 text-emerald-900'}`}>
            {alert.type === 'danger' ? <AlertTriangle className="w-6 h-6 mr-3 text-red-600 flex-shrink-0" /> : <CheckCircle className="w-6 h-6 mr-3 text-emerald-600 flex-shrink-0" />}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wide mb-1">{alert.type === 'danger' ? 'Discrepancy Detected' : 'Compliance Verified'}</h4>
              <p className="font-medium text-sm">{alert.message}</p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ */}
        {/* CONTRACTOR ROLE TABS                               */}
        {/* ------------------------------------------------ */}

        {auth.role === 'contractor' && activeTab === 'registration' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row border-t-4 border-t-orange-500">
            {/* Left: Enhanced Registration Form */}
            <div className="md:w-1/2 p-8 border-r border-slate-100 bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center"><Truck className="w-5 h-5 mr-2 text-orange-500"/> Register Fleet Vehicle</h3>
              <p className="text-sm text-slate-500 mb-6 border-b border-slate-200 pb-4">Integrate vehicle RTO details with SpotFix IoT Telemetry.</p>
              
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Vehicle Registered Successfully!'); }}>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">License Plate (RTO)</label>
                  <input type="text" required placeholder="MH-02-EE-7711" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-orange-500 font-mono text-sm uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">RC Book Number</label>
                    <input type="text" required placeholder="RC-8829103" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-orange-500 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Vehicle Class</label>
                    <select className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-orange-500 text-sm">
                      <option>HGV (Heavy Goods)</option>
                      <option>LCV (Light Commercial)</option>
                    </select>
                  </div>
                </div>
                <div className="p-4 bg-orange-100/50 border border-orange-200 rounded-lg mt-4">
                  <label className="block text-xs font-bold text-orange-800 mb-1 uppercase tracking-wider flex items-center">
                    <Cpu className="w-4 h-4 mr-1" /> SpotFix IoT Sensor ID (Load Cell)
                  </label>
                  <input type="text" required placeholder="SFX-IOT-0001" className="w-full p-2.5 border border-orange-300 rounded-lg outline-none focus:border-orange-500 font-mono text-sm bg-white" />
                  <p className="text-xs text-orange-600 mt-2 font-medium">This unique ID links the truck's physical weight drops to the backend ledger.</p>
                </div>
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg mt-4 transition-colors">Register Vehicle to Fleet</button>
              </form>
            </div>
            
            {/* Right: Active Fleet List */}
            <div className="md:w-1/2 p-8">
               <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Active Authenticated Fleet</h3>
               <div className="space-y-3">
                  <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-800 text-lg">MH-04-FD-9922</span>
                      <p className="text-xs text-emerald-600 font-bold uppercase mt-1 flex items-center"><Cpu className="w-3 h-3 mr-1"/> SFX-IOT-4091 Linked</p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  </div>
               </div>
            </div>
          </div>
        )}

        {auth.role === 'contractor' && activeTab === 'contracts' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit border-t-4 border-t-slate-800">
             <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-3 flex items-center"><Building className="w-5 h-5 mr-2 text-slate-500"/> Request New C&D Clearance Site</h3>
             <form className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Site Location Address</label>
                  <input type="text" placeholder="e.g., Juhu Tara Road" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Total Expected Volume (Tons)</label>
                  <input type="number" placeholder="e.g., 15000" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-slate-500 text-sm" />
                </div>
                <div className="flex items-end">
                  <button type="button" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg transition-colors">Submit to Ward for Approval</button>
                </div>
              </form>
          </div>
        )}

        {auth.role === 'contractor' && activeTab === 'manifests' && (
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 border-t-4 border-t-orange-500 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center"><FileText className="w-5 h-5 mr-2 text-orange-500"/> Generate Dispatch Manifest</h3>
              <p className="text-sm text-slate-500 mb-6 border-b border-slate-200 pb-4">Log a truck leaving the construction site. This alerts the assigned landfill of incoming debris.</p>
              
              <form className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Select Approved Contract</label>
                  <select className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 font-semibold text-slate-700 outline-none focus:border-orange-500">
                    {contracts.filter(c => c.status === 'Approved').map(c => <option key={c.id}>{c.site} ({c.id})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Assigned Fleet Truck</label>
                    <select className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 font-mono text-sm outline-none focus:border-orange-500">
                      <option>MH-04-FD-9922</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Loaded Weight (kg)</label>
                    <input type="number" placeholder="5000" className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-orange-500 font-mono text-sm" />
                  </div>
                </div>
                <button type="button" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 rounded-lg mt-2 shadow-md transition-colors flex justify-center items-center">
                  Sign & Dispatch Manifest
                </button>
              </form>
           </div>
        )}

        {/* ------------------------------------------------ */}
        {/* LANDFILL OFFICIAL ROLE TAB                       */}
        {/* ------------------------------------------------ */}

        {auth.role === 'landfill' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 border-t-4 border-t-emerald-500">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center">
                <Truck className="w-6 h-6 mr-2 text-slate-600" /> Incoming Manifest Queue
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-sm font-bold px-4 py-1.5 rounded-full border border-emerald-200 shadow-sm animate-pulse">
                {manifests.filter(m => m.status === 'In Transit').length} Trucks Arriving
              </span>
            </div>

            <div className="space-y-4">
              {manifests.filter(m => m.status === 'In Transit').map((manifest) => (
                <div key={manifest.id} className="border-2 border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-colors flex justify-between items-center bg-slate-50">
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="font-mono font-bold text-slate-800 text-xl bg-white px-3 py-1 rounded shadow-sm border border-slate-200">{manifest.truck}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: {manifest.id}</span>
                    </div>
                    <div className="flex items-center text-sm text-slate-500 font-medium mt-3">
                      <MapPin className="w-4 h-4 mr-1 text-red-400" /> Origin: {manifest.origin}
                    </div>
                    <div className="flex items-center text-sm text-slate-500 font-medium mt-1">
                      <Scale className="w-4 h-4 mr-1 text-orange-500" /> Declared Origin Weight: <strong className="ml-1 text-slate-800">{manifest.expectedWeight} kg</strong>
                    </div>
                  </div>
                  
                  <button onClick={() => setWeighbridgeForm({ isOpen: true, manifestId: manifest.id, actualWeight: '' })} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center hover:-translate-y-1">
                    <Scale className="w-5 h-5 mr-2" /> Record Drop-Off Weight
                  </button>
                </div>
              ))}
              {manifests.filter(m => m.status === 'In Transit').length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-slate-800">Queue Cleared</h3>
                  <p className="text-slate-500 mt-2">No trucks currently inbound to this landfill.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* WEIGHBRIDGE MODAL (Only Landfill Officials see this) */}
      {weighbridgeForm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-t-8 border-emerald-500">
            <h3 className="text-2xl font-extrabold text-slate-800 mb-1 flex items-center"><Scale className="w-7 h-7 mr-2 text-emerald-600" /> Digital Weighbridge</h3>
            <p className="text-sm font-medium text-slate-500 mb-6 border-b border-slate-100 pb-4">Auditing Manifest: <span className="font-mono text-slate-800 font-bold">{weighbridgeForm.manifestId}</span></p>
            
            <form onSubmit={handleWeighbridgeSubmit}>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Actual Unloaded Weight (kg)</label>
              <input 
                type="number" required autoFocus 
                value={weighbridgeForm.actualWeight} 
                onChange={(e) => setWeighbridgeForm({...weighbridgeForm, actualWeight: e.target.value})} 
                placeholder="Enter weight..." 
                className="w-full p-4 border-2 border-slate-300 rounded-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-2xl font-mono mb-8 transition-all" 
              />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setWeighbridgeForm({isOpen: false})} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-emerald-700 transition-colors">Verify & Seal Audit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractorPortal;