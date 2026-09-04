import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { 
  BoletaJudicial, 
  ConfiguracionDespacho, 
  TribunalInfo, 
  ArticuloCOPP,
  hasArticulo, 
  getCaracterDisplay, 
  getCaracterPriority 
} from '../types/judicial';
import { formatFechaDisplay, evaluarAlertaBoleta } from './alerts';
import { calcularHojasLote, HojaLote } from './sheetCalculation';

// Extender tipos de jsPDF para autotable
interface jsPDFWithPlugin extends jsPDF {
  lastAutoTable?: {
    finalY?: number;
  };
}

export interface OpcionesImpresionHojas {
  hojasSeleccionadas?: number[]; // números de hoja a imprimir (1-based), ej: [1, 2]
  capacidadPorHoja?: number; // por defecto 20 boletas por hoja
  idInicial?: string; // por defecto 'uac1233'
}

export function exportarBoletasPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  filtroTribunal?: string,
  opcionesHojas?: OpcionesImpresionHojas
) {
  const boletasAExportar = filtroTribunal
    ? boletas.filter(b => b.tribunal.toUpperCase() === filtroTribunal.toUpperCase())
    : boletas;

  if (boletasAExportar.length === 0) {
    alert('No hay boletas en el listado para generar el documento.');
    return;
  }

  const capacidad = opcionesHojas?.capacidadPorHoja || 20;
  const idInicial = opcionesHojas?.idInicial || 'uac1233';
  
  // Calcular todas las hojas del lote según su capacidad
  const todasLasHojas = calcularHojasLote(boletasAExportar, capacidad, idInicial);

  // Filtrar las hojas que el usuario seleccionó para imprimir (o imprimir todas si no hay filtro)
  const hojasAImprimir = (opcionesHojas?.hojasSeleccionadas && opcionesHojas.hojasSeleccionadas.length > 0)
    ? todasLasHojas.filter(h => opcionesHojas.hojasSeleccionadas!.includes(h.numeroHoja))
    : todasLasHojas;

  if (hojasAImprimir.length === 0) {
    alert('No has seleccionado ninguna hoja para imprimir.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  // Columnas para la tabla del listado
  const tableHeaders = [
    'Nº',
    'Nº CAUSA',
    'BOLETA Nº',
    'NOTIFICADO Y CITADO',
    'F. AUDIENCIA',
    'HORA',
    'F. ASIG.',
    'TRI',
    '167',
    '168',
    '169',
    '170',
    '171',
    '165',
    'S 165',
    'ALGUACIL',
  ];

  // Renderizar cada hoja seleccionada en su propia página física
  hojasAImprimir.forEach((hoja, sheetIdx) => {
    if (sheetIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    // 1. Encabezado institucional superior
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 15, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(config.entePrincipal, 148.5, 5.5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(config.circuitoJudicial, 148.5, 9.5, { align: 'center' });
    doc.text(config.unidad, 148.5, 13, { align: 'center' });

    // 2. Subtítulo de ruta (Izquierda)
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const tituloRuta = `CONTROL DE BOLETAS JUDICIALES - RUTA ${config.mesRutaActual.toUpperCase()}`;
    doc.text(tituloRuta, 14, 21);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Asignación: ${config.alguacilesRuta} | Fecha: ${new Date().toLocaleDateString('es-ES')}${filtroTribunal ? ` | Tribunal: ${filtroTribunal}` : ' | Todos los Tribunales'}`,
      14,
      25.5
    );

    // 3. Recuadro destacado de Identificación Corta de Hoja (Derecha)
    const badgeX = 205;
    const badgeY = 16.5;
    const badgeW = 78;
    const badgeH = 10;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`ID HOJA: ${hoja.idHoja.toUpperCase()}`, badgeX + 3, badgeY + 4.2);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const estadoHojaText = hoja.estaLlena 
      ? `LLENA (${hoja.cantidad}/${hoja.capacidad})` 
      : `EN CURSO (${hoja.cantidad}/${hoja.capacidad})`;
    doc.text(`FOLIO ${hoja.numeroHoja} DE ${todasLasHojas.length} | ${estadoHojaText}`, badgeX + 3, badgeY + 8);

    // 4. Preparar filas de la tabla correspondientes a esta hoja
    const tableBody = hoja.boletas.map((b, idx) => {
      const itemNum = (hoja.numeroHoja - 1) * hoja.capacidad + idx + 1;
      return [
        itemNum,
        b.numeroCausa,
        b.boletaNumero,
        b.notificadoCitado,
        b.esSoloNotificacion ? 'NOTIFICACIÓN' : formatFechaDisplay(b.fechaAudiencia),
        b.horaAudiencia || '',
        formatFechaDisplay(b.fechaAsignacion),
        b.tribunal,
        hasArticulo(b, '167') ? '1' : '',
        hasArticulo(b, '168') ? '1' : '',
        hasArticulo(b, '169') ? '1' : '',
        hasArticulo(b, '170') ? '1' : '',
        hasArticulo(b, '171') ? '1' : '',
        hasArticulo(b, '165') ? '1' : '',
        hasArticulo(b, 'S_165') ? '1' : '',
        b.alguacilPractica || '',
      ];
    });

    // 5. Generar tabla de la hoja con jspdf-autotable
    autoTable(doc, {
      startY: 28,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.2,
        minCellHeight: 6.2,
        valign: 'middle',
        font: 'helvetica',
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 34 },
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 55 }, // NOTIFICADO Y CITADO centrado
        4: { halign: 'center', cellWidth: 27 }, // F. AUDIENCIA ampliado para que 'NOTIFICACIÓN' quepa sin partir la N
        5: { halign: 'center', cellWidth: 14 }, // HORA
        6: { halign: 'center', cellWidth: 15 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 11 },
        8: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 167
        9: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 168
        10: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 169
        11: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 170
        12: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 171
        13: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 165
        14: { halign: 'center', fontStyle: 'bold', cellWidth: 11 }, // S 165
        15: { halign: 'center', cellWidth: 24 },   // ALGUACIL
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw || '').toUpperCase();
          if (val.includes('NOTIFICAC')) {
            data.cell.styles.fontSize = 6.7;
            data.cell.styles.cellPadding = 0.6;
          }
        }
        if (data.section === 'head') {
          if (data.column.index === 8) { // 167 Gris
            data.cell.styles.fillColor = [143, 156, 168];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 9) { // 168 Azul
            data.cell.styles.fillColor = [92, 152, 226];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 10) { // 169 Azul Acero
            data.cell.styles.fillColor = [142, 168, 190];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 11) { // 170 Verde Lima
            data.cell.styles.fillColor = [157, 206, 100];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 12) { // 171 Rojo
            data.cell.styles.fillColor = [231, 68, 75];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 13) { // 165 Amarillo
            data.cell.styles.fillColor = [252, 228, 68];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 14) { // S 165 Naranja
            data.cell.styles.fillColor = [223, 122, 64];
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      }
    });

    // 6. Resumen y Firmas oficiales de esta hoja al pie de la página
    const tableEnd = doc.lastAutoTable?.finalY || 160;
    const finalY = Math.max(tableEnd + 3, 168);

    renderSheetSummaryAndSignatures(doc, config, hoja, todasLasHojas.length, finalY);

    // Pie de página de seguridad
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Hoja Oficial: ${hoja.idHoja} | Circuito Judicial Penal del Estado Mérida | Impresión de Folio: Pág. ${sheetIdx + 1} de ${hojasAImprimir.length}`,
      14,
      206
    );
  });

  // Guardar archivo PDF con nombre descriptivo
  let fileName = '';
  if (hojasAImprimir.length === 1) {
    fileName = `Listado_Boletas_Hoja_${hojasAImprimir[0].idHoja}_${config.mesRutaActual}.pdf`;
  } else if (hojasAImprimir.length === todasLasHojas.length) {
    fileName = `Listado_Boletas_Completo_${todasLasHojas[0]?.idHoja}_al_${todasLasHojas[todasLasHojas.length - 1]?.idHoja}_${config.mesRutaActual}.pdf`;
  } else {
    fileName = `Listado_Boletas_Hojas_Seleccionadas_${hojasAImprimir.length}_folioso_${config.mesRutaActual}.pdf`;
  }

  doc.save(fileName);
}

function renderSheetSummaryAndSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  hoja: HojaLote,
  totalHojasLote: number,
  startY: number
) {
  // Recuadro de Totales de Esta Hoja
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, startY, 136, 23, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, startY, 136, 23, 2, 2, 'S');

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`RESUMEN DE HOJA [${hoja.idHoja.toUpperCase()} - FOLIO ${hoja.numeroHoja}/${totalHojasLote}]:`, 18, startY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    `Boletas en esta Hoja: ${hoja.cantidad} de ${hoja.capacidad} (${hoja.estaLlena ? 'LLENA' : 'EN CURSO'})`,
    18,
    startY + 9
  );
  doc.text(
    `Devueltas al Tribunal: ${hoja.totalDevueltas} (${hoja.porcentajeEfectividad}%) | Pendientes: ${hoja.pendientes}`,
    18,
    startY + 13.5
  );
  doc.text(
    `Tribunales: ${hoja.tribunalesInvolucrados.slice(0, 5).join(', ')}${hoja.tribunalesInvolucrados.length > 5 ? '...' : ''}`,
    18,
    startY + 18
  );

  const c = hoja.conteosArticulos;
  doc.text(`Artículos COPP: 167(${c['167']}) 168(${c['168']}) 169(${c['169']}) 170(${c['170']})`, 76, startY + 9);
  doc.text(`                171(${c['171']}) 165(${c['165']}) S 165(${c['S_165']})`, 76, startY + 13.5);

  // Firmas de Responsabilidad (A la derecha)
  const firmaY = startY + 14.5;
  doc.setDrawColor(100, 116, 139);
  
  // Firma 1: Alguacilazgo
  doc.line(162, firmaY, 217, firmaY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALGUACIL DISTRIBUIDOR', 189.5, firmaY + 3.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Unidad de Actos y Comunicación', 189.5, firmaY + 6.2, { align: 'center' });

  // Firma 2: Tribunal Receptor / Coordinador
  doc.line(230, firmaY, 285, firmaY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.text('COORDINACIÓN / SECRETARÍA', 257.5, firmaY + 3.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Sello y Recibido Conforme', 257.5, firmaY + 6.2, { align: 'center' });
}

export function exportarPlanillaAcusesPDF(
  tribunalNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  fechaEntregaCustom?: string,
  alguacilSeleccionado?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  // Membrete Judicial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 105, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 105, 19, { align: 'center' });
  doc.text(config.unidad, 105, 23, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 26, 196, 26);

  // Título del Oficio de Entrega de Acuses
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILLA DE RELACIÓN Y ENTREGA DE ACUSES DE BOLETAS', 105, 33, { align: 'center' });

  // Cuadro informativo limpio: ELIMINADO Nº DE OFICIO / CONTROL y FUNCIONARIO ENTREGA
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 37, 182, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 37, 182, 13, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`TRIBUNAL DESTINATARIO:`, 18, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(tribunalNombre, 62, 45);

  // Fecha de entrega (por defecto el día siguiente si no se especifica)
  const fechaManana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const fechaEntregaFinal = fechaEntregaCustom 
    ? (fechaEntregaCustom.includes('-') ? formatFechaDisplay(fechaEntregaCustom) : fechaEntregaCustom)
    : formatFechaDisplay(fechaManana);

  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA DE ENTREGA:`, 130, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(fechaEntregaFinal, 164, 45);

  // Ordenar boletas y detectar duplicados por (tri, numeroCausa, boletaNumero)
  // Requerimiento: Si hay varias boletas con la misma tri, Nº DE CAUSA, BOLETA Nº, 
  // solo se envía al tribunal consolidado con Nº DE CAUSA, BOLETA Nº, CARÁCTER, TRI.
  // Orden en carácter: Fiscalia, Defensa, Imputado, Víctima, Policia/CICPC, Testigo, Experto, Otro.
  const boletasConsolidadasMap = new Map<string, {
    numeroCausa: string;
    boletaNumero: string;
    tribunal: string;
    caracteres: string[];
    notificados: string[];
    fechaAudiencia: string;
    esSoloNotificacion: boolean;
    horaAudiencia: string;
    articulos: string[];
    minCaracterPriority: number;
  }>();

  for (const b of boletas) {
    const key = `${(b.tribunal || '').trim().toUpperCase()}|${(b.numeroCausa || '').trim().toUpperCase()}|${(b.boletaNumero || '').trim().toUpperCase()}`;
    const caracterStr = getCaracterDisplay(b.tipoCitado);
    const caracterPrio = getCaracterPriority(b.tipoCitado);
    const arts = b.articulosCOPP && b.articulosCOPP.length > 0 
      ? b.articulosCOPP 
      : (b.articuloCOPP ? [b.articuloCOPP] : []);

    if (!boletasConsolidadasMap.has(key)) {
      boletasConsolidadasMap.set(key, {
        numeroCausa: b.numeroCausa,
        boletaNumero: b.boletaNumero,
        tribunal: b.tribunal,
        caracteres: [caracterStr],
        notificados: b.notificadoCitado ? [b.notificadoCitado] : [],
        fechaAudiencia: b.fechaAudiencia,
        esSoloNotificacion: !!b.esSoloNotificacion,
        horaAudiencia: b.horaAudiencia || '',
        articulos: [...arts],
        minCaracterPriority: caracterPrio,
      });
    } else {
      const existing = boletasConsolidadasMap.get(key)!;
      if (!existing.caracteres.includes(caracterStr)) {
        existing.caracteres.push(caracterStr);
      }
      if (b.notificadoCitado && !existing.notificados.includes(b.notificadoCitado)) {
        existing.notificados.push(b.notificadoCitado);
      }
      for (const a of arts) {
        if (!existing.articulos.includes(a)) {
          existing.articulos.push(a);
        }
      }
      if (caracterPrio < existing.minCaracterPriority) {
        existing.minCaracterPriority = caracterPrio;
      }
      if (!existing.horaAudiencia && b.horaAudiencia) {
        existing.horaAudiencia = b.horaAudiencia;
      }
      if (existing.esSoloNotificacion && !b.esSoloNotificacion) {
        existing.esSoloNotificacion = false;
        existing.fechaAudiencia = b.fechaAudiencia;
      }
    }
  }

  // Ordenar consolidado: primero por Nº Causa, luego por Boleta Nº, luego por prioridad de Carácter
  const boletasConsolidadas = Array.from(boletasConsolidadasMap.values()).sort((a, b) => {
    if (a.numeroCausa !== b.numeroCausa) {
      return a.numeroCausa.localeCompare(b.numeroCausa);
    }
    if (a.boletaNumero !== b.boletaNumero) {
      return a.boletaNumero.localeCompare(b.boletaNumero);
    }
    return a.minCaracterPriority - b.minCaracterPriority;
  });

  const tableHeaders = ['Nº', 'Nº DE CAUSA', 'BOLETA Nº', 'CARÁCTER', 'TRI', 'NOTIFICADO Y CITADO', 'F. AUDIENCIA', 'HORA', 'ART.'];
  const tableBody = boletasConsolidadas.map((item, idx) => {
    const artDisplay = item.articulos.length > 0 
      ? item.articulos.join(', ') 
      : '-';

    return [
      idx + 1,
      item.numeroCausa,
      item.boletaNumero,
      item.caracteres.join(', '),
      item.tribunal,
      item.notificados.join(' / '),
      item.esSoloNotificacion ? 'NOTIFICACIÓN' : formatFechaDisplay(item.fechaAudiencia),
      item.horaAudiencia || '-',
      artDisplay,
    ];
  });

  autoTable(doc, {
    startY: 53,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
      5: { halign: 'center', cellWidth: 44 }, // NOTIFICADO Y CITADO centrado
      6: { halign: 'center', cellWidth: 24 }, // F. AUDIENCIA ampliado para NOTIFICACIÓN
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 6) {
        const val = String(data.cell.raw || '').toUpperCase();
        if (val.includes('NOTIFICAC')) {
          data.cell.styles.fontSize = 6.8;
          data.cell.styles.cellPadding = 0.8;
        }
      }
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  const pageHeight = doc.internal.pageSize.height;

  const renderSignatures = (posY: number) => {
    // Texto legal
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Se hace formal entrega a la Secretaría de este Despacho Judicial de los acuses de las boletas supra indicadas para ser agregadas a sus respectivos autos y expedientes.`,
      14,
      posY,
      { maxWidth: 182 }
    );

    const firmaBoxY = posY + 6;

    // Determinar Alguacil generado por el sistema
    const alguacilesLista = Array.from(new Set(boletas.map(b => b.alguacilPractica).filter(Boolean)));
    const alguacilGenerado = alguacilSeleccionado || alguacilesLista.join(', ') || config.alguacilesRuta || 'ALGUACILAZGO';

    // ENTREGADO POR (ALGUACILAZGO):
    // el nombre del alguacil generado por el sistema
    // encargado RENZO M.
    doc.rect(14, firmaBoxY, 86, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, firmaBoxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Alguacil: ${alguacilGenerado}`, 16, firmaBoxY + 13, { maxWidth: 82 });
    const textoEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
      ? `ENCARGADO: ${config.jefeAlguacilazgo}`
      : 'ENCARGADO:';
    doc.text(textoEncargado, 16, firmaBoxY + 21);
    doc.text(`Firma: __________________________________`, 16, firmaBoxY + 31);

    // RECIBIDO POR (SECRETARÍA TRIBUNAL):
    // Nombre: _________________________________
    // FECHA: ________________ Hora: ___________
    // Firma y Sello: _____________________
    doc.rect(110, firmaBoxY, 86, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RECIBIDO POR (SECRETARÍA TRIBUNAL):', 112, firmaBoxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Nombre: _________________________________`, 112, firmaBoxY + 14);
    doc.text(`FECHA: ________________ Hora: ___________`, 112, firmaBoxY + 22);
    doc.text(`Firma y Sello: __________________________`, 112, firmaBoxY + 31);
  };

  if (finalY > pageHeight - 50) {
    doc.addPage();
    renderSignatures(20);
  } else {
    renderSignatures(finalY);
  }

  doc.save(`Acuse_Entrega_${tribunalNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Genera el Oficio Oficial de Rendición de Estadísticas Globales por Artículos del COPP y Tribunales
 * con Código QR institucional integrado en la esquina superior derecha
 */
export async function exportarOficioEstadisticasGlobalesPDF(
  boletas: BoletaJudicial[],
  tribunales: TribunalInfo[],
  config: ConfiguracionDespacho
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const totalBoletas = boletas.length;
  const totalDevueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const efectividadGlobal = totalBoletas > 0 ? ((totalDevueltas / totalBoletas) * 100).toFixed(1) : '100.0';

  // Generar Código QR con autenticación y datos consolidados
  const qrPayload = JSON.stringify({
    organismo: 'PODER JUDICIAL - VENEZUELA',
    unidad: 'ALGUACILAZGO PENAL EL VIGIA',
    mes: config.mesRutaActual,
    totalBoletas,
    practicadas: totalDevueltas,
    efectividad: `${efectividadGlobal}%`,
    encargado: config.jefeAlguacilazgo || 'RENZO M.',
    fechaEmision: new Date().toISOString(),
    controlId: `EST-COPP-${Date.now().toString(36).toUpperCase()}`
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 200,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' }
  });

  // Membrete Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 85, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 85, 19, { align: 'center' });
  doc.text(config.unidad, 85, 23, { align: 'center' });

  // Estampar Código QR en la esquina superior derecha
  doc.addImage(qrDataUrl, 'PNG', 165, 8, 30, 30);
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('VALIDACIÓN OFICIAL QR', 180, 40, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 160, 28);

  // Encabezado del Oficio
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`OFICIO Nº UAC-EST-${config.mesRutaActual.replace(/\s+/g, '-').toUpperCase()}`, 14, 36);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`CIUDADANO(A) JUEZ(A) PRESIDENTE(A) / COORDINADOR(A) DEL CIRCUITO JUDICIAL PENAL`, 14, 43);
  const remitenteEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN (${config.jefeAlguacilazgo})`
    : 'DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN';
  doc.text(remitenteEncargado, 14, 48);
  doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-ES')}`, 14, 53);
  doc.setFont('helvetica', 'bold');
  doc.text(`ASUNTO: OFICIO DE RENDICIÓN DE ESTADÍSTICAS GLOBALES POR ARTÍCULOS DEL COPP`, 14, 58);

  // Matriz de Estadísticas por Artículos y Tribunales
  const tableHeaders = ['TRIBUNAL', '167', '168', '169', '170', '171', '165', 'S 165', 'TOTAL', 'PRACT.', '% EFECT.'];

  const rows = tribunales.map(t => {
    const courtBoletas = boletas.filter(b => b.tribunal.toUpperCase() === t.codigo.toUpperCase());
    const c167 = courtBoletas.filter(b => hasArticulo(b, '167')).length;
    const c168 = courtBoletas.filter(b => hasArticulo(b, '168')).length;
    const c169 = courtBoletas.filter(b => hasArticulo(b, '169')).length;
    const c170 = courtBoletas.filter(b => hasArticulo(b, '170')).length;
    const c171 = courtBoletas.filter(b => hasArticulo(b, '171')).length;
    const c165 = courtBoletas.filter(b => hasArticulo(b, '165')).length;
    const cS165 = courtBoletas.filter(b => hasArticulo(b, 'S_165')).length;
    const total = courtBoletas.length;
    const devueltas = courtBoletas.filter(b => b.devueltaAlTribunal).length;
    const pct = total > 0 ? `${Math.round((devueltas / total) * 100)}%` : '0%';

    return [
      `${t.codigo} - ${t.nombre.length > 22 ? t.nombre.slice(0, 20) + '...' : t.nombre}`,
      c167 || '-',
      c168 || '-',
      c169 || '-',
      c170 || '-',
      c171 || '-',
      c165 || '-',
      cS165 || '-',
      total,
      devueltas,
      pct
    ];
  });

  // Fila de Totales
  const tot167 = boletas.filter(b => hasArticulo(b, '167')).length;
  const tot168 = boletas.filter(b => hasArticulo(b, '168')).length;
  const tot169 = boletas.filter(b => hasArticulo(b, '169')).length;
  const tot170 = boletas.filter(b => hasArticulo(b, '170')).length;
  const tot171 = boletas.filter(b => hasArticulo(b, '171')).length;
  const tot165 = boletas.filter(b => hasArticulo(b, '165')).length;
  const totS165 = boletas.filter(b => hasArticulo(b, 'S_165')).length;

  rows.push([
    'TOTAL GENERAL',
    tot167,
    tot168,
    tot169,
    tot170,
    tot171,
    tot165,
    totS165,
    totalBoletas,
    totalDevueltas,
    `${efectividadGlobal}%`
  ]);

  autoTable(doc, {
    startY: 64,
    head: [tableHeaders],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 54 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
    },
    didParseCell: function(data) {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 190) + 10;

  // Cuadro de firmas oficial
  doc.rect(14, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, finalY + 6);
  doc.setFont('helvetica', 'normal');
  const firmaEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `ENCARGADO: ${config.jefeAlguacilazgo}`
    : 'ENCARGADO:';
  doc.text(firmaEncargado, 16, finalY + 16);
  doc.text(`Firma y Sello: __________________________`, 16, finalY + 28);

  doc.rect(110, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBIDO CONFORME (PRESIDENCIA):', 112, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: _________________________________`, 112, finalY + 16);
  doc.text(`FECHA: ________________ Hora: ___________`, 112, finalY + 24);
  doc.text(`Firma y Sello: __________________________`, 112, finalY + 31);

  doc.save(`Oficio_Rendicion_Estadisticas_Globales_COPP_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Genera el Oficio de Rendición por Tribunal con desglose de los 7 Artículos del COPP,
 * efectividad porcentual, firmas oficiales y Código QR de validación institucional.
 * Formato ejecutivo oficial (sin listado detallado de boletas individuales).
 */
export async function exportarInformeMatrizTribunalPDF(
  tribunal: TribunalInfo,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const courtBoletas = boletas.filter(b => b.tribunal.toUpperCase() === tribunal.codigo.toUpperCase());
  const total = courtBoletas.length;
  const devueltas = courtBoletas.filter(b => b.devueltaAlTribunal).length;
  const pctEfectividad = total > 0 ? Math.round((devueltas / total) * 100) : 0;

  // Conteo por cada uno de los 7 Artículos del COPP para este Tribunal
  const tot167 = courtBoletas.filter(b => hasArticulo(b, '167')).length;
  const tot168 = courtBoletas.filter(b => hasArticulo(b, '168')).length;
  const tot169 = courtBoletas.filter(b => hasArticulo(b, '169')).length;
  const tot170 = courtBoletas.filter(b => hasArticulo(b, '170')).length;
  const tot171 = courtBoletas.filter(b => hasArticulo(b, '171')).length;
  const tot165 = courtBoletas.filter(b => hasArticulo(b, '165')).length;
  const totS165 = courtBoletas.filter(b => hasArticulo(b, 'S_165')).length;

  // Generar QR de Validación para el Oficio del Tribunal
  const qrPayload = JSON.stringify({
    tipo: 'OFICIO DE RENDICION POR TRIBUNAL (COPP)',
    tribunal: tribunal.codigo,
    juzgado: tribunal.nombre,
    circuito: config.circuitoJudicial,
    totalBoletas: total,
    practicadas: devueltas,
    pendientes: total - devueltas,
    efectividad: `${pctEfectividad}%`,
    desgloseCOPP: {
      '167': tot167,
      '168': tot168,
      '169': tot169,
      '170': tot170,
      '171': tot171,
      '165': tot165,
      'S165': totS165,
    },
    fecha: new Date().toISOString(),
    encargado: config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO' ? config.jefeAlguacilazgo : 'ENCARGADO DE ALGUACILAZGO',
    controlId: `EST-TRI-${tribunal.codigo}-${Date.now().toString(36).toUpperCase()}`
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 220,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' }
  });

  // Membrete Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 85, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 85, 19, { align: 'center' });
  doc.text(config.unidad, 85, 23, { align: 'center' });

  // Estampar Código QR en la esquina superior derecha
  doc.addImage(qrDataUrl, 'PNG', 165, 8, 30, 30);
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('VALIDACIÓN OFICIAL QR', 180, 40, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 160, 28);

  // Encabezado del Oficio
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`OFICIO Nº UAC-TRI-${tribunal.codigo.toUpperCase()}-${config.mesRutaActual.replace(/\s+/g, '-').toUpperCase()}`, 14, 36);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`CIUDADANO(A) JUEZ(A) Y SECRETARIO(A) DEL TRIBUNAL ${tribunal.codigo.toUpperCase()} (${tribunal.nombre.toUpperCase()})`, 14, 43);
  const remitenteEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN (${config.jefeAlguacilazgo})`
    : 'DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN';
  doc.text(remitenteEncargado, 14, 48);
  doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-ES')}`, 14, 53);
  doc.setFont('helvetica', 'bold');
  doc.text(`ASUNTO: OFICIO DE RENDICIÓN DE ESTADÍSTICAS POR ARTÍCULOS DEL COPP`, 14, 58);

  // Columnas de la Matriz Oficial
  const tableHeaders = ['CARÁCTER / SUJETO PROCESAL', '167', '168', '169', '170', '171', '165', 'S 165', 'TOTAL', 'PRACT.', '% EFECT.'];

  // Categorías de Sujetos Procesales
  const categoriasSujetos: { label: string; filter: (b: BoletaJudicial) => boolean }[] = [
    {
      label: 'DEFENSA (PÚBLICA / PRIVADA)',
      filter: (b) => b.tipoCitado === 'ABOGADO_DEFENSA' || b.tipoCitado === 'DEFENSA_PUBLICA'
    },
    {
      label: 'MINISTERIO PÚBLICO (FISCALÍAS)',
      filter: (b) => b.tipoCitado === 'FISCALIA'
    },
    {
      label: 'IMPUTADOS / ACUSADOS / PENADOS',
      filter: (b) => b.tipoCitado === 'IMPUTADO' || b.tipoCitado === 'ACUSADO' || b.tipoCitado === 'PENADO'
    },
    {
      label: 'VÍCTIMAS, QUERELLANTES Y DENUNC.',
      filter: (b) => b.tipoCitado === 'VICTIMA' || b.tipoCitado === 'QUERELLANTE' || b.tipoCitado === 'DENUNCIANTE'
    },
    {
      label: 'TESTIGOS Y EXPERTOS',
      filter: (b) => b.tipoCitado === 'TESTIGO' || b.tipoCitado === 'EXPERTO'
    },
    {
      label: 'CUERPOS POLICIALES / MILITARES',
      filter: (b) => b.tipoCitado === 'ORGANO_POLICIAL'
    },
    {
      label: 'OTROS (TERCEROS / FIADORES / REP.)',
      filter: (b) => ['TERCERO', 'FIADOR', 'APODERADO', 'REPRESENTANTE_LEGAL', 'OTRO'].includes(b.tipoCitado) || 
                     !['ABOGADO_DEFENSA', 'DEFENSA_PUBLICA', 'FISCALIA', 'IMPUTADO', 'ACUSADO', 'PENADO', 'VICTIMA', 'QUERELLANTE', 'DENUNCIANTE', 'TESTIGO', 'EXPERTO', 'ORGANO_POLICIAL'].includes(b.tipoCitado)
    }
  ];

  const rowsSujetos = categoriasSujetos.map(cat => {
    const sub = courtBoletas.filter(cat.filter);
    const c167 = sub.filter(b => hasArticulo(b, '167')).length;
    const c168 = sub.filter(b => hasArticulo(b, '168')).length;
    const c169 = sub.filter(b => hasArticulo(b, '169')).length;
    const c170 = sub.filter(b => hasArticulo(b, '170')).length;
    const c171 = sub.filter(b => hasArticulo(b, '171')).length;
    const c165 = sub.filter(b => hasArticulo(b, '165')).length;
    const cS165 = sub.filter(b => hasArticulo(b, 'S_165')).length;
    const tot = sub.length;
    const dev = sub.filter(b => b.devueltaAlTribunal).length;
    const pct = tot > 0 ? `${Math.round((dev / tot) * 100)}%` : '0%';

    return [
      cat.label,
      c167 || '-',
      c168 || '-',
      c169 || '-',
      c170 || '-',
      c171 || '-',
      c165 || '-',
      cS165 || '-',
      tot,
      dev,
      pct
    ];
  });

  // Fila Total de Sujetos
  rowsSujetos.push([
    'TOTAL GENERAL',
    tot167 || 0,
    tot168 || 0,
    tot169 || 0,
    tot170 || 0,
    tot171 || 0,
    tot165 || 0,
    totS165 || 0,
    total,
    devueltas,
    `${pctEfectividad}%`
  ]);

  // Tabla 1: Desglose por Sujeto / Carácter Procesal
  autoTable(doc, {
    startY: 64,
    head: [tableHeaders],
    body: rowsSujetos,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 54 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
    },
    didParseCell: function(data) {
      if (data.row.index === rowsSujetos.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 135) + 18;

  // Cuadro de firmas oficial
  doc.rect(14, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, finalY + 6);
  doc.setFont('helvetica', 'normal');
  const firmaEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `ENCARGADO: ${config.jefeAlguacilazgo}`
    : 'ENCARGADO:';
  doc.text(firmaEncargado, 16, finalY + 16);
  doc.text(`Firma y Sello: __________________________`, 16, finalY + 28);

  doc.rect(110, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.text(`RECIBIDO CONFORME (SECRETARÍA TRIBUNAL ${tribunal.codigo}):`, 112, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre Secretaria / Receptor: _____________________`, 112, finalY + 16);
  doc.text(`FECHA: ________________ Hora: ___________`, 112, finalY + 24);
  doc.text(`Firma y Sello: __________________________`, 112, finalY + 31);

  doc.save(`Oficio_Rendicion_Tribunal_${tribunal.codigo}_COPP_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Oficio por Tribunal - Sin listado detallado de boletas (delega al formato ejecutivo oficial)
 */
export async function exportarListadoDiligenciasRutasPDF(
  tribunal: TribunalInfo,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho
) {
  // Siguiendo la instrucción de eliminar el listado detallado de boletas individuales,
  // se emite el Oficio formal de Rendición por Tribunal con Artículos del COPP y Código QR.
  return exportarInformeMatrizTribunalPDF(tribunal, boletas, config);
}

/**
 * Reporte Oficial para Imprimir por Tribunal con el resultado completo:
 * Incluye Artículo COPP, Alguacil que practicó, Estado, Audiencia y Firmas.
 */
export function exportarReporteTribunalResultadosPDF(
  tribunalCodigo: string,
  tribunalNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const boletasTribunal = boletas.filter(
    b => b.tribunal.toUpperCase() === tribunalCodigo.toUpperCase()
  );

  // Encabezado institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal, 148.5, 7, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 148.5, 11, { align: 'center' });
  doc.text(config.unidad, 148.5, 15, { align: 'center' });

  // Subtítulo del Reporte por Tribunal
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 21, 269, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 21, 269, 13, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`REPORTE DE BOLETAS Y RESULTADOS DE PRÁCTICA - ${tribunalCodigo.toUpperCase()}`, 18, 27);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Despacho: ${tribunalNombre} | Total Boletas: ${boletasTribunal.length} | Fecha de Emisión: ${new Date().toLocaleDateString('es-ES')}`,
    18,
    31.5
  );

  // Columnas de la tabla
  const tableHeaders = [
    'Nº',
    'Nº DE CAUSA',
    'BOLETA Nº',
    'PERSONA NOTIFICADA / CITADA',
    'CARÁCTER',
    'F. AUDIENCIA',
    'ART. COPP',
    'ALGUACIL QUE PRACTICÓ',
    'RESULTADO / ESTADO',
    'RECIBIDO U.A.C.',
    'DEVUELTA TRIBUNAL',
  ];

  const tableBody = boletasTribunal.map((b, idx) => {
    let resultadoTexto = b.devueltaAlTribunal
      ? 'DEVUELTA A TRIBUNAL'
      : b.estado === 'PRACTICADA'
      ? 'PRACTICADA (POSITIVA)'
      : b.estado === 'NO_PRACTICADA'
      ? 'NO PRACTICADA'
      : 'EN GESTIÓN / RUTA';

    return [
      idx + 1,
      b.numeroCausa,
      b.boletaNumero,
      b.notificadoCitado,
      b.tipoCitado || 'IMPUTADO',
      b.esSoloNotificacion ? 'NOTIFICACIÓN' : formatFechaDisplay(b.fechaAudiencia),
      b.articuloCOPP === 'S_165' ? 'S 165' : (b.articuloCOPP || 'SIN ASIGNAR'),
      b.alguacilPractica || 'SIN ASIGNAR',
      resultadoTexto,
      b.fechaRecibidoUAC ? formatFechaDisplay(b.fechaRecibidoUAC) : '-',
      b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : (b.devueltaAlTribunal ? 'SÍ' : 'PENDIENTE'),
    ];
  });

  autoTable(doc, {
    startY: 37,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      valign: 'middle',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'left', cellWidth: 54 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      7: { halign: 'left', fontStyle: 'bold', cellWidth: 30 },
      8: { halign: 'center', cellWidth: 28 },
      9: { halign: 'center', cellWidth: 20 },
      10: { halign: 'center', cellWidth: 21 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: function(data) {
      // Resaltar Artículo COPP
      if (data.section === 'body' && data.column.index === 6) {
        const art = String(data.cell.raw || '');
        if (art === '167') {
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.textColor = [15, 23, 42];
        } else if (art === '168') {
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.textColor = [29, 78, 216];
        } else if (art === '169') {
          data.cell.styles.fillColor = [224, 242, 254];
          data.cell.styles.textColor = [3, 105, 161];
        } else if (art === '170') {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [4, 120, 87];
        } else if (art === '171') {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [185, 28, 28];
        } else if (art === '165') {
          data.cell.styles.fillColor = [254, 240, 138];
          data.cell.styles.textColor = [133, 77, 14];
        } else if (art.includes('165')) {
          data.cell.styles.fillColor = [254, 215, 170];
          data.cell.styles.textColor = [154, 52, 18];
        }
      }
      // Resaltar Resultado
      if (data.section === 'body' && data.column.index === 8) {
        const res = String(data.cell.raw || '');
        if (res.includes('DEVUELTA') || res.includes('PRACTICADA')) {
          data.cell.styles.fillColor = [240, 253, 244];
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 6;
  const pageHeight = doc.internal.pageSize.height;

  if (finalY > pageHeight - 45) {
    doc.addPage();
    renderTribunalSummaryAndSignatures(doc, config, boletasTribunal, tribunalCodigo, 15);
  } else {
    renderTribunalSummaryAndSignatures(doc, config, boletasTribunal, tribunalCodigo, finalY);
  }

  doc.save(`Resultados_Tribunal_${tribunalCodigo}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function renderTribunalSummaryAndSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  boletas: BoletaJudicial[],
  tribunalCodigo: string,
  startY: number
) {
  const total = boletas.length;
  const devueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const practicadas = boletas.filter(b => b.estado === 'PRACTICADA' || b.devueltaAlTribunal).length;

  const count167 = boletas.filter(b => b.articuloCOPP === '167').length;
  const count168 = boletas.filter(b => b.articuloCOPP === '168').length;
  const count169 = boletas.filter(b => b.articuloCOPP === '169').length;
  const count170 = boletas.filter(b => b.articuloCOPP === '170').length;
  const count171 = boletas.filter(b => b.articuloCOPP === '171').length;
  const count165 = boletas.filter(b => b.articuloCOPP === '165').length;
  const countS165 = boletas.filter(b => b.articuloCOPP === 'S_165').length;

  // Box Resumen
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, startY, 130, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, startY, 130, 26, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTALES ${tribunalCodigo}:`, 18, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Total Boletas: ${total}`, 18, startY + 10);
  doc.text(`Practicadas Concluidas: ${practicadas}`, 18, startY + 15);
  doc.text(`Devueltas a Secretaría: ${devueltas} (${total > 0 ? Math.round((devueltas/total)*100) : 0}%)`, 18, startY + 20);

  doc.text(`Artículos COPP:`, 75, startY + 10);
  doc.text(`167(${count167}) 168(${count168}) 169(${count169}) 170(${count170})`, 75, startY + 15);
  doc.text(`171(${count171}) 165(${count165}) S 165(${countS165})`, 75, startY + 20);

  // Firmas
  const firmaY = startY + 17;
  doc.setDrawColor(100, 116, 139);

  // Alguacilazgo
  doc.line(160, firmaY, 215, firmaY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALGUACILAZGO / PRÁCTICA', 187.5, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Funcionario Responsable', 187.5, firmaY + 7, { align: 'center' });

  // Secretaría del Tribunal
  doc.line(230, firmaY, 285, firmaY);
  doc.setFont('helvetica', 'bold');
  doc.text(`SECRETARÍA ${tribunalCodigo}`, 257.5, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Sello y Recibido en Autos', 257.5, firmaY + 7, { align: 'center' });
}

export function exportarHojaRutaAlguacilPDF(
  alguacilNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  fechaRuta?: string,
  observacionesGenerales?: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const fechaImpresion = fechaRuta || new Date().toISOString().slice(0, 10);

  // Encabezado institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal, 148.5, 7, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 148.5, 11, { align: 'center' });
  doc.text(config.unidad, 148.5, 15, { align: 'center' });

  // Cuadro superior con datos del Alguacil y Enrutamiento
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 22, 269, 15, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 22, 269, 15, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('HOJA DE RUTA / LISTADO DE BOLETAS A PRACTICAR', 18, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`ALGUACIL ASIGNADO:`, 18, 33);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(alguacilNombre.toUpperCase(), 57, 33);

  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA DE ASIGNACIÓN / RUTA:`, 135, 33);
  doc.setFont('helvetica', 'normal');
  doc.text(formatFechaDisplay(fechaImpresion), 190, 33);

  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL BOLETAS:`, 225, 33);
  doc.setFont('helvetica', 'normal');
  doc.text(`${boletas.length} orden(es)`, 255, 33);

  // Columnas para la tabla de práctica de boletas
  const tableHeaders = [
    'Nº',
    'Nº DE CAUSA',
    'BOLETA Nº',
    'TRIB.',
    'PERSONA A CITAR / NOTIFICAR',
    'DIRECCIÓN / SEDE',
    'F. AUDIENCIA',
    'ART.',
    'RESULTADO / FIRMA DEL CITADO / DILIGENCIA',
  ];

  const tableBody = boletas.map((b, idx) => {
    return [
      idx + 1,
      b.numeroCausa,
      b.boletaNumero,
      b.tribunal,
      b.notificadoCitado,
      b.direccionCitacion || 'Sede / Domicilio en autos',
      b.esSoloNotificacion ? 'SOLO NOTIF.' : formatFechaDisplay(b.fechaAudiencia),
      b.articuloCOPP,
      b.observaciones || '[  ] Positiva   [  ] Negativa   Firma: ________________',
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      valign: 'middle',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      4: { halign: 'left', fontStyle: 'bold', cellWidth: 55 },
      5: { halign: 'left', cellWidth: 50 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      8: { halign: 'left', cellWidth: 62 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  const pageHeight = doc.internal.pageSize.height;

  // Si no cabe en la misma página, agregar una nueva
  if (finalY > pageHeight - 35) {
    doc.addPage();
    renderAlguacilSignatures(doc, config, alguacilNombre, 15);
  } else {
    renderAlguacilSignatures(doc, config, alguacilNombre, finalY);
  }

  doc.save(`Hoja_Ruta_Alguacil_${alguacilNombre.replace(/\s+/g, '_')}_${fechaImpresion}.pdf`);
}

function renderAlguacilSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  alguacilNombre: string,
  startY: number
) {
  const boxWidth = 125;
  const boxHeight = 24;

  // Firma 1: Alguacil Distribuidor / Encargado
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, startY, boxWidth, boxHeight, 'F');
  doc.rect(14, startY, boxWidth, boxHeight, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ENTREGADO POR (ALGUACIL DISTRIBUIDOR / ENCARGADO):', 18, startY + 5);
  
  doc.setDrawColor(100, 116, 139);
  doc.line(25, startY + 16, 120, startY + 16);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma y Sello de Salida / Distribución', 72.5, startY + 20, { align: 'center' });

  // Firma 2: Alguacil que Practica / Recibe
  doc.rect(158, startY, boxWidth, boxHeight, 'F');
  doc.rect(158, startY, boxWidth, boxHeight, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`RECIBIDO CONFORME (ALGUACIL QUE PRACTICA):`, 162, startY + 5);

  doc.line(170, startY + 16, 265, startY + 16);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Alguacil: ${alguacilNombre.toUpperCase()} - Firma y C.I.`, 217.5, startY + 20, { align: 'center' });
}
