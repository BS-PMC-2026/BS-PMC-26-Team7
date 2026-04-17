import Link from "next/link";

export default function ManagerPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">🌶️ PepperFarm</h1>
          <p className="text-gray-500 text-sm mt-1">Farm Manager Dashboard</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/manager/users"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">👥 User Management</h2>
            <p className="text-sm text-gray-500 mt-1">Promote visitors to employees</p>
          </Link>
          <Link href="/manager/peppers"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🌶️ Peppers</h2>
            <p className="text-sm text-gray-500 mt-1">Manage pepper varieties</p>
          </Link>
          <Link href="/manager/products"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🛒 Products</h2>
            <p className="text-sm text-gray-500 mt-1">View the product catalog</p>
          </Link>
          <Link href="/manager/tasks"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📋 Tasks</h2>
            <p className="text-sm text-gray-500 mt-1">Manage farm tasks</p>
          </Link>
          <Link href="/manager/map"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🗺️ Farm Map</h2>
            <p className="text-sm text-gray-500 mt-1">Update plant locations on map</p>
          </Link>
          <Link href="/manager/reports/open-tasks"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📊 Open Tasks Report</h2>
            <p className="text-sm text-gray-500 mt-1">View all open tasks</p>
          </Link>
        </div>
      </div>
    </main>
  );
}