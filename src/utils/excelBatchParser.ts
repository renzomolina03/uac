import { 
  TipoCitado, 
  ArticuloCOPP, 
  SeccionRuta, 
  TribunalInfo, 
  Alguacil 
} from '../types/judicial';

export interface ParsedExcelRow {
  numeroCausa: string;
  boletaNumero: string;
  notificadoCitado: string;
  tipoCitado: TipoCitado;
  esSoloNotificacion: boolean;
  fechaAudiencia: string;
  tribunal: string;
  articuloCOPP: ArticuloCOPP;
  alguacilPractica: string;
  seccionRuta: SeccionRuta;
  direccionCitacion?: string;
  isValid: boolean;
  validationNote?: string;
}

/**
 * Normaliza fechas en formato DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD a YYYY-MM-DD
 */
export function normalizeDateString(rawDate: string): { isDate: boolean; formatted: string; isNotifOnly: boolean } {
  if (!rawDate) return { isDate: false, formatted: '', isNotifOnly: true };
  const upper = rawDate.trim().toUpperCase();

  if (
    upper.includes('NOTIF') || 
    upper.includes('SIN') || 
    upper === '-' || 
    upper === 'S/A' || 
    upper === 'N/A' ||
    upper === 'NO'
  ) {
    return { isDate: false, formatted: '', isNotifOnly: true };
  }

  // Formato YYYY-MM-DD
  const isoMatch = upper.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return { isDate: true, formatted: `${y}-${m}-${d}`, isNotifOnly: false };
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const latinMatch = upper.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (latinMatch) {
    const d = latinMatch[1].padStart(2, '0');
    const m = latinMatch[2].padStart(2, '0');
    let y = latinMatch[3];
    if (y.length === 2) y = `20${y}`;
    return { isDate: true, formatted: `${y}-${m}-${d}`, isNotifOnly: false };
  }

  return { isDate: false, formatted: '', isNotifOnly: true };
}

/**
 * Normaliza el Carácter / Tipo de persona citada
 */
export function normalizeTipoCitado(val: string): TipoCitado | null {
  if (!val) return null;
  const upper = val.trim().toUpperCase();

  if (upper.includes('QUEREL')) return 'QUERELLANTE';
  if (upper.includes('DENUNC')) return 'DENUNCIANTE';
  if (upper.includes('PENAD')) return 'PENADO';
  if (upper.includes('ACUS')) return 'ACUSADO';
  if (upper.includes('IMP')) return 'IMPUTADO';
  if (upper.includes('VIC')) return 'VICTIMA';
  if (upper.includes('PUB') && upper.includes('DEF')) return 'DEFENSA_PUBLICA';
  if (upper.includes('DEF') || upper.includes('ABOG')) return 'ABOGADO_DEFENSA';
  if (upper.includes('FISC') || upper.includes('MP')) return 'FISCALIA';
  if (upper.includes('TEST')) return 'TESTIGO';
  if (upper.includes('EXP') || upper.includes('PERIT')) return 'EXPERTO';
  if (upper.includes('POLI') || upper.includes('CICPC') || upper.includes('CPBEZ') || upper.includes('PNB') || upper.includes('GNB')) return 'ORGANO_POLICIAL';
  if (upper.includes('FIAD') || upper.includes('GARAN')) return 'FIADOR';
  if (upper.includes('APOD')) return 'APODERADO';
  if (upper.includes('REPR') || upper.includes('CURAD') || upper.includes('TUTOR')) return 'REPRESENTANTE_LEGAL';
  if (upper.includes('TERC')) return 'TERCERO';
  if (upper.includes('OTR')) return 'OTRO';

  return null;
}

/**
 * Detecta si una línea de texto corresponde a una cabecera de Excel
 */
export function isExcelHeaderLine(line: string): boolean {
  const upper = line.toUpperCase();
  const keywords = [
    'CAUSA', 'BOLETA', 'NOTIFICADO', 'CITADO', 'EXPEDIENTE', 
    'TRIBUNAL', 'ALGUACIL', 'AUDIENCIA', 'ARTICULO', 'ART.', 
    'ITEM', 'CARÁCTER', 'CARACTER', 'SECCIÓN', 'SECCION'
  ];
  let matches = 0;
  for (const kw of keywords) {
    if (upper.includes(kw)) matches++;
  }
  return matches >= 2;
}

/**
 * Parsea el portapapeles copiado de Excel (tab-separated o CSV)
 * y lo convierte en filas listas para el lote
 */
export function parseExcelClipboardText(
  rawText: string,
  options: {
    defaultCausaPrefix: string;
    defaultTribunal: string;
    defaultAlguacil: string;
    defaultSeccion: SeccionRuta;
    tribunales: TribunalInfo[];
    alguaciles: Alguacil[];
  }
): ParsedExcelRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  const results: ParsedExcelRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Omitir cabeceras reconocidas si están en las primeras filas
    if (i === 0 && isExcelHeaderLine(line)) {
      continue;
    }

    // Dividir columnas: preferir tabulador de Excel, fallback a ';' o ','
    let cols: string[] = [];
    if (line.includes('\t')) {
      cols = line.split('\t');
    } else if (line.includes(';')) {
      cols = line.split(';');
    } else {
      // Split por comas respetando comillas simples
      cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    }

    cols = cols.map(c => c.trim().replace(/^["']|["']$/g, '').trim());

    if (cols.length === 0 || cols.every(c => c.length === 0)) {
      continue;
    }

    // Si la primera columna es sólo el número de ítem correlativo (ej: "1", "2", "3")
    // y la segunda columna tiene pinta de Causa o Boleta, saltamos la primera columna
    if (cols.length >= 3 && /^\d{1,4}$/.test(cols[0]) && (cols[1].includes('-') || /[A-Z]/i.test(cols[1]))) {
      cols = cols.slice(1);
    }

    let colCausa = cols[0] || '';
    let colBoleta = cols[1] || '';
    let colNotificado = cols[2] || '';
    let colCaracter = cols[3] || '';
    let colAudiencia = cols[4] || '';
    let colTribunal = cols[5] || '';
    let colArticulo = cols[6] || '';
    let colAlguacil = cols[7] || '';

    // Manejar caso donde el usuario solo copió: Causa, Boleta y Notificado
    // O si la columna 3 era una fecha o "NOTIFICACION" directamente (sin columna de Carácter)
    let tipoCitado: TipoCitado = 'IMPUTADO';
    let fechaAudiencia = '';
    let esSoloNotificacion = false;

    if (colCaracter) {
      const detectedTipo = normalizeTipoCitado(colCaracter);
      if (detectedTipo) {
        tipoCitado = detectedTipo;
      } else {
        // ¿Columna 3 era en realidad la fecha o Notificación?
        const dateCheck = normalizeDateString(colCaracter);
        if (dateCheck.isDate || dateCheck.isNotifOnly) {
          // Desplazar: columna 3 es audiencia
          colAlguacil = colArticulo;
          colArticulo = colTribunal;
          colTribunal = colAudiencia;
          colAudiencia = colCaracter;
          colCaracter = '';
        }
      }
    }

    // Procesar Audiencia
    if (colAudiencia) {
      const dateInfo = normalizeDateString(colAudiencia);
      if (dateInfo.isDate) {
        fechaAudiencia = dateInfo.formatted;
        esSoloNotificacion = false;
      } else {
        esSoloNotificacion = true;
        fechaAudiencia = '';
      }
    } else {
      esSoloNotificacion = true;
      fechaAudiencia = '';
    }

    // Procesar Causa: si solo tiene el número o sufijo, completar con prefijo
    let numeroCausa = colCausa.toUpperCase().trim();
    if (numeroCausa) {
      if (!numeroCausa.startsWith('LP11-') && !numeroCausa.includes('-')) {
        // E.g. "102" -> "LP11-P-2026-102"
        const cleanPrefix = options.defaultCausaPrefix.endsWith('-') 
          ? options.defaultCausaPrefix 
          : `${options.defaultCausaPrefix}-`;
        numeroCausa = `${cleanPrefix}${numeroCausa}`;
      }
    }

    // Procesar Boleta: número limpio
    let boletaNumero = colBoleta.trim();

    // Procesar Notificado
    let notificadoCitado = colNotificado.toUpperCase().trim();

    // Procesar Tribunal
    let tribunal = options.defaultTribunal;
    if (colTribunal) {
      const upperTri = colTribunal.toUpperCase().trim();
      const matchTri = options.tribunales.find(t => 
        t.codigo.toUpperCase() === upperTri || 
        t.nombre.toUpperCase().includes(upperTri)
      );
      if (matchTri) {
        tribunal = matchTri.codigo;
      } else if (upperTri.length <= 6) {
        tribunal = upperTri;
      }
    }

    // Procesar Artículo COPP
    let articuloCOPP: ArticuloCOPP = '';
    if (colArticulo) {
      const upperArt = colArticulo.toUpperCase().replace(/\s+/g, '');
      if (upperArt.includes('167')) articuloCOPP = '167';
      else if (upperArt.includes('168')) articuloCOPP = '168';
      else if (upperArt.includes('169')) articuloCOPP = '169';
      else if (upperArt.includes('170')) articuloCOPP = '170';
      else if (upperArt.includes('171')) articuloCOPP = '171';
      else if (upperArt.includes('S165') || upperArt.includes('S_165')) articuloCOPP = 'S_165';
      else if (upperArt.includes('165')) articuloCOPP = '165';
    }

    // Procesar Alguacil
    let alguacilPractica = options.defaultAlguacil;
    if (colAlguacil) {
      const upperAlg = colAlguacil.toUpperCase().trim();
      const matchAlg = options.alguaciles.find(a => 
        a.nombre.toUpperCase().includes(upperAlg) || 
        upperAlg.includes(a.nombre.toUpperCase())
      );
      if (matchAlg) {
        alguacilPractica = matchAlg.nombre;
      } else {
        alguacilPractica = colAlguacil.trim();
      }
    }

    const isValid = numeroCausa.length >= 3 && boletaNumero.length >= 1 && notificadoCitado.length >= 2;
    let validationNote = '';
    if (!isValid) {
      if (!numeroCausa) validationNote = 'Falta Nº de Causa';
      else if (!boletaNumero) validationNote = 'Falta Boleta Nº';
      else if (!notificadoCitado) validationNote = 'Falta Notificado/Citado';
    }

    results.push({
      numeroCausa,
      boletaNumero,
      notificadoCitado,
      tipoCitado,
      esSoloNotificacion,
      fechaAudiencia,
      tribunal,
      articuloCOPP,
      alguacilPractica,
      seccionRuta: options.defaultSeccion,
      isValid,
      validationNote,
    });
  }

  return results;
}
