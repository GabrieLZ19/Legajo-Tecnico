export type RolUsuario = 'admin' | 'preventor' | 'dueno' | 'ente_regulador';
export type EstadoEmpresa = 'activa' | 'aviso_deuda' | 'pausada' | 'eliminada';
export type EstadoFirmaInforme = 'borrador' | 'pendiente_preventor' | 'pendiente_dueno' | 'firmado' | 'archivado';
export type EstadoAccion = 'pendiente' | 'cumplida' | 'atendida';
export type TipoFirma = 'preventor' | 'dueno' | 'asistente_capacitacion';
export type EstadoCapacitacion = 'borrador' | 'activa' | 'cerrada';
export type AmbitoCapacitacionPlantilla = 'empresa' | 'global';
export type EstadoPublicacionPlantilla = 'pendiente' | 'aprobada' | 'rechazada';
export type EstadoEntregaEpp = 'registrada' | 'firmada' | 'anulada';

export interface CapacitacionDiapositiva {
  contenido: string;
}

export interface CapacitacionPlantilla {
  id: string;
  ambito: AmbitoCapacitacionPlantilla;
  empresa_id?: string | null;
  titulo: string;
  temario?: string | null;
  diapositivas?: CapacitacionDiapositiva[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  estado_publicacion?: EstadoPublicacionPlantilla | null;
  aprobado_por?: string | null;
  aprobado_at?: string | null;
  rechazo_motivo?: string | null;
  autor_nombre?: string | null;
  total_preguntas?: number;
}

export interface CapacitacionPlantillaPregunta {
  id: string;
  plantilla_id: string;
  enunciado: string;
  opciones: string[];
  respuesta_correcta: string;
  orden: number;
}

export interface Empresa {
  id: string;
  consultora_id: string;
  cuit: string;
  razon_social: string;
  actividad?: string;
  logo_url?: string;
  porcentaje_cumplimiento?: number;
  estado?: EstadoEmpresa;
  created_at: string;
}

export interface Perfil {
  id: string;
  consultora_id?: string;
  empresa_id?: string;
  nombre_completo?: string;
  username: string;
  rol: RolUsuario;
  activo: boolean;
  created_at: string;
  permisos_personalizados?: unknown;
}

export interface InformeVisita {
  id: string;
  empresa_id: string;
  preventor_id: string;
  numero_informe: number;
  actividad?: string;
  fecha_hora_visita: string;
  lugar_visita?: string;
  contacto_visita?: string;
  declaracion_legal?: string;
  observaciones?: string;
  estado_firma: EstadoFirmaInforme;
  url_pdf_generado?: string;
  created_at: string;
  updated_at: string;
}

export interface PeligroDetectado {
  id: string;
  informe_id: string;
  descripcion: string;
  medida_control?: string;
  orden: number;
}

export interface PuntoMejora {
  id: string;
  informe_id: string;
  numero_item: number;
  detalle: string;
  evidencia_url?: string;
  orden: number;
}

export interface AccionMejora {
  id: string;
  informe_id: string;
  empresa_id: string;
  punto_mejora_id?: string;
  numero_item?: number;
  descripcion: string;
  estado: EstadoAccion;
  responsable?: string;
  fecha_cumplimiento?: string;
  created_at: string;
}

export interface FirmaInforme {
  id: string;
  informe_id: string;
  firmante_id: string;
  tipo: TipoFirma;
  firma_url?: string;
  firmado_at: string;
  ip_address?: string;
}
