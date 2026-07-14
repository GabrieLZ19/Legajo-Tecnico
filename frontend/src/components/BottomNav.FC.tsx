'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, CheckSquare, HardHat, GraduationCap } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'Informes', href: '/informes', icon: FileText },
    { name: 'Plan', href: '/plan-accion', icon: CheckSquare },
    ...(user?.rol !== 'dueno' ? [
      { name: 'EPP', href: '/epp', icon: HardHat },
      { name: 'Capacit.', href: '/capacitaciones', icon: GraduationCap },
    ] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg md:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'stroke-2' : ''}`} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
export default BottomNav;
