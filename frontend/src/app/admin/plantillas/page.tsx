'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { 
  FileText, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Check,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';

interface Plantilla {
  id: string;
  nombre: string;
  contenido: string;
  created_at: string;
}

export default function AdminPlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState<Plantilla | null>(null);
  const [formData, setFormData] = useState({ nombre: '', contenido: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlantillas();
  }, []);

  const fetchPlantillas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/plantillas');
      setPlantillas(res.data);
    } catch (err) {
      console.error('Error fetching plantillas:', err);
      setError('No se pudieron cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (plantilla?: Plantilla) => {
    if (plantilla) {
      setEditingPlantilla(plantilla);
      setFormData({ nombre: plantilla.nombre, contenido: plantilla.contenido });
    } else {
      setEditingPlantilla(null);
      setFormData({ nombre: '', contenido: '' });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlantilla(null);
    setFormData({ nombre: '', contenido: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim() || !formData.contenido.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (editingPlantilla) {
        await api.put(`/plantillas/${editingPlantilla.id}`, formData);
      } else {
        await api.post('/plantillas', formData);
      }
      await fetchPlantillas();
      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving plantilla:', err);
      setError(err.response?.data?.error || 'Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) return;

    try {
      await api.delete(`/plantillas/${id}`);
      setPlantillas(plantillas.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting plantilla:', err);
      alert('No se pudo eliminar la plantilla');
    }
  };

  const filteredPlantillas = plantillas.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contenido.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Plantillas de Informes
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1 text-balance">
            Gestioná los textos predefinidos para las declaraciones juradas y conclusiones de los informes.
          </p>
        </div>
        
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-700/20 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nueva Plantilla
        </button>
      </div>

      {/* Search and List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por nombre o contenido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 text-blue-700 animate-spin" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando plantillas...</p>
          </div>
        ) : filteredPlantillas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-y border-slate-100">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre de la Plantilla</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vista Previa</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPlantillas.map((plantilla) => (
                  <tr key={plantilla.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-900 uppercase">
                          {plantilla.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 max-w-md">
                      <p className="text-sm font-medium text-slate-500 line-clamp-1 italic">
                        "{plantilla.contenido}"
                      </p>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(plantilla)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(plantilla.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-slate-200" />
            </div>
            <h3 className="text-slate-900 font-bold">No se encontraron plantillas</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchTerm ? 'Probá con otros términos de búsqueda.' : 'Comenzá creando tu primera plantilla.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingPlantilla ? 'Editar Plantilla' : 'Nueva Plantilla'}
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  {editingPlantilla ? 'Actualizá el contenido base del informe.' : 'Definí un nuevo texto predefinido.'}
                </p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Nombre</label>
                <input 
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Declaración Jurada de Inspección"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Contenido</label>
                <textarea 
                  value={formData.contenido}
                  onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                  placeholder="Escribí aquí el texto que aparecerá en el informe..."
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-800 outline-none focus:border-blue-200 focus:bg-white transition-all resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-lg shadow-blue-700/20 transition-all active:scale-95"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {editingPlantilla ? 'Guardar Cambios' : 'Crear Plantilla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
