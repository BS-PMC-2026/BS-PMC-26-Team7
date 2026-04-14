interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'success' | 'info';
  className?: string;
}

const VARIANT_STYLES = {
  error: 'text-red-600 bg-red-50 border-red-200',
  success: 'text-green-700 bg-green-50 border-green-200',
  info: 'text-gray-600 bg-white border-gray-200',
};

export default function Alert({ children, variant = 'error', className = '' }: AlertProps) {
  return (
    <div className={`text-sm border rounded-xl px-4 py-3 ${VARIANT_STYLES[variant]} ${className}`}>
      {children}
    </div>
  );
}
