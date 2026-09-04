import { BoletaJudicial, hasArticulo } from '../types/judicial';

export interface HojaLote {
  numeroHoja: number; // 1, 2, 3...
  idHoja: string; // ej: "uac1233", "uac1234"
  boletas: BoletaJudicial[];
  cantidad: number;
  capacidad: number;
  estaLlena: boolean;
  rangoItems: { desde: number; hasta: number };
  totalDevueltas: number;
  pendientes: number;
  porcentajeEfectividad: number;
  conteosArticulos: {
    '167': number;
    '168': number;
    '169': number;
    '170': number;
    '171': number;
    '165': number;
    'S_165': number;
  };
  tribunalesInvolucrados: string[];
}

/**
 * Genera el identificador corto consecutivo para una hoja (ej: uac1233, uac1234).
 * Si el usuario introduce "uac1233", incrementa el número conservando el prefijo.
 */
export function generarIdHoja(idInicial: string = 'uac1233', indice: number = 0): string {
  const clean = (idInicial || '').trim() || 'uac1233';
  const match = clean.match(/^([a-zA-Z\-_]*?)(\d+)$/);

  if (!match) {
    // Si no termina en números, añade el número directamente
    return `${clean}${indice + 1}`;
  }

  const prefix = match[1];
  const numStr = match[2];
  const startNum = parseInt(numStr, 10);
  const nextNum = startNum + indice;
  
  // Conserva ceros a la izquierda si el original los tenía
  const padded = String(nextNum).padStart(numStr.length, '0');
  return `${prefix}${padded}`;
}

/**
 * Calcula la distribución por hojas (folios) del lote de boletas.
 * Cuando una hoja alcanza su capacidad (ej: 20 boletas), se llena e inicia la siguiente hoja.
 */
export function calcularHojasLote(
  boletas: BoletaJudicial[],
  capacidadPorHoja: number = 20,
  idInicial: string = 'uac1233'
): HojaLote[] {
  if (!boletas || boletas.length === 0) {
    return [];
  }

  const capacidad = Math.max(5, capacidadPorHoja || 20);
  const totalHojas = Math.ceil(boletas.length / capacidad);
  const hojas: HojaLote[] = [];

  for (let i = 0; i < totalHojas; i++) {
    const inicio = i * capacidad;
    const fin = Math.min(inicio + capacidad, boletas.length);
    const boletasHoja = boletas.slice(inicio, fin);
    const cantidad = boletasHoja.length;
    const estaLlena = cantidad >= capacidad;
    const idHoja = generarIdHoja(idInicial, i);

    const totalDevueltas = boletasHoja.filter(b => b.devueltaAlTribunal).length;
    const pendientes = cantidad - totalDevueltas;
    const porcentajeEfectividad = cantidad > 0 ? Math.round((totalDevueltas / cantidad) * 100) : 0;

    const conteosArticulos = {
      '167': boletasHoja.filter(b => hasArticulo(b, '167')).length,
      '168': boletasHoja.filter(b => hasArticulo(b, '168')).length,
      '169': boletasHoja.filter(b => hasArticulo(b, '169')).length,
      '170': boletasHoja.filter(b => hasArticulo(b, '170')).length,
      '171': boletasHoja.filter(b => hasArticulo(b, '171')).length,
      '165': boletasHoja.filter(b => hasArticulo(b, '165')).length,
      'S_165': boletasHoja.filter(b => hasArticulo(b, 'S_165')).length,
    };

    const tribunalesSet = new Set<string>();
    boletasHoja.forEach(b => {
      if (b.tribunal) tribunalesSet.add(b.tribunal);
    });

    hojas.push({
      numeroHoja: i + 1,
      idHoja,
      boletas: boletasHoja,
      cantidad,
      capacidad,
      estaLlena,
      rangoItems: { desde: inicio + 1, hasta: fin },
      totalDevueltas,
      pendientes,
      porcentajeEfectividad,
      conteosArticulos,
      tribunalesInvolucrados: Array.from(tribunalesSet),
    });
  }

  return hojas;
}

/**
 * Mapa rápido de cada boleta.id a su respectivo idHoja (ej: "uac1233")
 */
export function mapearBoletasAHojas(
  boletas: BoletaJudicial[],
  capacidadPorHoja: number = 20,
  idInicial: string = 'uac1233'
): Map<string, { idHoja: string; numeroHoja: number; posicionEnHoja: number }> {
  const map = new Map<string, { idHoja: string; numeroHoja: number; posicionEnHoja: number }>();
  const hojas = calcularHojasLote(boletas, capacidadPorHoja, idInicial);

  hojas.forEach(h => {
    h.boletas.forEach((b, idx) => {
      map.set(b.id, {
        idHoja: h.idHoja,
        numeroHoja: h.numeroHoja,
        posicionEnHoja: idx + 1,
      });
    });
  });

  return map;
}
