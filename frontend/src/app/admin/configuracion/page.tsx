'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { 
  Settings, 
  Upload, 
  Save, 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Bell,
  Send
} from 'lucide-react';

interface Consultora {
  id: string;
  nombre: string;
  cuit: string;
  logo_url: string | null;
}

export default function AdminConfiguracionPage() {
  const [consultora, setConsultora] = useState<Consultora | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', cuit: '' });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetchConsultora();
  }, []);

  const fetchConsultora = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/consultora');
      setConsultora(res.data);
      setFormData({ 
        nombre: res.data.nombre || '', 
        cuit: res.data.cuit || '' 
      });
    } catch (err) {
      console.error('Error fetching consultora:', err);
      setError('No se pudo cargar la información de la consultora.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await api.put('/admin/consultora', formData);
      setConsultora(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating consultora:', err);
      setError(err.response?.data?.error || 'Error al actualizar la información.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !consultora) return;

    try {
      setUploadingLogo(true);
      setError(null);
      const formDataUpload = new FormData();
      formDataUpload.append('logo', file);

      const res = await api.post(`/admin/consultoras/${consultora.id}/logo`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setConsultora({ ...consultora, logo_url: res.data.logo_url });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setError('Error al subir el logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-blue-700 animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Configuración del Sistema
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Gestioná la identidad visual y los datos fiscales de tu consultora.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Col: Identity Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
            <div className="relative group">
              <div className="h-32 w-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400">
                {consultora?.logo_url ? (
                  <img src={consultora.logo_url} alt="Logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                )}
                
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-blue-700 animate-spin" />
                  </div>
                )}
              </div>
              
              <label className="absolute -bottom-2 -right-2 h-10 w-10 bg-blue-700 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-800 transition-all active:scale-90">
                <Upload className="h-4 w-4" />
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-black text-slate-900 leading-tight">{consultora?.nombre || 'Mi Consultora'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Consultora Principal</p>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-[32px] p-6 border border-blue-100">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-3">Información de Ayuda</h4>
            <p className="text-xs font-medium text-blue-800/70 leading-relaxed">
              El logo y nombre configurados aquí aparecerán automáticamente en el encabezado de todos los informes PDF generados por el sistema.
            </p>
          </div>
        </div>

        {/* Right Col: Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  Información actualizada correctamente.
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                    <Building2 className="h-3 w-3" />
                    Nombre de la Consultora
                  </label>
                  <input 
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                    <CreditCard className="h-3 w-3" />
                    CUIT / Identificación Fiscal
                  </label>
                  <input 
                    type="text"
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-lg transition-all active:scale-[0.98]"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <Settings className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Versión del Sistema</h4>
                <p className="text-xs font-medium text-slate-500">Legajo Técnico Pro v2.4.0</p>
              </div>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Notificaciones Globales</h2>
            <p className="text-sm font-medium text-slate-500">Enviá avisos a todos los preventores y dueños de empresa.</p>
          </div>
        </div>

        <NotificationForm />
      </div>
    </div>
  );
}

function NotificationForm() {
  const [data, setData] = useState({ titulo: '', mensaje: '', tipo: 'info' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSending(true);
      await api.post('/admin/notificaciones', data);
      setSuccess(true);
      setData({ titulo: '', mensaje: '', tipo: 'info' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error sending notification:', err);
      alert('Error al enviar la notificación');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-bold">
          Notificación enviada con éxito a todos los usuarios.
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Título del Aviso</label>
          <input 
            type="text"
            value={data.titulo}
            onChange={(e) => setData({ ...data, titulo: e.target.value })}
            placeholder="Ej: Mantenimiento programado"
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tipo</label>
          <select 
            value={data.tipo}
            onChange={(e) => setData({ ...data, tipo: e.target.value })}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all appearance-none"
          >
            <option value="info">Información (Azul)</option>
            <option value="warning">Advertencia (Naranja)</option>
            <option value="error">Urgente (Rojo)</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Mensaje</label>
        <textarea 
          value={data.mensaje}
          onChange={(e) => setData({ ...data, mensaje: e.target.value })}
          placeholder="Escribí el contenido del aviso..."
          rows={3}
          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all resize-none"
          required
        />
      </div>

      <div className="flex justify-end pt-2">
        <button 
          type="submit"
          disabled={sending}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-lg shadow-amber-600/20 transition-all active:scale-95"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Aviso Global
        </button>
      </div>
    </form>
  );
}
