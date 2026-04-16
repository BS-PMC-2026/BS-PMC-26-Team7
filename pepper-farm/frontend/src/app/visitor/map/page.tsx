import FarmMap from '@/components/map/FarmMap';
import PageHeader from '@/components/ui/PageHeader';

export default function FarmMapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="PepperFarm"
            title="Farm Map"
            subtitle="Interactive layout of the farm facility — click any section to learn more"
          />
        </div>
      </div>

      {/* Map */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <FarmMap />
        </div>
      </div>
    </div>
  );
}
