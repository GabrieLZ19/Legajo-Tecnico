'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { 
  History, 
  User, 
  Activity, 
  Calendar, 
  Search, 
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  Settings,
  UserPlus,
  UserCheck,
  Building,
  Edit,
  Loader2
} from 'lucide-react';

interface LogEntry {
  id: string;
  usuario_id: string;
  accion: string;
  entidad: string;
  entidad_id: string;
  detalles: any;
  created_at: string;
  perfiles: {
    nombre_completo: string;
    username: string;
  };
}

const actionMap: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  'CREAR_USUARIO': { label: 'Usuario Creado', icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'EDITAR_USUARIO': { label: 'Usuario Editado', icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
  'CREAR_EMPRESA': { label: 'Empresa Nueva', icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'EDITAR_EMPRESA': { label: 'Empresa Editada', icon: Edit, color: 'text-amber-600', bg: 'bg-amber-50' },
  'ACTUALIZAR_CONFIGURACION': { label: 'Configuración', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50' },
};

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/auditoria');
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.perfiles.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entidad.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Auditoría de Sistema
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Registro histórico de acciones realizadas por los administradores.
          </p>
        </div>
        
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 shadow-sm transition-all active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por usuario o acción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 text-blue-700 animate-spin" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando registros...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-y border-slate-100">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Usuario</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acción</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.map((log) => {
                  const actionInfo = actionMap[log.accion] || { label: log.accion, icon: Activity, color: 'text-slate-600', bg: 'bg-slate-50' };
                  const ActionIcon = actionInfo.icon;
                  const { date, time } = formatDate(log.created_at);
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                            {log.perfiles.nombre_completo[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">{log.perfiles.nombre_completo}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{log.perfiles.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${actionInfo.bg} ${actionInfo.color} border border-current/10`}>
                          <ActionIcon className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-wider">{actionInfo.label}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{date}</span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {time}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="max-w-xs">
                          <p className="text-xs font-medium text-slate-500 line-clamp-2">
                            {log.detalles?.razon_social || log.detalles?.username || log.detalles?.nombre || 'Ver detalles técnicos'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-slate-900 font-bold">No hay registros de actividad</h3>
            <p className="text-sm text-slate-500 mt-1">
              Las acciones realizadas por los administradores aparecerán aquí.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
