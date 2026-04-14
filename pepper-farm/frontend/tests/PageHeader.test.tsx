import { render, screen } from '@testing-library/react';
import PageHeader from '@/components/ui/PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="My Page" />);
    expect(screen.getByText('My Page')).toBeInTheDocument();
  });

  it('renders optional label', () => {
    render(<PageHeader title="Title" label="PepperFarm" />);
    expect(screen.getByText('PepperFarm')).toBeInTheDocument();
  });

  it('renders optional subtitle', () => {
    render(<PageHeader title="Title" subtitle="A description" />);
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('renders optional action node', () => {
    render(<PageHeader title="Title" action={<button>+ Add</button>} />);
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
  });

  it('does not render label/subtitle when not provided', () => {
    render(<PageHeader title="Only title" />);
    expect(screen.queryByText('PepperFarm')).not.toBeInTheDocument();
    expect(screen.queryByText('description')).not.toBeInTheDocument();
  });
});
