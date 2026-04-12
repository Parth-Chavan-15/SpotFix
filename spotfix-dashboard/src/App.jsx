import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WardOfficerDashboard from './pages/WardOfficerDashboard';
import CallCenterIntake from './pages/CallCenterIntake'; // <-- NEW IMPORT

const SuperAdminPortal = () => <div className="p-10 text-2xl font-bold">🗺️ Super Admin Heatmaps & Analytics</div>;
const ContractorPortal = () => <div className="p-10 text-2xl font-bold">🚧 Contractor Registration & Manifests</div>;

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <nav className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center px-8">
          <h1 className="text-2xl font-black tracking-wider text-green-400">Spot<span className="text-white">Fix</span> <span className="text-sm font-normal text-gray-400 ml-2">Enterprise Hub</span></h1>
          <div className="space-x-8 font-semibold text-sm">
            <a href="/ward-officer" className="hover:text-green-400 transition-colors">Ward Dispatch Queue</a>
            <a href="/super-admin" className="hover:text-green-400 transition-colors">City Analytics</a>
            <a href="/contractor-portal" className="hover:text-green-400 transition-colors">C&D Contractors</a>
          </div>
        </nav>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/ward-officer" replace />} />
            <Route path="/ward-officer" element={<WardOfficerDashboard />} />
            <Route path="/super-admin" element={<SuperAdminPortal />} />
            <Route path="/contractor-portal" element={<ContractorPortal />} />
            
            {/* NEW: Hidden from main navbar, accessible only via direct URL */}
            <Route path="/1916-portal" element={<CallCenterIntake />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;