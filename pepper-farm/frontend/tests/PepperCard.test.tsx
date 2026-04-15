import { render, screen } from '@testing-library/react';
import PepperCard from '@/components/peppers/PepperCard';
import { Pepper } from '@/types/pepper';

const basePepper: Pepper = {
  PepperId: 1,
  PepperName: 'Jalapeño',
  IsActive: true,
};

describe('PepperCard', () => {
  it('renders pepper name', () => {
    render(<PepperCard pepper={basePepper} />);
    expect(screen.getByText('Jalapeño')).toBeInTheDocument();
  });

  it('renders scientific name when provided', () => {
    render(<PepperCard pepper={{ ...basePepper, ScientificName: 'Capsicum annuum' }} />);
    expect(screen.getByText('Capsicum annuum')).toBeInTheDocument();
  });

  it('does not render scientific name when absent', () => {
    render(<PepperCard pepper={basePepper} />);
    expect(screen.queryByText('Capsicum annuum')).not.toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<PepperCard pepper={{ ...basePepper, GeneralDescription: 'Mild and smoky' }} />);
    expect(screen.getByText('Mild and smoky')).toBeInTheDocument();
  });

  it('renders heat badge with SHU range when both min and max are provided', () => {
    render(<PepperCard pepper={{ ...basePepper, HeatLevelScovilleMin: 2500, HeatLevelScovilleMax: 8000 }} />);
    expect(screen.getByText(/2,500.*8,000 SHU/)).toBeInTheDocument();
  });

  it('renders heat badge with single value when only min is provided', () => {
    render(<PepperCard pepper={{ ...basePepper, HeatLevelScovilleMin: 5000 }} />);
    expect(screen.getByText(/5,000 SHU/)).toBeInTheDocument();
  });

  it('does not render heat badge when no SHU values', () => {
    render(<PepperCard pepper={basePepper} />);
    expect(screen.queryByText(/SHU/)).not.toBeInTheDocument();
  });

  it('renders zone when provided', () => {
    render(<PepperCard pepper={{ ...basePepper, Zone: 'Zone A' }} />);
    expect(screen.getByText('Zone A')).toBeInTheDocument();
  });

  it('renders fallback emoji when no image', () => {
    const { container } = render(<PepperCard pepper={basePepper} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('🌶️')).toBeInTheDocument();
  });

  it('renders image when ImageUrl is provided', () => {
    render(<PepperCard pepper={{ ...basePepper, ImageUrl: '/uploads/pepper_images/test.jpg' }} />);
    const img = screen.getByRole('img', { name: 'Jalapeño' });
    expect(img).toHaveAttribute('src', '/uploads/pepper_images/test.jpg');
  });
});
