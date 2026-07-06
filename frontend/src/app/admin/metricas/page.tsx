'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  LabelList
} from 'recharts';
import { 
  Search, 
  Download, 
  FileText, 
  Building2, 
  GraduationCap,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

export default function AdminMetricasPage() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [empRes, dashRes] = await Promise.all([
        api.get('/admin/empresas'),
        api.get('/admin/dashboard', {
          params: {
            fechaDesde: dateFrom || undefined,
            fechaHasta: dateTo || undefined
          }
        })
      ]);
      setEmpresas(empRes.data);
      setDashboardData(dashRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCSV = () => {
    if (!empresas.length) return;
    
    const headers = ['Empresa', 'CUIT', 'Cumplimiento (%)', 'Actividad'];
    const rows = empresas.map(emp => [
      `"${emp.razon_social}"`,
      `"${emp.cuit}"`,
      emp.porcentaje_cumplimiento || 0,
      `"${emp.actividad || ''}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_gestion_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-10 bg-slate-200 rounded-lg w-1/4"></div>
          <div className="h-10 bg-slate-200 rounded-lg w-1/4"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-200 rounded-3xl"></div>
          <div className="h-80 bg-slate-200 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  // Preparar datos para el gráfico de barras
  const barData = empresas
    .filter(emp => emp.razon_social.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(emp => ({
      name: emp.razon_social.split(' ').slice(0, 2).join(' '),
      fullName: emp.razon_social,
      cumplimiento: Number(emp.porcentaje_cumplimiento || 0),
      color: Number(emp.porcentaje_cumplimiento || 0) >= 80 ? '#10B981' : '#F59E0B'
    }))
    .slice(0, 8);

  // Preparar datos para el gráfico de donut
  const totalActividad = (dashboardData?.totalInformes || 0) + 
                         (dashboardData?.totalCapacitaciones || 0) + 
                         (dashboardData?.totalEntregasEpp || 0);
  
  const activityData = [
    { name: 'Inspecciones', value: dashboardData?.totalInformes || 0, color: '#3B82F6' },
    { name: 'Capacitaciones', value: dashboardData?.totalCapacitaciones || 0, color: '#10B981' },
    { name: 'Entregas EPP', value: dashboardData?.totalEntregasEpp || 0, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Métricas de Gestión</h1>
          <p className="text-sm font-medium text-slate-500">Visualizá el desempeño y cumplimiento de todas las empresas.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none" 
            />
            <span className="text-slate-300 mx-1">—</span>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none" 
            />
          </div>

          <div className="h-8 w-px bg-slate-100 mx-1 hidden sm:block" />

          <button 
            onClick={() => fetchData(true)}
            className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-blue-600"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl text-xs font-black transition-all active:scale-95"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900">Cumplimiento Individual</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filtrar empresa..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-200 outline-none transition-all w-48"
              />
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                  dy={10}
                />
                <YAxis hide domain={[0, 110]} />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{payload[0].payload.fullName}</p>
                          <p className="text-sm font-bold mt-1">{payload[0].value}% de cumplimiento</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="cumplimiento" radius={[10, 10, 10, 10]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                  ))}
                  <LabelList 
                    dataKey="cumplimiento" 
                    position="top" 
                    formatter={(val: any) => `${val}%`}
                    style={{ fontSize: '10px', fontWeight: 900, fill: '#64748B' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-black text-slate-900 mb-2">Distribución de Actividad</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Total Gestión</p>
          
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {activityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                          <p className="text-xs font-black text-slate-900">{payload[0].name}</p>
                          <p className="text-sm font-bold text-blue-600">{payload[0].value} registros</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-900">{totalActividad}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            {activityData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-bold text-slate-700">{item.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          icon={<Building2 className="h-5 w-5" />}
          label="Empresas Activas"
          value={dashboardData?.totalEmpresas || 0}
          color="blue"
        />
        <SummaryCard 
          icon={<FileText className="h-5 w-5" />}
          label="Informes Generados"
          value={dashboardData?.totalInformes || 0}
          subValue={`${dashboardData?.informesFirmados || 0} firmados`}
          color="emerald"
        />
        <SummaryCard 
          icon={<GraduationCap className="h-5 w-5" />}
          label="Capacitaciones"
          value={dashboardData?.totalCapacitaciones || 0}
          color="indigo"
        />
        <SummaryCard 
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Obs. Abiertas"
          value={dashboardData?.observacionesAbiertas || 0}
          color="rose"
        />
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, subValue, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-4 border ${colors[color]}`}>
        {icon}
      </div>
      <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
      {subValue && <div className="mt-2 text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">{subValue}</div>}
    </div>
  );
}
