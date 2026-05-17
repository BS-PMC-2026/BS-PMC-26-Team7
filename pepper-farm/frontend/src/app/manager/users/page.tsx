import UserRoleTable from "@/components/users/UserRoleTable";

export default function ManagerUsersPage() {
  return (
    <main className="min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Promote visitors to employees</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <UserRoleTable />
      </div>
    </main>
  );
}