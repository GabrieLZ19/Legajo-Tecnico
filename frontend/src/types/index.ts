export type RolUsuario = "admin" | "preventor" | "dueno" | "ente_regulador";
export type EstadoFirmaInforme =
  | "borrador"
  | "pendiente_preventor"
  | "pendiente_dueno"
  | "firmado"
  | "archivado";
export type EstadoAccion = "pendiente" | "cumplida" | "atendida";
export type TipoFirma = "preventor" | "dueno" | "asistente_capacitacion";

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

export interface AdminEmpresaOption extends Empresa {
  preventor_empresas?: Array<{
    preventor_id: string;
    perfiles?: {
      nombre_completo?: string | null;
    } | null;
  }>;
  consultoras?: {
    id?: string;
    nombre?: string | null;
    logo_url?: string | null;
  } | null;
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
  permisos_personalizados?: any;
}

export interface AdminUsuario extends Perfil {
  preventor_empresas?: Array<{
    empresa_id: string;
    empresas?: {
      razon_social?: string | null;
    } | null;
  }>;
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

// ── Capacitaciones ──
export type EstadoCapacitacion = 'borrador' | 'activa' | 'cerrada';

export interface Capacitacion {
  id: string;
  empresa_id: string;
  preventor_id: string;
  titulo: string;
  temario?: string;
  fecha: string;
  estado: EstadoCapacitacion;
  created_at: string;
  total_preguntas?: number;
  total_asistencias?: number;
  capacitacion_preguntas?: CapacitacionPregunta[];
  capacitacion_asistencias?: CapacitacionAsistencia[];
}

export interface CapacitacionPregunta {
  id: string;
  capacitacion_id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
  orden: number;
}

export interface CapacitacionAsistencia {
  id: string;
  capacitacion_id: string;
  nombre_empleado: string;
  dni_empleado: string;
  sector?: string;
  puntaje: number;
  aprobado: boolean;
  firma_url?: string;
  created_at: string;
}

// ── EPP ──
export type EstadoEntregaEpp = 'registrada' | 'firmada' | 'anulada';

export interface EppTipo {
  id: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface EppEntrega {
  id: string;
  empresa_id: string;
  preventor_id: string;
  epp_tipo_id: string;
  nombre_empleado: string;
  dni_empleado: string;
  cantidad: number;
  marca?: string;
  modelo?: string;
  certificacion?: string;
  fecha_entrega: string;
  firma_url?: string;
  estado: EstadoEntregaEpp;
  pdf_url?: string;
  created_at: string;
  epp_tipos?: EppTipo | null;
}

