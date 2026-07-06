'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Bell, X, Info, AlertTriangle, AlertCircle } from 'lucide-react';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Polling cada 1 minuto (simplificado para esta versión)
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/admin/notificaciones/mias'); // Necesitaremos esta ruta
      setNotifications(res.data);
      // Por ahora, asumimos que todas son nuevas si no tenemos tabla de leídas
      setUnreadCount(res.data.length); 
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-rose-600" />;
      default: return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getBg = (tipo: string) => {
    switch (tipo) {
      case 'warning': return 'bg-amber-50';
      case 'error': return 'bg-rose-50';
      default: return 'bg-blue-50';
    }
  };

  return (
    <div className="sm:relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div className="absolute right-4 sm:right-0 mt-3 w-[calc(100vw-32px)] sm:w-80 max-w-[340px] bg-white rounded-[24px] shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-5 duration-200">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Notificaciones</span>
              <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div key={n.id} className="p-4 hover:bg-slate-50 border-b border-slate-50 transition-colors">
                    <div className="flex gap-3">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${getBg(n.tipo)}`}>
                        {getIcon(n.tipo)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{n.titulo}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-normal">{n.mensaje}</p>
                        <p className="text-[10px] font-bold text-slate-300 mt-2 uppercase">
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm font-bold text-slate-300">No hay avisos nuevos</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
