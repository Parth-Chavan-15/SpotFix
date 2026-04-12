import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import WardOfficerDashboard from './pages/WardOfficerDashboard';
import CallCenterIntake from './pages/CallCenterIntake';

const SuperAdminPortal = () => <div className="p-10 text-2xl font-bold">🗺️ Super Admin Heatmaps & Analytics</div>;
const ContractorPortal = () => <div className="p-10 text-2xl font-bold">🚧 Contractor Registration & Manifests</div>;

// Helper component to manage the dynamic Navbar
const Layout = ({ children }) => {
  const location = useLocation();

  // Dynamically set the title based on the route
  let activeTabName = "Enterprise Hub";
  if (location.pathname === '/ward-officer') activeTabName = "Ward Dispatch Queue";
  else if (location.pathname === '/super-admin') activeTabName = "City Analytics Dashboard";
  else if (location.pathname === '/contractor-portal') activeTabName = "C&D Contractors Portal";
  else if (location.pathname === '/1916-portal') activeTabName = "1916 Centralized Intake";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center px-8">
        <div className="flex items-center space-x-5">
           <h1 className="text-2xl font-black tracking-wider text-green-400">Spot<span className="text-white">Fix</span></h1>
           <span className="text-sm font-semibold text-gray-300 border-l border-gray-600 pl-5 py-1 tracking-wide uppercase">
             {activeTabName}
           </span>
        </div>
        <button 
          onClick={() => alert("Logout logic will redirect to opening screen later!")} 
          className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors border border-red-500/30 px-5 py-2 rounded-lg hover:bg-red-500/10"
        >
          Logout Session
        </button>
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
          <Route path="/" element={<Navigate to="/ward-officer" replace />} />
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