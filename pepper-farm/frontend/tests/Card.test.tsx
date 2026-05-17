import { render, screen } from '@testing-library/react';
import Card from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>card content</Card>);
    expect(screen.getByText('card content')).toBeInTheDocument();
  });

  it('applies base card classes', () => {
    const { container } = render(<Card>content</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('bg-white', 'rounded-xl', 'border');
  });

  it('merges additional className', () => {
    const { container } = render(<Card className="p-4">padded</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('p-4');
  });
});
