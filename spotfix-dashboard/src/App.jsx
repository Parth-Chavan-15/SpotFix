import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import WardOfficerDashboard from './pages/WardOfficerDashboard';
import CallCenterIntake from './pages/CallCenterIntake';
import PortalSelection from './pages/PortalSelection'; // NEW IMPORT
import ContractorPortal from './pages/ContractorPortal';

const SuperAdminPortal = () => <div className="p-10 text-2xl font-bold">🗺️ Super Admin Heatmaps & Analytics</div>;

// Helper component to manage the dynamic Navbar
const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate(); // NEW: Hook for the logout button

  // Dynamically set the title based on the route
  let activeTabName = "Enterprise Hub";
  if (location.pathname === '/') activeTabName = "Access Gateway";
  else if (location.pathname === '/ward-officer') activeTabName = "Ward Dispatch Queue";
  else if (location.pathname === '/super-admin') activeTabName = "City Analytics Dashboard";
  else if (location.pathname === '/contractor-portal') activeTabName = "C&D Contractors Portal";
  else if (location.pathname === '/1916-portal') activeTabName = "1916 Centralized Intake";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-[#0f172a] text-white p-4 shadow-lg flex justify-between items-center px-8 border-b-[3px] border-green-500">
        <div className="flex items-center space-x-6">
           <h1 
             onClick={() => navigate('/')} 
             className="text-2xl font-black tracking-wider text-green-400 cursor-pointer hover:opacity-80 transition-opacity"
           >
             Spot<span className="text-white">Fix</span>
           </h1>
           <span className="text-sm font-bold text-slate-300 border-l-2 border-slate-700 pl-6 py-1 tracking-widest uppercase">
             {activeTabName}
           </span>
        </div>
        
        {/* CRITICAL FIX: Only show the Logout button if the user is NOT on the gateway page */}
        {location.pathname !== '/' && (
          <button 
            onClick={() => navigate('/')} 
            className="text-xs font-bold text-slate-300 hover:text-white transition-all border border-slate-600 px-5 py-2 rounded-md hover:bg-slate-800 hover:border-slate-400 uppercase tracking-wider shadow-sm"
          >
            Logout Session
          </button>
        )}
      </nav>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* CRITICAL FIX: Base URL now directly loads the PortalSelection component */}
          <Route path="/" element={<PortalSelection />} />
          <Route path="/ward-officer" element={<WardOfficerDashboard />} />
          <Route path="/super-admin" element={<SuperAdminPortal />} />
          <Route path="/contractor-portal" element={<ContractorPortal />} />
          <Route path="/1916-portal" element={<CallCenterIntake />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;