import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from '@/components/auth/LoginForm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

global.fetch = jest.fn();

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
  });

  it('renders login button', () => {
    render(<LoginForm />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders register link', () => {
    render(<LoginForm />);
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('shows error when submitting empty form', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByText('Email and password are required.')).toBeInTheDocument();
    });
  });

  it('shows error on wrong password', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:   false,
      json: async () => ({ detail: 'Invalid email or password.' }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'),
      { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  it('disables submit and fields while login is pending', async () => {
    let resolveLogin: (value: unknown) => void = () => {};
    (fetch as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    render(<LoginForm />);
    const email = screen.getByPlaceholderText('your@email.com');
    const password = screen.getByPlaceholderText('Your password');
    fireEvent.change(email, { target: { value: 'test@farm.com' } });
    fireEvent.change(password, { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByRole('button')).toBeDisabled();
    expect(email).toBeDisabled();
    expect(password).toBeDisabled();

    resolveLogin({
      ok: false,
      json: async () => ({ detail: 'Invalid email or password.' }),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login/i })).not.toBeDisabled();
    });
  });

  it('redirects to /visitor after Visitor login', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        accessToken: 'tok123',
        tokenType:   'bearer',
        role:        'Visitor',
        fullName:    'Test User',
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/visitor');
    });
  });

  it('redirects to /manager after FarmManager login', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        accessToken: 'tok456',
        tokenType:   'bearer',
        role:        'FarmManager',
        fullName:    'Manager User',
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'mgr@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/manager');
    });
  });

  it('redirects to /worker after Worker login', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        accessToken: 'tok789',
        tokenType:   'bearer',
        role:        'Worker',
        fullName:    'Worker User',
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'w@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/worker');
    });
  });

  it('shows network error when fetch fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText('Network error — please try again.')).toBeInTheDocument();
    });
  });
});
