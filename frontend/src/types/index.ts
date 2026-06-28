export type RolUsuario = 'admin' | 'preventor' | 'dueno' | 'ente_regulador';
export type EstadoFirmaInforme = 'borrador' | 'pendiente_preventor' | 'pendiente_dueno' | 'firmado' | 'archivado';
export type EstadoAccion = 'pendiente' | 'cumplida' | 'atendida';
export type TipoFirma = 'preventor' | 'dueno' | 'asistente_capacitacion';

export interface Empresa {
  id: string;
  consultora_id: string;
  cuit: string;
  razon_social: string;
  actividad?: string;
  logo_url?: string;
  porcentaje_cumplimiento?: number;
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
  fecha_cumplimiento?: string;
  created_at: string;
  informes_visita?: {
    numero_informe: number;
    fecha_hora_visita: string;
    lugar_visita?: string;
  };
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
  evidencia_url?: string;
  evidencias_urls?: string[];
  estado_firma: EstadoFirmaInforme;
  url_pdf_generado?: string;
  created_at: string;
  updated_at: string;
  peligros_detectados?: PeligroDetectado[];
  puntos_mejora?: PuntoMejora[];
  acciones_mejora?: AccionMejora[];
  firmas_informe?: FirmaInforme[];
}

export interface MetricasDashboard {
  empresa_id: string;
  informes_mes: number;
  observaciones_abiertas: number;
  porcentaje_cumplimiento: number;
}
