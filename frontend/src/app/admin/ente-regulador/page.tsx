'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { 
  Building2, 
  CheckCircle, 
  FileText, 
  AlertTriangle,
  Lock,
  Eye,
  ShieldCheck
} from 'lucide-react';

export default function EnteReguladorPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [informes, setInformes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, infRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/informes')
        ]);
        setDashboardData(dashRes.data);
        setInformes(infRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2 w-1/3">
            <div className="h-10 bg-slate-200 rounded-lg"></div>
            <div className="h-4 bg-slate-200 rounded-lg w-2/3"></div>
          </div>
          <div className="h-10 bg-slate-200 rounded-lg w-32"></div>
        </div>
        <div className="h-24 bg-amber-50 rounded-3xl border border-amber-100"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-slate-200 rounded-[32px]"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-[32px]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Acceso Ente Regulador
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            ART / Municipio · vista habilitada por el administrador
          </p>
        </div>
        
        <button className="flex items-center gap-2 bg-slate-100 text-slate-500 px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 cursor-not-allowed">
          <Lock className="h-4 w-4" />
          Solo lectura
        </button>
      </div>

      {/* Warning Banner */}
      <div className="bg-[#FFF9E6] border border-[#FFE4A3] rounded-[24px] p-6 flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
          <Eye className="h-5 w-5 text-[#D97706]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#92400E]">Acceso de solo lectura</h3>
          <p className="text-sm font-medium text-[#B45309] opacity-80 mt-0.5">
            El alcance está limitado a la información habilitada por el administrador del sistema.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          label="Empresas habilitadas"
          value={dashboardData?.totalEmpresas || 0}
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard 
          label="Cumplimiento promedio"
          value={`${dashboardData?.cumplimientoGlobal || 0}%`}
          icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard 
          label="Informes visibles"
          value={dashboardData?.totalInformes || 0}
          icon={<FileText className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <StatCard 
          label="Observaciones abiertas"
          value={dashboardData?.observacionesAbiertas || 0}
          icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
          iconBg="bg-rose-50"
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-900">Informes habilitados para consulta</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-y border-slate-100">
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">N° Informe</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Fecha</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {informes.length > 0 ? (
                informes.map((inf) => (
                  <tr key={inf.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {inf.empresas?.razon_social || 'Empresa Desconocida'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-sm font-bold text-slate-500">
                        N° {String(inf.numero_informe).padStart(6, '0')}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-sm font-bold text-slate-500">
                        {new Date(inf.fecha_hora_visita).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <StatusBadge status={inf.estado_firma} />
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors">
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-medium">
                    No hay informes habilitados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, iconBg }: { label: string, value: string | number, icon: React.ReactNode, iconBg: string }) {
  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
      <div className={`h-12 w-12 ${iconBg} rounded-2xl flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <div className="text-4xl font-black text-slate-900 tracking-tight">{value}</div>
        <div className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isCerrado = status === 'firmado' || status === 'archivado';
  
  if (isCerrado) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
        Cerrado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
      Pendiente
    </span>
  );
}
