import { render, screen, fireEvent } from '@testing-library/react';
import ExportModal from '@/components/sensors/ExportModal';

describe('ExportModal', () => {
  const baseProps = {
    onClose: jest.fn(),
    canExportTable: true,
    canExportGraph: true,
    isExporting: false,
    exportError: null,
    onExport: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- Render ----------
  it('renders modal title', () => {
    render(<ExportModal {...baseProps} />);
    expect(screen.getByText('Export Sensor Data')).toBeInTheDocument();
  });

  it('renders Table and Graph checkboxes', () => {
    render(<ExportModal {...baseProps} />);
    expect(screen.getByText(/Table/i)).toBeInTheDocument();
    expect(screen.getByText(/Graph/i)).toBeInTheDocument();
  });

  it('renders Download and Email radio options', () => {
    render(<ExportModal {...baseProps} />);
    expect(screen.getByLabelText(/Download to device/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Send by email/i)).toBeInTheDocument();
  });

  // ---------- Disabled states ----------
  it('disables Table checkbox when canExportTable is false', () => {
    render(<ExportModal {...baseProps} canExportTable={false} />);
    const checkbox = screen.getAllByRole('checkbox')[0];
    expect(checkbox).toBeDisabled();
  });

  it('shows hint text when Table cannot be exported', () => {
    render(<ExportModal {...baseProps} canExportTable={false} />);
    expect(screen.getByText(/Load data first/i)).toBeInTheDocument();
  });

  it('disables Graph checkbox when canExportGraph is false', () => {
    render(<ExportModal {...baseProps} canExportGraph={false} />);
    expect(screen.getByText(/Switch to Graph view/i)).toBeInTheDocument();
  });

  // ---------- Email field visibility ----------
  it('hides email input when Download is selected', () => {
    render(<ExportModal {...baseProps} />);
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();
  });

  it('shows email input when Email is selected', () => {
    render(<ExportModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Send by email/i));
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  // ---------- Error display ----------
  it('shows error message when exportError is set', () => {
    render(<ExportModal {...baseProps} exportError="Failed to export" />);
    expect(screen.getByText('Failed to export')).toBeInTheDocument();
  });

  // ---------- Submit behavior ----------
  it('calls onExport with correct options when Export clicked', async () => {
    render(<ExportModal {...baseProps} />);

    fireEvent.click(screen.getByText('Export'));

    expect(baseProps.onExport).toHaveBeenCalledWith({
      includeTable: true,
      includeGraph: true,
      delivery: 'download',
      email: '',
    });
  });

  it('disables Export button when nothing selected', () => {
    render(<ExportModal {...baseProps} canExportTable={false} canExportGraph={false} />);
    const exportBtn = screen.getByText('Export').closest('button');
    expect(exportBtn).toBeDisabled();
  });

  it('disables Export button when email selected but invalid', () => {
    render(<ExportModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Send by email/i));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'not-an-email' },
    });

    const exportBtn = screen.getByText('Export').closest('button');
    expect(exportBtn).toBeDisabled();
  });

  it('shows Exporting... text when isExporting is true', () => {
    render(<ExportModal {...baseProps} isExporting={true} />);
    expect(screen.getByText(/Exporting/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancel clicked', () => {
    render(<ExportModal {...baseProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });
});
