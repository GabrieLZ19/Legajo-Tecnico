export type RolUsuario = "admin" | "preventor" | "dueno" | "ente_regulador";
export type EstadoEmpresa = "activa" | "aviso_deuda" | "pausada" | "eliminada";
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
  estado?: EstadoEmpresa;
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
  permisos_personalizados?: Array<{
    module: string;
    access: "total" | "lectura" | "oculto";
    description: string;
  }> | null;
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
  responsable?: string;
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
  firmante?: {
    id: string;
    nombre_completo: string;
    rol: RolUsuario;
  } | null;
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
  empresas?: {
    id: string;
    razon_social: string;
    contacto?: string | null;
  } | null;
  preventor?: {
    id: string;
    nombre_completo: string;
    rol: RolUsuario;
  } | null;
  dueno_empresa?: {
    id: string;
    nombre_completo: string;
    rol: RolUsuario;
  } | null;
}

export interface MetricasDashboard {
  empresa_id: string;
  informes_mes: number;
  observaciones_abiertas: number;
  porcentaje_cumplimiento: number;
}

// ── Capacitaciones ──
export type EstadoCapacitacion = 'borrador' | 'activa' | 'cerrada';
export type AmbitoCapacitacionPlantilla = 'empresa' | 'global';

export interface CapacitacionDiapositiva {
  contenido: string;
}

export interface Capacitacion {
  id: string;
  empresa_id: string;
  preventor_id: string;
  titulo: string;
  temario?: string;
  diapositivas?: CapacitacionDiapositiva[];
  fecha: string;
  instructor?: string | null;
  fechas_horario?: string | null;
  cantidad_horas?: string | null;
  firma_capacitador_url?: string | null;
  aclaracion_capacitador?: string | null;
  firma_empresa_url?: string | null;
  aclaracion_empresa?: string | null;
  estado: EstadoCapacitacion;
  con_evaluacion?: boolean;
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
  total_preguntas?: number;
  capacitacion_plantilla_preguntas?: CapacitacionPlantillaPregunta[];
}

export interface CapacitacionPlantillaPregunta {
  id: string;
  plantilla_id: string;
  enunciado: string;
  pregunta?: string;
  opciones: string[];
  respuesta_correcta: string;
  orden: number;
}

// ── EPP ──
export type EstadoEntregaEpp = 'registrada' | 'firmada' | 'anulada';

export interface EppTipo {
  id: string;
  nombre: string;
  descripcion?: string;
  foto_url?: string | null;
  activo: boolean;
}

export interface Empleado {
  id: string;
  empresa_id: string;
  nombre: string;
  documento: string;
  sector?: string | null;
  qr_token: string;
  activo: boolean;
  created_at: string;
}

export interface EppProveedor {
  id: string;
  consultora_id: string;
  nombre: string;
  email: string;
  activo: boolean;
}

export interface EppLicitacionItem {
  id: string;
  licitacion_id: string;
  epp_tipo_id: string;
  cantidad: number;
  epp_tipos?: EppTipo | null;
}

export interface EppCotizacion {
  id: string;
  licitacion_id: string;
  proveedor_id?: string | null;
  proveedor_nombre: string;
  proveedor_email?: string | null;
  monto?: number | null;
  url_carga?: string | null;
  token_publico?: string;
  items_ofertados?: unknown;
  comision_calculada?: number | null;
  estado: string;
  created_at: string;
}

export interface EppLicitacion {
  id: string;
  empresa_id: string;
  consultora_id: string;
  titulo: string;
  descripcion?: string | null;
  estado: string;
  comision_porcentaje?: number | null;
  fecha_cierre?: string | null;
  created_at: string;
  epp_licitacion_items?: EppLicitacionItem[];
  epp_licitacion_cotizaciones?: EppCotizacion[];
}

export interface DocumentoArchivo {
  id: string;
  tipo: "informe" | "capacitacion" | "epp";
  titulo: string;
  fecha: string;
  empresa_id: string;
  empresa_razon_social: string;
  pdf_disponible: boolean;
  extra?: Record<string, string | number | boolean | null>;
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

