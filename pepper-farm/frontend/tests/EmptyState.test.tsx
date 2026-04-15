import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders optional description', () => {
    render(<EmptyState title="Empty" description="Come back later." />);
    expect(screen.getByText('Come back later.')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText('Come back later.')).not.toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="Empty" icon="🌶️" />);
    expect(screen.getByText('🌶️')).toBeInTheDocument();
  });

  it('does not render icon span when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('span')).not.toBeInTheDocument();
  });
});
