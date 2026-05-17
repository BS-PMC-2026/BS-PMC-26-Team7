'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Leaf } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  /** Override default navigation links */
  links?: FooterLink[];
}

export default function Footer({ links }: FooterProps) {
  const { t } = useLanguage();
  const la = t.landing;

  const DEFAULT_LINKS: FooterLink[] = [
    { label: la.footerLogin,    href: '/login'        },
    { label: la.footerRegister, href: '/register'     },
    { label: la.footerFarmMap,  href: '/visitor/map'  },
  ];

  const navLinks = links ?? DEFAULT_LINKS;
  const copyright = la.footerCopyright.replace('{year}', new Date().getFullYear().toString());

  return (
    <footer className="border-t border-green-100 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-green-600 flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            className="font-semibold text-green-900 text-sm"
            style={{ fontFamily: 'Lora, serif' }}
          >
            PepperFarm
          </span>
        </div>

        {/* Copyright */}
        <p className="text-xs text-gray-400">{copyright}</p>

        {/* Links */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {navLinks.map((l) => (
            <motion.div key={l.href} whileHover={{ y: -1 }}>
              <Link
                href={l.href}
                className="hover:text-green-600 transition-colors cursor-pointer"
              >
                {l.label}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </footer>
  );
}
