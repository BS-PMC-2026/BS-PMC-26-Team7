import { render, screen } from '@testing-library/react';
import Alert from '@/components/ui/Alert';

describe('Alert', () => {
  it('renders message text', () => {
    render(<Alert>Something went wrong</Alert>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('applies error styles by default', () => {
    render(<Alert>error msg</Alert>);
    const el = screen.getByText('error msg');
    expect(el).toHaveClass('text-[var(--color-error)]');
    expect(el).toHaveClass('bg-[var(--color-error-bg)]');
    expect(el).toHaveClass('border-[var(--color-border)]');
  });

  it('applies success styles when variant=success', () => {
    render(<Alert variant="success">saved!</Alert>);
    const el = screen.getByText('saved!');
    expect(el).toHaveClass('text-[var(--color-primary)]');
    expect(el).toHaveClass('bg-[var(--color-secondary-light)]');
  });

  it('applies info styles when variant=info', () => {
    render(<Alert variant="info">note</Alert>);
    const el = screen.getByText('note');
    expect(el).toHaveClass('text-[var(--color-muted-foreground)]');
    expect(el).toHaveClass('bg-white');
  });

  it('merges additional className', () => {
    render(<Alert className="mb-4">msg</Alert>);
    expect(screen.getByText('msg')).toHaveClass('mb-4');
  });
});
