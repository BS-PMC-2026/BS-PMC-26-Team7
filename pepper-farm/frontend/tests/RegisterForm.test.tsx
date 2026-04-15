import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterForm from '@/components/auth/RegisterForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

global.fetch = jest.fn();

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<RegisterForm />);
    expect(screen.getByPlaceholderText('Your full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min. 6 characters')).toBeInTheDocument();
  });

  it('renders register button', () => {
    render(<RegisterForm />);
    expect(screen.getByText('Register')).toBeInTheDocument();
  });

  it('renders login link', () => {
    render(<RegisterForm />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('shows validation error when full name is empty', async () => {
    render(<RegisterForm />);
    fireEvent.click(screen.getByText('Register'));
    await waitFor(() => {
      expect(screen.getByText('Full name is required.')).toBeInTheDocument();
    });
  });

  it('shows validation error when email is invalid', async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),
      { target: { value: 'Test User' } });
    fireEvent.click(screen.getByText('Register'));
    await waitFor(() => {
      expect(screen.getByText('Valid email is required.')).toBeInTheDocument();
    });
  });

  it('shows validation error when password is too short', async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),
      { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'),
      { target: { value: '12' } });
    fireEvent.click(screen.getByText('Register'));
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument();
    });
  });

  it('shows success message after successful registration', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        userId: 1, fullName: 'Test User', email: 'test@farm.com', role: 'Visitor'
      }),
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),
      { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByText('Registration Successful!')).toBeInTheDocument();
    });
  });

  it('shows API error on duplicate email', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:   false,
      json: async () => ({ detail: 'Email already registered.' }),
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),
      { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'dup@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByText('Email already registered.')).toBeInTheDocument();
    });
  });

  it('shows network error when fetch fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),
      { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(screen.getByText('Network error — please try again.')).toBeInTheDocument();
    });
  });
});