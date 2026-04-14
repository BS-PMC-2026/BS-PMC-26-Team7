import { render, screen } from '@testing-library/react';
import Badge from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>hello</Badge>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies base pill classes', () => {
    render(<Badge>test</Badge>);
    const el = screen.getByText('test');
    expect(el).toHaveClass('rounded-full', 'text-xs', 'font-medium');
  });

  it('applies extra className', () => {
    render(<Badge className="bg-red-100 text-red-700">warn</Badge>);
    const el = screen.getByText('warn');
    expect(el).toHaveClass('bg-red-100', 'text-red-700');
  });
});
