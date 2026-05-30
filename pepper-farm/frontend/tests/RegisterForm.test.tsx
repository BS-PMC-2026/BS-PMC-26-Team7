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

  // US40: email consent checkbox
  it('renders email consent checkbox unchecked by default', () => {
    render(<RegisterForm />);
    const checkbox = screen.getByTestId('email-consent-checkbox') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it('can check and uncheck the email consent checkbox', () => {
    render(<RegisterForm />);
    const checkbox = screen.getByTestId('email-consent-checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('sends emailConsent=false by default to the API', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, json: async () => ({ userId: 1, fullName: 'Test User', email: 'test@farm.com', role: 'Visitor' }),
    });
    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),    { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),    { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Register'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.emailConsent).toBe(false);
  });

  it('sends emailConsent=true when checkbox is checked', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true, json: async () => ({ userId: 2, fullName: 'Opt In', email: 'optin@farm.com', role: 'Visitor' }),
    });
    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),    { target: { value: 'Opt In' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),    { target: { value: 'optin@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByTestId('email-consent-checkbox'));
    fireEvent.click(screen.getByText('Register'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.emailConsent).toBe(true);
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

  // ── Error normalization (prevents React crash on Pydantic array) ──────────

  it('does not crash when API returns Pydantic validation array — shows readable message', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok:     false,
      status: 422,
      json:   async () => ({
        detail: [
          {
            type:  'value_error',
            loc:   ['body', 'password'],
            msg:   'Password must contain at least one digit.',
            input: 'abcdef',
            ctx:   {},
          },
        ],
      }),
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByPlaceholderText('Your full name'),
      { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'),
      { target: { value: 'abcdef' } });
    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      const el = screen.getByText('Password must contain at least one digit.');
      // Critical: must be a plain string, not a React object crash
      expect(typeof el.textContent).toBe('string');
      expect(el).toBeInTheDocument();
    });
  });

  it('falls back to registrationFailed when detail is null', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false, status: 500,
      json: async () => ({ detail: null }),
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
      expect(screen.getByText('Registration failed.')).toBeInTheDocument();
    });
  });

  it('displays a readable string when API 500 returns a plain detail string', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false, status: 500,
      json: async () => ({ detail: 'Unexpected server error.' }),
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
      expect(screen.getByText('Unexpected server error.')).toBeInTheDocument();
    });
  });
});