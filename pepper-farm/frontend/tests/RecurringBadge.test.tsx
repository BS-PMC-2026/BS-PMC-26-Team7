import { render, screen } from '@testing-library/react';
import RecurringBadge from '@/components/ui/RecurringBadge';

describe('RecurringBadge', () => {
  it('renders nothing when isRecurring is false', () => {
    const { container } = render(
      <RecurringBadge isRecurring={false} occurrenceCount={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders occurrence count badge when isRecurring is true', () => {
    render(<RecurringBadge isRecurring={true} occurrenceCount={5} />);
    expect(screen.getByText('×5')).toBeInTheDocument();
  });

  it('shows tooltip with occurrence count and window days', () => {
    render(
      <RecurringBadge isRecurring={true} occurrenceCount={5} windowHours={168} />
    );
    const badge = screen.getByText('×5');
    expect(badge).toHaveAttribute('title', 'Occurred 5 times in the last 7 days');
  });
});
