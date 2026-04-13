import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, BarChart3, HardHat, Building2, Lock } from 'lucide-react';

const PortalSelection = () => {
  const navigate = useNavigate();

  const portals = [
    {
      title: 'Ward Operations',
      subtitle: 'Live Dispatch Queue',
      description: 'Command center for Ward Officers to manage daily civic grievances, route logistics, and verify inspector assessments.',
      // Removed mr-3 and flex-shrink-0 for perfect centering
      icon: <Shield className="w-8 h-8 text-green-600" />, 
      path: '/ward-officer',
      borderColor: 'border-t-green-600',
      btnColor: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
    },
    {
      title: 'City Analytics',
      subtitle: 'Super Admin Portal',
      description: 'City-wide heatmaps, contractor compliance tracking, and predictive AI analytics for infrastructure planning.',
      icon: <BarChart3 className="w-8 h-8 text-blue-600" />,
      path: '/super-admin',
      borderColor: 'border-t-blue-600',
      btnColor: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
    },
    {
      title: 'C&D Contractors',
      subtitle: 'Malba Logistics',
      description: 'Secure manifest system for registered contractors to upload landfill receipts and update bulk-waste clearance status.',
      icon: <HardHat className="w-8 h-8 text-orange-600" />,
      path: '/contractor-portal',
      borderColor: 'border-t-orange-600',
      btnColor: 'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100'
    }
  ];

  return (
    // Changed pt-16 to justify-center to vertically center the entire block on the screen
    <div className="min-h-[calc(100vh-76px)] bg-gray-50 flex flex-col items-center justify-center p-6">

      <div className="text-center mb-10 border-b border-gray-200 pb-6 w-full max-w-5xl">
        <Building2 className="w-10 h-10 text-gray-800 mx-auto mb-3" />
        <h2 className="text-3xl font-extrabold text-gray-800">SpotFix Enterprise Gateway</h2>
        <p className="text-gray-500 mt-1 font-semibold uppercase tracking-wider text-sm">Official Authorized Personnel Access Gateway</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {portals.map((portal, index) => (
          <div 
            key={index}
            onClick={() => navigate(portal.path)} 
            className={`bg-white rounded-xl shadow-sm border border-gray-200 border-t-4 ${portal.borderColor} p-6 cursor-pointer hover:shadow-md transition-all flex flex-col`}
          >
            {/* Changed from flex-row (items-center) to flex-col to stack icon and text */}
            <div className="flex flex-col items-center text-center mb-4 border-b border-gray-100 pb-4">
              <div className="mb-3">{portal.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">{portal.title}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase">{portal.subtitle}</p>
              </div>
            </div>
            
            {/* Added text-center here */}
            <p className="text-gray-600 text-sm mb-6 flex-1 leading-relaxed text-center">
              {portal.description}
            </p>
            
            <div className={`flex items-center text-sm font-bold w-full p-2.5 justify-center rounded-lg border transition-colors ${portal.btnColor}`}>
              <Lock className="w-4 h-4 mr-2" /> Access Node
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default PortalSelection;