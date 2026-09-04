export type ArticuloCOPP = '167' | '168' | '169' | '170' | '171' | '165' | 'S_165' | 'S 165' | 'SIN_ART' | '';

export type SeccionRuta = 
  | 'RUTA_NOTIFICACION_CITACION' 
  | 'CORREO_EXT' 
  | 'RUTA_INTERNA' 
  | 'OTROS_ESTADOS_MERIDA';

export const SECCIONES_INFO: Record<SeccionRuta, { nombre: string; corto: string; descripcion: string; color: string; badgeBg: string }> = {
  RUTA_NOTIFICACION_CITACION: {
    nombre: 'RUTA DE NOTIFICACIÓN Y CITACIÓN',
    corto: 'RUTA NOTIF./CIT.',
    descripcion: 'Ruta ordinaria de calle / Alguacilazgo en el municipio y circunscripción',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  CORREO_EXT: {
    nombre: 'CORREO EXT.',
    corto: 'CORREO EXT.',
    descripcion: 'Correo Externo / Envíos postales / Telegramas y despachos foráneos',
    color: 'text-sky-700',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  RUTA_INTERNA: {
    nombre: 'RUTA INTERNA',
    corto: 'RUTA INTERNA',
    descripcion: 'Sede del Palacio de Justicia, Tribunales, Fiscalía y Defensa Pública',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  OTROS_ESTADOS_MERIDA: {
    nombre: 'BOLETAS DE OTROS ESTADOS Y MÉRIDA',
    corto: 'OTROS ESTADOS / MÉRIDA',
    descripcion: 'Exhortos, despachos de comisión, Mérida Capital y otros Estados de la República',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
  },
};

export interface TribunalInfo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'CONTROL' | 'JUICIO' | 'EJECUCION' | 'TPM' | 'SPA';
  juez?: string;
  secretario?: string;
}

export interface Alguacil {
  id: string;
  nombre: string;
  cedula?: string;
  telefono?: string;
  activo: boolean;
}

export type TipoCitado = 
  | 'FISCALIA' 
  | 'ABOGADO_DEFENSA' 
  | 'DEFENSA_PUBLICA'
  | 'IMPUTADO' 
  | 'ACUSADO'
  | 'PENADO'
  | 'VICTIMA' 
  | 'QUERELLANTE'
  | 'DENUNCIANTE'
  | 'ORGANO_POLICIAL'
  | 'TESTIGO' 
  | 'EXPERTO' 
  | 'TERCERO'
  | 'FIADOR'
  | 'APODERADO'
  | 'REPRESENTANTE_LEGAL'
  | 'OTRO';

export const TIPOS_CITADO_OPTIONS: { value: TipoCitado; label: string }[] = [
  { value: 'FISCALIA', label: 'Fiscalía (MP)' },
  { value: 'ABOGADO_DEFENSA', label: 'Defensa Privada' },
  { value: 'DEFENSA_PUBLICA', label: 'Defensa Pública' },
  { value: 'IMPUTADO', label: 'Imputado' },
  { value: 'ACUSADO', label: 'Acusado' },
  { value: 'PENADO', label: 'Penado' },
  { value: 'VICTIMA', label: 'Víctima' },
  { value: 'QUERELLANTE', label: 'Querellante' },
  { value: 'DENUNCIANTE', label: 'Denunciante' },
  { value: 'ORGANO_POLICIAL', label: 'Policía / CICPC' },
  { value: 'TESTIGO', label: 'Testigo' },
  { value: 'EXPERTO', label: 'Experto / Perito' },
  { value: 'TERCERO', label: 'Tercero Interesado' },
  { value: 'FIADOR', label: 'Fiador / Garante' },
  { value: 'APODERADO', label: 'Apoderado Judicial' },
  { value: 'REPRESENTANTE_LEGAL', label: 'Representante Legal' },
  { value: 'OTRO', label: 'Otro' },
];

export function getCaracterDisplay(tipo?: TipoCitado | string): string {
  switch (tipo) {
    case 'FISCALIA': return 'Fiscalía';
    case 'ABOGADO_DEFENSA': return 'Defensa';
    case 'DEFENSA_PUBLICA': return 'Defensa Pública';
    case 'IMPUTADO': return 'Imputado';
    case 'ACUSADO': return 'Acusado';
    case 'PENADO': return 'Penado';
    case 'VICTIMA': return 'Víctima';
    case 'QUERELLANTE': return 'Querellante';
    case 'DENUNCIANTE': return 'Denunciante';
    case 'ORGANO_POLICIAL': return 'Policía/CICPC';
    case 'TESTIGO': return 'Testigo';
    case 'EXPERTO': return 'Experto';
    case 'TERCERO': return 'Tercero';
    case 'FIADOR': return 'Fiador';
    case 'APODERADO': return 'Apoderado';
    case 'REPRESENTANTE_LEGAL': return 'Rep. Legal';
    case 'OTRO': return 'Otro';
    default: return tipo || 'Otro';
  }
}

export function getCaracterPriority(tipo?: TipoCitado | string): number {
  switch (tipo) {
    case 'FISCALIA': return 1;
    case 'ABOGADO_DEFENSA': return 2;
    case 'DEFENSA_PUBLICA': return 3;
    case 'IMPUTADO': return 4;
    case 'ACUSADO': return 5;
    case 'PENADO': return 6;
    case 'VICTIMA': return 7;
    case 'QUERELLANTE': return 8;
    case 'DENUNCIANTE': return 9;
    case 'ORGANO_POLICIAL': return 10;
    case 'TESTIGO': return 11;
    case 'EXPERTO': return 12;
    case 'TERCERO': return 13;
    case 'FIADOR': return 14;
    case 'APODERADO': return 15;
    case 'REPRESENTANTE_LEGAL': return 16;
    case 'OTRO': return 17;
    default: return 99;
  }
}

export type EstadoBoleta = 'ASIGNADA' | 'EN_RUTA' | 'PRACTICADA' | 'DEVUELTA_UAC' | 'DEVUELTA_TRIBUNAL' | 'NO_PRACTICADA';

export interface BoletaJudicial {
  id: string;
  numeroItem: number;
  numeroCausa: string; // Ej: LP11-Y-2026-581
  boletaNumero: string; // Ej: 4465
  notificadoCitado: string; // Ej: FISCALIA XVII, ABG. PAOLA RUIZ, IMP. JEAN CARLOS ROA
  tipoCitado: TipoCitado;
  
  // Fecha y tipo de audiencia
  esSoloNotificacion: boolean;
  fechaAudiencia: string; // YYYY-MM-DD o 'NOTIFICACION'
  horaAudiencia?: string; // Ej: "09:30 AM"
  tipoAudiencia?: string; // Preliminar, Apertura de Juicio, Continuación, Notificación, Convocatoria
  
  // Asignación interna
  fechaAsignacion: string; // YYYY-MM-DD (Fecha de ingreso/asignación)
  tribunal: string; // C1, C2, C3, J1, J2, J3, E1, E2, TPM1, TPM2, SPA 1
  
  // Artículo COPP (admite hasta 2 artículos marcados)
  articuloCOPP: ArticuloCOPP;
  articulosCOPP?: ArticuloCOPP[];
  
  // Sección de Ruta
  seccionRuta?: SeccionRuta;
  
  // Alguacil
  alguacilPractica: string; // Ej: ELISET, ÑERO, PABLO F., RENZO M.
  
  // Estado y Devoluciones
  estado: EstadoBoleta;
  devueltaAlTribunal: boolean;
  fechaDevueltaTribunal?: string; // YYYY-MM-DD
  fechaRecibidoUAC?: string; // YYYY-MM-DD (Fecha de recibido por U.A.C.)
  impresaDespacho?: boolean; // Si ya fue impresa en la lista de despacho
  fechaImpresionDespacho?: string;
  
  // Relación de Acuses para entrega a tribunales
  acuseGenerado: boolean;
  acuseNumeroControl?: string; // Número correlativo de acuse / oficio
  acuseFechaEntrega?: string;
  acuseHoraEntrega?: string; // Hora en que la secretaria recibió (ej: "10:30 AM")
  acuseRecibidoPor?: string; // Nombre y cargo de la secretaria que recibe en el tribunal
  acuseObservaciones?: string;
  
  observaciones?: string;
  direccionCitacion?: string;
  mesRuta: string; // Ej: "2026-08" (Agosto 2026)
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Determina si un artículo COPP está marcado en la boleta
 * Soporta múltiples artículos (hasta 2)
 */
export function hasArticulo(boleta: BoletaJudicial, art: ArticuloCOPP): boolean {
  if (!art) return false;
  const matchArts = (art === 'S 165' || art === 'S_165') ? ['S 165', 'S_165'] : [art];
  if (boleta.articulosCOPP && Array.isArray(boleta.articulosCOPP)) {
    return boleta.articulosCOPP.some(a => matchArts.includes(a));
  }
  if (!boleta.articuloCOPP) return false;
  const parts = boleta.articuloCOPP.split(',').map(s => s.trim());
  return parts.some(p => matchArts.includes(p as ArticuloCOPP));
}

/**
 * Alterna el marcado de un artículo en la boleta permitiendo marcar hasta 2 artículos
 */
export function toggleArticuloBoleta(
  boleta: BoletaJudicial, 
  art: ArticuloCOPP
): { articuloCOPP: ArticuloCOPP; articulosCOPP: ArticuloCOPP[] } {
  let currentList: ArticuloCOPP[] = [];
  if (boleta.articulosCOPP && Array.isArray(boleta.articulosCOPP) && boleta.articulosCOPP.length > 0) {
    currentList = [...boleta.articulosCOPP];
  } else if (boleta.articuloCOPP) {
    currentList = boleta.articuloCOPP.split(',').map(s => s.trim() as ArticuloCOPP).filter(Boolean);
  }

  const isSameArt = (a: ArticuloCOPP, b: ArticuloCOPP) => {
    if ((a === 'S 165' || a === 'S_165') && (b === 'S 165' || b === 'S_165')) return true;
    return a === b;
  };

  const existingIndex = currentList.findIndex(item => isSameArt(item, art));
  if (existingIndex >= 0) {
    // Si ya está presente, se desmarca
    currentList.splice(existingIndex, 1);
  } else {
    // Si ya tiene 2 artículos marcados, reemplaza el más antiguo para permitir máximo 2
    if (currentList.length >= 2) {
      currentList = [currentList[1], art];
    } else {
      currentList.push(art);
    }
  }

  return {
    articuloCOPP: (currentList.join(', ') || '') as ArticuloCOPP,
    articulosCOPP: currentList,
  };
}

export type NivelAlerta = 'CRITICA' | 'URGENTE' | 'PROXIMA' | 'NORMAL' | 'DEVUELTA';

export interface AlertaBoleta {
  boletaId: string;
  nivel: NivelAlerta;
  titulo: string;
  mensaje: string;
  diasRestantes?: number;
  diasDesdeAsignacion: number;
}

export interface ConfiguracionDespacho {
  entePrincipal: string; // "TRIBUNAL SUPREMO DE JUSTICIA"
  circuitoJudicial: string; // "CIRCUITO JUDICIAL PENAL EXTENSION EL VIGIA ESTADO MERIDA"
  unidad: string; // "UNIDAD DE ACTOS Y COMUNICACION / ALGUACILAZGO"
  jefeAlguacilazgo: string;
  alguacilesRuta: string; // "ALGUACILES PABLO F. - RENZO M."
  mesRutaActual: string; // "2026-08"
  añoActual: number;
}
