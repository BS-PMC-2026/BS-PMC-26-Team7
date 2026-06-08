import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PepperSpinnerLoader from '@/components/ui/PepperSpinnerLoader';
import Button from '@/components/ui/Button';
import Loading from '@/app/loading';
import { LoadingProvider, useLoading } from '@/context/LoadingContext';

function Controls() {
  const { isLoading, showLoader, hideLoader, withLoader } = useLoading();
  return (
    <div>
      <span data-testid="loading-state">{String(isLoading)}</span>
      <button onClick={showLoader}>show</button>
      <button onClick={hideLoader}>hide</button>
      <button onClick={() => withLoader(async () => 'ok')}>success</button>
      <button onClick={() => withLoader(async () => { throw new Error('nope'); }).catch(() => undefined)}>
        error
      </button>
    </div>
  );
}

function LinkControls() {
  const { isLoading } = useLoading();
  return (
    <div>
      <span data-testid="link-loading-state">{String(isLoading)}</span>
      <a href="/manager">Manager</a>
      <a href="/?tab=history">Query tab</a>
      <a href="/#section">Hash only</a>
      <a href="https://example.com">External</a>
    </div>
  );
}

describe('US47 loading UX primitives', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the pepper spinner loader', () => {
    render(<PepperSpinnerLoader minDelay={0} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByTestId('pepper-spinner-loader')).toHaveTextContent('Loading.');
  });

  it('animates Loading. / Loading.. / Loading...', () => {
    render(<PepperSpinnerLoader minDelay={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading.');

    act(() => { jest.advanceTimersByTime(450); });
    expect(screen.getByRole('status')).toHaveTextContent('Loading..');

    act(() => { jest.advanceTimersByTime(450); });
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
  });

  it('fullscreen loader uses the unified app background', () => {
    render(<PepperSpinnerLoader minDelay={0} fullscreen />);
    expect(screen.getByRole('status').parentElement).toHaveClass('bg-[#F6F8F4]/65');
    expect(screen.getByRole('status').parentElement).toHaveClass('backdrop-blur-[2px]');
  });

  it('does not render when isLoading is false', () => {
    render(<PepperSpinnerLoader isLoading={false} minDelay={0} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('LoadingProvider reference-counts pending operations', () => {
    render(
      <LoadingProvider>
        <Controls />
      </LoadingProvider>,
    );

    fireEvent.click(screen.getByText('show'));
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByTestId('loading-state')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('hide'));
    expect(screen.getByTestId('loading-state')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('hide'));
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
  });

  it('withLoader hides loader on success', async () => {
    render(
      <LoadingProvider>
        <Controls />
      </LoadingProvider>,
    );

    fireEvent.click(screen.getByText('success'));
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    });
  });

  it('withLoader hides loader on error', async () => {
    render(
      <LoadingProvider>
        <Controls />
      </LoadingProvider>,
    );

    fireEvent.click(screen.getByText('error'));
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
    });
  });

  it('app/loading renders PepperSpinnerLoader', () => {
    render(<Loading />);
    act(() => { jest.advanceTimersByTime(250); });
    expect(screen.getByTestId('pepper-spinner-loader')).toBeInTheDocument();
  });

  it('Button exposes button-level loading state', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('starts route loading immediately for internal link clicks', () => {
    render(
      <LoadingProvider>
        <LinkControls />
      </LoadingProvider>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Manager' }));

    expect(screen.getByTestId('link-loading-state')).toHaveTextContent('true');
    expect(screen.getByTestId('pepper-spinner-loader')).toBeInTheDocument();
  });

  it('starts route loading for query-only internal navigation', () => {
    render(
      <LoadingProvider>
        <LinkControls />
      </LoadingProvider>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Query tab' }));

    expect(screen.getByTestId('link-loading-state')).toHaveTextContent('true');
  });

  it('does not route-load for hash-only or external links', () => {
    render(
      <LoadingProvider>
        <LinkControls />
      </LoadingProvider>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Hash only' }));
    expect(screen.getByTestId('link-loading-state')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('link', { name: 'External' }));
    expect(screen.getByTestId('link-loading-state')).toHaveTextContent('false');
  });
});
