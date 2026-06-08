'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useLanguage } from '@/context/LanguageContext';

type BackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
  variant?: 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  testId?: string;
};

export default function BackButton({
  label,
  fallbackHref,
  className = '',
  variant = 'outline',
  size = 'sm',
  testId,
}: BackButtonProps) {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const text = label ?? t.common.back ?? 'Back';
  const Icon = dir === 'rtl' ? ChevronRight : ChevronLeft;

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    if (fallbackHref) {
      router.push(fallbackHref);
    } else {
      router.push('/');
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`gap-1.5 ${className}`}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {text}
    </Button>
  );
}
