import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import UserRoleTable from '@/components/users/UserRoleTable';
import * as usersService from '@/services/users';

jest.mock('@/services/users');

const mockUsers = [
  { userId: 1, fullName: 'Admin User',   email: 'admin@farm.com',   roleName: 'FarmManager', isActive: true },
  { userId: 2, fullName: 'Guest Visitor', email: 'visitor@farm.com', roleName: 'Visitor',     isActive: true },
  { userId: 3, fullName: 'Field Worker',  email: 'worker@farm.com',  roleName: 'Worker',      isActive: true },
];

describe('UserRoleTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAllUsers as jest.Mock).mockResolvedValue(mockUsers);
  });

  it('renders loading state initially', async () => {
    (usersService.getAllUsers as jest.Mock).mockReturnValue(new Promise(() => {}));
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('renders users table after load', async () => {
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Guest Visitor')).toBeInTheDocument();
    expect(screen.getByText('Field Worker')).toBeInTheDocument();
  });

  it('shows Promote button only for Visitor users', async () => {
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Promote to Employee')).toBeInTheDocument();
    expect(screen.queryAllByText('Promote to Employee')).toHaveLength(1);
  });

  it('shows no action button for FarmManager', async () => {
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
  });

  it('shows success message after promote', async () => {
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    (usersService.promoteUser as jest.Mock).mockResolvedValueOnce({
      userId: 2, fullName: 'Guest Visitor', email: 'visitor@farm.com',
      roleName: 'Worker', isActive: true,
    });

    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Promote to Employee')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText('Promote to Employee')); });

    expect(screen.getByText('User promoted to Worker successfully.')).toBeInTheDocument();
  });

  it('shows empty state when no users', async () => {
    (usersService.getAllUsers as jest.Mock).mockResolvedValueOnce([]);
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('No users found.')).toBeInTheDocument();
  });

  it('shows error when load fails', async () => {
    (usersService.getAllUsers as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Failed to load users.')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
  });

  it('searches users by name', async () => {
    (usersService.searchUsers as jest.Mock).mockResolvedValueOnce([mockUsers[1]]);

    await act(async () => { render(<UserRoleTable />); });
    expect(screen.getByText('Guest Visitor')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Search by name...'),
        { target: { value: 'Guest' } });
    });

    await waitFor(() => {
      expect(usersService.searchUsers).toHaveBeenCalledWith("", "Guest");
    });
  });
});