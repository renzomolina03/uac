import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Plus, 
  Trash2, 
  Save, 
  Building2, 
  User, 
  Calendar, 
  Scale, 
  Navigation,
  FolderOpen,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  FileSpreadsheet,
  Clipboard,
  Check
} from 'lucide-react';
import { parseExcelClipboardText, ParsedExcelRow } from '../utils/excelBatchParser';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ArticuloCOPP, 
  TipoCitado,
  TIPOS_CITADO_OPTIONS,
  SeccionRuta,
  SECCIONES_INFO
} from '../types/judicial';

interface QuickRow {
  id: string;
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
  direccionCitacion: string;
}

interface BoletaQuickBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBatch: (boletas: Partial<BoletaJudicial>[], replaceExisting?: boolean) => void;
  tribunales: TribunalInfo[];
  alguaciles: Alguacil[];
  proximoNumeroItem: number;
  mesRutaActual: string;
  boletasExistentes?: BoletaJudicial[];
}

export const BoletaQuickBatchModal: React.FC<BoletaQuickBatchModalProps> = ({
  isOpen,
  onClose,
  onSaveBatch,
  tribunales,
  alguaciles,
  proximoNumeroItem,
  mesRutaActual,
  boletasExistentes = [],
}) => {
  // Contador de boletas añadidas en esta sesión sin cerrar el modal
  const [sessionAddedCount, setSessionAddedCount] = useState<number>(0);

  // Valores globales por defecto para nuevas filas
  const [defaultTribunal, setDefaultTribunal] = useState<string>(tribunales[0]?.codigo || 'C1');
  const [defaultAlguacil, setDefaultAlguacil] = useState<string>('');
  const [defaultSeccion, setDefaultSeccion] = useState<SeccionRuta>('RUTA_NOTIFICACION_CITACION');
  const [defaultFechaAsig, setDefaultFechaAsig] = useState<string>(new Date().toISOString().slice(0, 10));
  const [causaPrefix, setCausaPrefix] = useState<string>(() => {
    return localStorage.getItem('uac_ultimo_prefijo_causa') || 'LP11-P-2026-';
  });
  const [prefixFeedback, setPrefixFeedback] = useState<string | null>(null);

  // Estado para la funcionalidad de Pegar desde Excel
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [excelRawText, setExcelRawText] = useState<string>('');
  const [excelImportMode, setExcelImportMode] = useState<'REPLACE_EMPTY' | 'APPEND'>('REPLACE_EMPTY');
  const [excelParsedRows, setExcelParsedRows] = useState<ParsedExcelRow[]>([]);

  // Última boleta registrada en el lote existente
  const ultimaBoleta = useMemo(() => {
    if (!boletasExistentes || boletasExistentes.length === 0) return null;
    return boletasExistentes[boletasExistentes.length - 1];
  }, [boletasExistentes]);

  // Si la última boleta tiene un número correlativo (ej: 025 o 104), calcular el siguiente número
  const calcularSiguienteBoletaNum = useCallback((baseNum?: string) => {
    const numRef = baseNum || ultimaBoleta?.boletaNumero;
    if (!numRef) return '';
    const match = numRef.match(/^(\D*)(\d+)(\D*)$/);
    if (match) {
      const prefix = match[1];
      const numDigits = match[2];
      const suffix = match[3];
      const nextVal = parseInt(numDigits, 10) + 1;
      const formattedNum = String(nextVal).padStart(numDigits.length, '0');
      return `${prefix}${formattedNum}${suffix}`;
    }
    return '';
  }, [ultimaBoleta]);

  // Cambiar letra en el prefijo (ej: cambiar P por Y en LP11-P-20 -> LP11-Y-20)
  const changePrefixLetter = (currentPrefix: string, newLetter: string): string => {
    if (!currentPrefix || currentPrefix.trim() === '') {
      return `LP11-${newLetter}-2026-`;
    }
    const parts = currentPrefix.split('-');
    if (parts.length >= 2) {
      parts[1] = newLetter;
      return parts.join('-');
    }
    return `${currentPrefix}-${newLetter}-`;
  };

  // Obtener letra activa del prefijo (ej: P, J, S, E, Y)
  const getActiveLetter = (prefix: string): string => {
    if (!prefix) return '';
    const parts = prefix.split('-');
    if (parts.length >= 2 && parts[1].length === 1) {
      return parts[1].toUpperCase();
    }
    return '';
  };

  // Aplicar nuevo prefijo a las filas existentes en la matriz en tiempo real
  const applyPrefixToRows = (newPrefix: string, oldPrefix: string, forceAll = false) => {
    setRows(prevRows => {
      return prevRows.map(row => {
        const current = row.numeroCausa.trim();
        
        // Si está vacía o tenía el prefijo viejo exacto
        if (!current || current === oldPrefix || current === oldPrefix.trim()) {
          return { ...row, numeroCausa: newPrefix };
        }

        // Si comienza con el prefijo anterior, reemplazar el prefijo conservando el correlativo o número
        if (oldPrefix && current.startsWith(oldPrefix)) {
          const suffix = current.slice(oldPrefix.length);
          return { ...row, numeroCausa: newPrefix + suffix };
        }

        // Si la causa termina en números precedidos de guion (ej: LP11-P-20-102 o LP11-P-2026-581)
        const numberMatch = current.match(/-(\d+)$/);
        if (numberMatch && (current.startsWith('LP11-') || (oldPrefix && current.startsWith(oldPrefix.slice(0, 4))))) {
          const numberPart = numberMatch[1];
          const cleanPrefix = newPrefix.endsWith('-') ? newPrefix : `${newPrefix}-`;
          return { ...row, numeroCausa: `${cleanPrefix}${numberPart}` };
        }

        // Si se fuerza para todas las filas
        if (forceAll) {
          return { ...row, numeroCausa: newPrefix };
        }

        return row;
      });
    });
  };

  const handleLetterClick = (letter: string) => {
    const nextPrefix = changePrefixLetter(causaPrefix, letter);
    const prevPrefix = causaPrefix;
    setCausaPrefix(nextPrefix);
    localStorage.setItem('uac_ultimo_prefijo_causa', nextPrefix);
    applyPrefixToRows(nextPrefix, prevPrefix);
  };

  const handlePrefixInputChange = (value: string) => {
    const prevPrefix = causaPrefix;
    const nextPrefix = value.toUpperCase();
    setCausaPrefix(nextPrefix);
    localStorage.setItem('uac_ultimo_prefijo_causa', nextPrefix);
    applyPrefixToRows(nextPrefix, prevPrefix);
  };

  // Filas en la matriz de carga rápida
  const createEmptyRow = (customCausa?: string, customBoleta?: string): QuickRow => ({
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    numeroCausa: customCausa !== undefined ? customCausa : (causaPrefix || 'LP11-P-2026-'),
    boletaNumero: customBoleta || '',
    notificadoCitado: '',
    tipoCitado: 'IMPUTADO',
    esSoloNotificacion: false,
    fechaAudiencia: '',
    tribunal: defaultTribunal,
    articuloCOPP: '',
    alguacilPractica: defaultAlguacil || '',
    seccionRuta: defaultSeccion,
    direccionCitacion: '',
  });

  const [rows, setRows] = useState<QuickRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  const [savedBatchCount, setSavedBatchCount] = useState<number | null>(null);

  // Inicializar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSessionAddedCount(0);
      setSavedBatchCount(null);

      if (boletasExistentes && boletasExistentes.length > 0) {
        // Si hay una última boleta, podemos heredar valores y sugerir boleta correlativa
        const last = boletasExistentes[boletasExistentes.length - 1];
        let nextNum1 = '';
        if (last && last.boletaNumero) {
          const m = last.boletaNumero.match(/^(\D*)(\d+)(\D*)$/);
          if (m) {
            nextNum1 = `${m[1]}${String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0')}${m[3]}`;
          }
        }
        const nextNum2 = nextNum1 ? calcularSiguienteBoletaNum(nextNum1) : '';
        const nextNum3 = nextNum2 ? calcularSiguienteBoletaNum(nextNum2) : '';

        setRows([
          createEmptyRow(undefined, nextNum1),
          createEmptyRow(undefined, nextNum2),
          createEmptyRow(undefined, nextNum3),
        ]);
      } else {
        setRows([
          createEmptyRow(),
          createEmptyRow(),
          createEmptyRow(),
        ]);
      }
    }
  }, [isOpen]);

  // Item correlativo actual (continúa de forma fluida y clara)
  const itemBase = useMemo(() => {
    const maxItemExistente = boletasExistentes && boletasExistentes.length > 0
      ? Math.max(...boletasExistentes.map(b => b.numeroItem || 0))
      : 0;
    return Math.max(maxItemExistente + 1, proximoNumeroItem) + sessionAddedCount;
  }, [sessionAddedCount, boletasExistentes, proximoNumeroItem]);

  const totalBoletasEnLote = boletasExistentes.length + sessionAddedCount;

  // Parsear texto de Excel en tiempo real
  useEffect(() => {
    if (!excelRawText.trim()) {
      setExcelParsedRows([]);
      return;
    }
    const parsed = parseExcelClipboardText(excelRawText, {
      defaultCausaPrefix: causaPrefix,
      defaultTribunal,
      defaultAlguacil,
      defaultSeccion,
      tribunales,
      alguaciles,
    });
    setExcelParsedRows(parsed);
  }, [excelRawText, causaPrefix, defaultTribunal, defaultAlguacil, defaultSeccion, tribunales, alguaciles]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setExcelRawText(text);
      } else {
        alert('El portapapeles está vacío. Por favor copia primero las celdas en tu hoja de Excel (Ctrl+C).');
      }
    } catch {
      alert('Por favor haz clic dentro del cuadro de texto y pulsa Ctrl+V (o Cmd+V) para pegar los datos copiados de Excel.');
    }
  };

  const handleApplyExcelRows = () => {
    if (excelParsedRows.length === 0) return;

    const newRows: QuickRow[] = excelParsedRows.map(p => ({
      id: `row-xl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      numeroCausa: p.numeroCausa,
      boletaNumero: p.boletaNumero,
      notificadoCitado: p.notificadoCitado,
      tipoCitado: p.tipoCitado,
      esSoloNotificacion: p.esSoloNotificacion,
      fechaAudiencia: p.fechaAudiencia,
      tribunal: p.tribunal,
      articuloCOPP: p.articuloCOPP,
      alguacilPractica: p.alguacilPractica,
      seccionRuta: p.seccionRuta || defaultSeccion,
      direccionCitacion: p.direccionCitacion || '',
    }));

    if (excelImportMode === 'REPLACE_EMPTY') {
      const hasFilledRows = rows.some(r => 
        (r.numeroCausa && r.numeroCausa.length > (causaPrefix?.length || 0)) || 
        r.boletaNumero.trim() || 
        r.notificadoCitado.trim()
      );
      if (!hasFilledRows) {
        setRows(newRows);
      } else {
        const filled = rows.filter(r => r.boletaNumero.trim() || r.notificadoCitado.trim());
        setRows([...filled, ...newRows]);
      }
    } else {
      setRows(prev => [...prev, ...newRows]);
    }

    setPrefixFeedback(`✓ ¡${newRows.length} boletas pegadas desde Excel con éxito!`);
    setTimeout(() => setPrefixFeedback(null), 4000);
    setIsExcelModalOpen(false);
    setExcelRawText('');
  };

  const handleLoadExcelExample = () => {
    const example = [
      `Nº DE CAUSA\tBOLETA Nº\tNOTIFICADO/CITADO\tCARÁCTER\tF. AUDIENCIA\tTRIBUNAL\tART.\tALGUACIL`,
      `LP11-P-2026-000101\t041\tJUAN CARLOS PÉREZ\tIMPUTADO\t15/09/2026\tC1\t167\tRENZO`,
      `LP11-P-2026-000102\t042\tMARÍA EUGENIA BLANCO\tVÍCTIMA\tNOTIFICACIÓN\tC1\t168\tWUILMAR`,
      `LP11-J-2026-000085\t043\tDR. CARLOS MENDEZ (DEFENSA)\tDEFENSOR\t20/09/2026\tJ1\t169\tROXANA`,
      `LP11-P-2026-000104\t044\tOFICIAL PEDRO CONTRERAS\tTESTIGO\tNOTIFICACIÓN\tC2\t165\tELISET`
    ].join('\n');
    setExcelRawText(example);
  };

  const handleTablePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    // Si contiene saltos de línea o tabuladores típicos de copiar filas/celdas de Excel
    if (text.includes('\n') || text.includes('\t')) {
      e.preventDefault();
      setExcelRawText(text);
      setIsExcelModalOpen(true);
    }
  };

  const handleCopiarDatosUltimaBoleta = () => {
    if (!ultimaBoleta) return;
    if (ultimaBoleta.tribunal) {
      setDefaultTribunal(ultimaBoleta.tribunal);
      setRows(prev => prev.map(r => ({ ...r, tribunal: ultimaBoleta.tribunal })));
    }
    if (ultimaBoleta.alguacilPractica) {
      setDefaultAlguacil(ultimaBoleta.alguacilPractica);
      setRows(prev => prev.map(r => ({ ...r, alguacilPractica: ultimaBoleta.alguacilPractica })));
    }
    if (ultimaBoleta.seccionRuta) {
      setDefaultSeccion(ultimaBoleta.seccionRuta);
      setRows(prev => prev.map(r => ({ ...r, seccionRuta: ultimaBoleta.seccionRuta })));
    }
    
    if (ultimaBoleta.numeroCausa) {
      const parts = ultimaBoleta.numeroCausa.split('-');
      if (parts.length >= 3) {
        const pref = `${parts[0]}-${parts[1]}-${parts[2]}-`;
        setCausaPrefix(pref);
        localStorage.setItem('uac_ultimo_prefijo_causa', pref);
      }
    }

    setPrefixFeedback(`Valores heredados del lote: Trib. ${ultimaBoleta.tribunal}, ${ultimaBoleta.alguacilPractica || 'Sin alguacil'}`);
    setTimeout(() => setPrefixFeedback(null), 3500);
  };

  const handleUpdateRow = (id: string, field: keyof QuickRow, value: any) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleAddRow = () => {
    const lastRow = rows[rows.length - 1];
    let nextBoletaNum = '';
    if (lastRow && lastRow.boletaNumero) {
      nextBoletaNum = calcularSiguienteBoletaNum(lastRow.boletaNumero);
    } else if (ultimaBoleta) {
      nextBoletaNum = calcularSiguienteBoletaNum();
    }
    setRows(prev => [...prev, createEmptyRow(undefined, nextBoletaNum)]);
  };

  const handleAddMultipleRows = (count: number) => {
    const newRows: QuickRow[] = [];
    let currentLastNum = rows[rows.length - 1]?.boletaNumero || '';

    for (let i = 0; i < count; i++) {
      if (currentLastNum) {
        currentLastNum = calcularSiguienteBoletaNum(currentLastNum);
      }
      newRows.push(createEmptyRow(undefined, currentLastNum));
    }
    setRows(prev => [...prev, ...newRows]);
  };

  const handleResetRows = () => {
    if (confirm('¿Deseas vaciar la tabla actual para empezar a llenar una nueva lista desde cero?')) {
      setRows([
        createEmptyRow(),
        createEmptyRow(),
        createEmptyRow(),
      ]);
      setSavedBatchCount(null);
    }
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = (e: React.FormEvent, keepAddingInBatch = false) => {
    e.preventDefault();

    const validRows = rows.filter(r => 
      r.numeroCausa.trim().length > 3 && 
      r.boletaNumero.trim().length > 0 &&
      r.notificadoCitado.trim().length > 0
    );

    if (validRows.length === 0) {
      alert('Por favor completa al menos una boleta con Nº de Causa, Boleta Nº y Notificado.');
      return;
    }

    const currentBaseItem = itemBase;
    const isReplacing = false;

    const batchBoletas: Partial<BoletaJudicial>[] = validRows.map((r, idx) => ({
      numeroItem: currentBaseItem + idx,
      numeroCausa: r.numeroCausa.trim().toUpperCase(),
      boletaNumero: r.boletaNumero.trim(),
      notificadoCitado: r.notificadoCitado.trim().toUpperCase(),
      tipoCitado: r.tipoCitado,
      esSoloNotificacion: r.esSoloNotificacion,
      fechaAudiencia: r.esSoloNotificacion ? 'NOTIFICACION' : (r.fechaAudiencia || 'NOTIFICACION'),
      fechaAsignacion: defaultFechaAsig,
      tribunal: r.tribunal,
      articuloCOPP: r.articuloCOPP || '',
      alguacilPractica: r.alguacilPractica,
      seccionRuta: r.seccionRuta || defaultSeccion,
      devueltaAlTribunal: false,
      acuseGenerado: false,
      direccionCitacion: r.direccionCitacion.trim() || undefined,
      mesRuta: mesRutaActual,
      estado: 'EN_RUTA',
    }));

    onSaveBatch(batchBoletas, isReplacing);

    if (keepAddingInBatch) {
      // Guardar y continuar agregando al lote sin cerrar
      const nextAddedCount = sessionAddedCount + validRows.length;
      setSessionAddedCount(nextAddedCount);
      setSavedBatchCount(validRows.length);

      // Calcular número correlativo para las nuevas filas
      const lastRow = validRows[validRows.length - 1];
      const nextNum1 = calcularSiguienteBoletaNum(lastRow.boletaNumero);
      const nextNum2 = nextNum1 ? calcularSiguienteBoletaNum(nextNum1) : '';
      const nextNum3 = nextNum2 ? calcularSiguienteBoletaNum(nextNum2) : '';

      setRows([
        createEmptyRow(undefined, nextNum1),
        createEmptyRow(undefined, nextNum2),
        createEmptyRow(undefined, nextNum3),
      ]);

      setTimeout(() => {
        setSavedBatchCount(null);
      }, 5000);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Encabezado */}
        <div className="p-4 bg-[#1e293b] text-white flex items-center justify-between border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white font-bold shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Carga Rápida en Lote de Boletas Judiciales
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30">
                  Modo Ráfaga / Enrutamiento
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Registra el lote rápidamente con: Nº DE CAUSA, BOLETA Nº, NOTIFICADO/CITADO, CARÁCTER, F. AUDIENCIA/TIPO, TRI, ART. y ALGUACIL.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Lote Guardado y Nueva Lista Lista */}
        {savedBatchCount !== null && (
          <div className="p-3 bg-emerald-600 text-white flex items-center justify-between px-4 text-xs font-bold animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>✓ ¡Lote de {savedBatchCount} boletas guardado exitosamente! El próximo ítem asignado es #{itemBase}. Continúa llenando las siguientes filas.</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSavedBatchCount(null)}
              className="text-white/80 hover:text-white px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra Superior: Correlativo de Ítem y Carga Rápida */}
        <div className="bg-slate-100/95 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl shadow-xs">
              <span className="text-slate-600 font-semibold">Correlativo inicial:</span>
              <strong className="text-indigo-700 font-mono font-black text-sm">Ítem #{itemBase}</strong>
              {boletasExistentes.length > 0 && (
                <span className="text-[10px] text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded-md font-bold">
                  {boletasExistentes.length} registradas previamente
                </span>
              )}
            </div>

            {ultimaBoleta && (
              <button
                type="button"
                onClick={handleCopiarDatosUltimaBoleta}
                className="text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                title="Copiar Tribunal, Alguacil y prefijo de la última boleta registrada"
              >
                <span>↻ Heredar datos de última boleta</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Destacado: Pegar desde Excel */}
            <button
              type="button"
              onClick={() => setIsExcelModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              title="Copia las celdas en Excel (Ctrl+C) y pégalas aquí para cargar todo el lote al instante"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📋 Pegar desde Excel</span>
            </button>
          </div>
        </div>

        {/* 2. Barra de Configuración Rápida y Sección de Ruta */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sección de Destino */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-slate-700">Sección:</span>
              <select
                value={defaultSeccion}
                onChange={(e) => {
                  const s = e.target.value as SeccionRuta;
                  setDefaultSeccion(s);
                  setRows(prev => prev.map(r => ({ ...r, seccionRuta: s })));
                }}
                className="font-bold text-indigo-950 bg-transparent focus:outline-none cursor-pointer text-xs"
              >
                <option value="RUTA_NOTIFICACION_CITACION">RUTA DE NOTIFICACIÓN Y CITACIÓN</option>
                <option value="CORREO_EXT">CORREO EXT.</option>
                <option value="RUTA_INTERNA">RUTA INTERNA</option>
                <option value="OTROS_ESTADOS_MERIDA">BOLETAS DE OTROS ESTADOS Y MÉRIDA</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-600">F. Asignación:</span>
              <input
                type="date"
                value={defaultFechaAsig}
                onChange={(e) => setDefaultFechaAsig(e.target.value)}
                className="font-semibold text-slate-800 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Prefijo de Causa Modificable al Instante */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs">
              <span className="text-slate-600 font-bold text-xs">Prefijo Causa:</span>
              <input
                type="text"
                value={causaPrefix}
                onChange={(e) => handlePrefixInputChange(e.target.value)}
                placeholder="ej: LP11-P-2026- o LP11-P-20"
                className="w-36 px-2 py-1 font-mono font-bold text-indigo-950 bg-indigo-50 border border-indigo-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                title="Prefijo editable al instante. Modifica LP11, el año (2026, 2025, 2020) o la letra en cualquier momento."
              />
            </div>

            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold mr-0.5">Letra:</span>
              {[
                { letter: 'P', desc: 'P - Control (1ra Instancia)' },
                { letter: 'J', desc: 'J - Juicio (1ra Instancia)' },
                { letter: 'S', desc: 'S - Sentencia / Apelaciones' },
                { letter: 'E', desc: 'E - Ejecución' },
                { letter: 'Y', desc: 'Y - Adolescentes / Secc. Especial' }
              ].map(({ letter, desc }) => {
                const isSelected = getActiveLetter(causaPrefix) === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleLetterClick(letter)}
                    className={`w-7 h-7 rounded text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 font-black scale-105'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                    title={desc}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                applyPrefixToRows(causaPrefix, causaPrefix, true);
                setPrefixFeedback(`Prefijo "${causaPrefix}" aplicado a ${rows.length} filas`);
                setTimeout(() => setPrefixFeedback(null), 3500);
              }}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="Aplica este prefijo a todas las filas en la tabla actual"
            >
              <span>Aplicar a filas</span>
            </button>

            {prefixFeedback && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200 animate-in fade-in">
                ✓ {prefixFeedback}
              </span>
            )}
          </div>
        </div>

        {/* Matriz de Filas Editables */}
        <form onSubmit={handleSave} onPaste={handleTablePaste} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-2 text-center w-8">#</th>
                  <th className="py-2.5 px-2 min-w-[150px]">Nº DE CAUSA *</th>
                  <th className="py-2.5 px-2 min-w-[90px]">BOLETA Nº *</th>
                  <th className="py-2.5 px-2 min-w-[200px]">NOTIFICADO / CITADO *</th>
                  <th className="py-2.5 px-2 min-w-[110px]">CARÁCTER</th>
                  <th className="py-2.5 px-2 min-w-[125px]">F. AUDIENCIA / TIPO</th>
                  <th className="py-2.5 px-2 w-16 text-center">TRI</th>
                  {/* 7 Columnas COPP idénticas a la imagen */}
                  <th className="py-2 px-1 text-center bg-[#8f9ca8] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 167">167</th>
                  <th className="py-2 px-1 text-center bg-[#5c98e2] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 168">168</th>
                  <th className="py-2 px-1 text-center bg-[#8ea8be] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 169">169</th>
                  <th className="py-2 px-1 text-center bg-[#9dce64] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 170">170</th>
                  <th className="py-2 px-1 text-center bg-[#e7444b] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 171">171</th>
                  <th className="py-2 px-1 text-center bg-[#fce444] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 165">165</th>
                  <th className="py-1 px-1 text-center bg-[#df7a40] text-slate-950 w-9 font-black select-none text-[10px] leading-tight" title="Art. S 165">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[8px] font-black leading-none">S</span>
                      <span className="text-[10px] font-black leading-none mt-0.5">165</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-2 min-w-[115px]">ALGUACIL</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* # */}
                    <td className="py-2 px-2 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>

                    {/* Nº DE CAUSA * */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        required
                        placeholder="Ej: LP11-P-2026-102 o LP11-P-20"
                        value={row.numeroCausa}
                        onChange={(e) => handleUpdateRow(row.id, 'numeroCausa', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                      />
                    </td>

                    {/* BOLETA Nº * */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        required
                        placeholder="Ej: 4501"
                        value={row.boletaNumero}
                        onChange={(e) => handleUpdateRow(row.id, 'boletaNumero', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                      />
                    </td>

                    {/* NOTIFICADO / CITADO * */}
                    <td className="py-2 px-2">
                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          placeholder="Ej: FISCALIA XVII, ABG. MARIO ROA"
                          value={row.notificadoCitado}
                          onChange={(e) => handleUpdateRow(row.id, 'notificadoCitado', e.target.value.toUpperCase())}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Dirección opcional..."
                          value={row.direccionCitacion}
                          onChange={(e) => handleUpdateRow(row.id, 'direccionCitacion', e.target.value)}
                          className="w-full px-2 py-0.5 border border-slate-200 rounded text-[10px] text-slate-600 bg-slate-50 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* CARÁCTER */}
                    <td className="py-2 px-2">
                      <select
                        value={row.tipoCitado}
                        onChange={(e) => handleUpdateRow(row.id, 'tipoCitado', e.target.value as TipoCitado)}
                        className="w-full px-1.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white text-xs font-medium"
                      >
                        {TIPOS_CITADO_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* F. AUDIENCIA / TIPO */}
                    <td className="py-2 px-2">
                      <div className="space-y-1">
                        {!row.esSoloNotificacion ? (
                          <input
                            type="date"
                            value={row.fechaAudiencia}
                            onChange={(e) => handleUpdateRow(row.id, 'fechaAudiencia', e.target.value)}
                            className="w-full px-1.5 py-1 border border-slate-300 rounded text-slate-800 bg-white text-xs font-semibold"
                          />
                        ) : (
                          <div className="py-1 px-1.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded text-center">
                            Mera Notif.
                          </div>
                        )}
                        <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={row.esSoloNotificacion}
                            onChange={(e) => handleUpdateRow(row.id, 'esSoloNotificacion', e.target.checked)}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                          <span>Sin audiencia</span>
                        </label>
                      </div>
                    </td>

                    {/* TRI */}
                    <td className="py-2 px-2 text-center">
                      <select
                        value={row.tribunal}
                        onChange={(e) => handleUpdateRow(row.id, 'tribunal', e.target.value)}
                        className="w-full px-1.5 py-1.5 border border-slate-300 rounded font-bold text-slate-900 bg-white text-xs text-center"
                      >
                        {tribunales.map(t => (
                          <option key={t.id} value={t.codigo}>{t.codigo}</option>
                        ))}
                      </select>
                    </td>

                    {/* 167 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '167' ? '' : '167')}
                      className={`py-2 px-1 text-center border-l border-r border-slate-200 cursor-pointer hover:bg-slate-200 select-none ${
                        row.articuloCOPP === '167' ? 'bg-slate-100' : ''
                      }`}
                      title="Art. 167"
                    >
                      {row.articuloCOPP === '167' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8f9ca8] text-slate-950 font-black text-xs shadow-xs border border-slate-500">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 168 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '168' ? '' : '168')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-blue-100 select-none ${
                        row.articuloCOPP === '168' ? 'bg-blue-50' : ''
                      }`}
                      title="Art. 168"
                    >
                      {row.articuloCOPP === '168' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#5c98e2] text-slate-950 font-black text-xs shadow-xs border border-blue-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 169 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '169' ? '' : '169')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-sky-100 select-none ${
                        row.articuloCOPP === '169' ? 'bg-sky-50' : ''
                      }`}
                      title="Art. 169"
                    >
                      {row.articuloCOPP === '169' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8ea8be] text-slate-950 font-black text-xs shadow-xs border border-sky-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 170 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '170' ? '' : '170')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-lime-100 select-none ${
                        row.articuloCOPP === '170' ? 'bg-lime-50' : ''
                      }`}
                      title="Art. 170"
                    >
                      {row.articuloCOPP === '170' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#9dce64] text-slate-950 font-black text-xs shadow-xs border border-lime-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 171 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '171' ? '' : '171')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-red-100 select-none ${
                        row.articuloCOPP === '171' ? 'bg-red-50' : ''
                      }`}
                      title="Art. 171"
                    >
                      {row.articuloCOPP === '171' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#e7444b] text-slate-950 font-black text-xs shadow-xs border border-red-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 165 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '165' ? '' : '165')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-yellow-100 select-none ${
                        row.articuloCOPP === '165' ? 'bg-yellow-50' : ''
                      }`}
                      title="Art. 165"
                    >
                      {row.articuloCOPP === '165' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#fce444] text-slate-950 font-black text-xs shadow-xs border border-yellow-500">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* S 165 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === 'S_165' ? '' : 'S_165')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-orange-100 select-none ${
                        row.articuloCOPP === 'S_165' ? 'bg-orange-50' : ''
                      }`}
                      title="Art. S 165"
                    >
                      {row.articuloCOPP === 'S_165' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#df7a40] text-slate-950 font-black text-xs shadow-xs border border-orange-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* ALGUACIL */}
                    <td className="py-2 px-2">
                      <select
                        value={row.alguacilPractica}
                        onChange={(e) => handleUpdateRow(row.id, 'alguacilPractica', e.target.value)}
                        className="w-full px-1.5 py-1.5 border border-slate-300 rounded font-medium text-slate-800 bg-white text-xs"
                      >
                        <option value="">-- Sin Alguacil --</option>
                        {alguaciles.map(a => (
                          <option key={a.id} value={a.nombre}>{a.nombre}</option>
                        ))}
                      </select>
                    </td>

                    {/* Eliminar fila */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Eliminar fila"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botones para agregar filas */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+1 Fila</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddMultipleRows(3)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>+3 Filas</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddMultipleRows(5)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>+5 Filas</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-xs transition-colors cursor-pointer ml-2"
                title="Abrir ventana para pegar datos directamente desde Excel (Ctrl+V)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pegar desde Excel</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {rows.filter(r => r.numeroCausa.trim().length > 3 && r.boletaNumero.trim().length > 0 && r.notificadoCitado.trim().length > 0).length} de {rows.length} boletas listas para registrar
            </div>
          </div>

          {/* Barra de Acciones Finales */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetRows}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Vaciar las filas para empezar a llenar una nueva lista en blanco"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Limpiar Matriz</span>
              </button>
              <span className="text-[11px] text-slate-400 hidden lg:inline">
                💡 Puedes guardar este lote y seguir agregando al mismo sin salir del modal.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {/* Guardar y Continuar Agregando en el Lote */}
              <button
                type="button"
                onClick={(e) => handleSave(e, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-sm transition-all cursor-pointer"
                title="Guarda las boletas registradas y deja la tabla limpia lista para seguir agregando sin cerrar la ventana"
              >
                <Layers className="w-4 h-4" />
                <span>Guardar y Seguir Agregando ⚡</span>
              </button>

              {/* Guardar y Cerrar */}
              <button
                type="button"
                onClick={(e) => handleSave(e, false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Finalizar</span>
              </button>
            </div>
          </div>
        </form>

        {/* Modal Flotante: Pegar desde Excel / Portapapeles */}
        {isExcelModalOpen && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header del modal Excel */}
              <div className="p-4 bg-emerald-700 text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-800 rounded-xl shadow-xs">
                    <FileSpreadsheet className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base">Pegar Boletas desde Excel al Sistema</h4>
                    <p className="text-xs text-emerald-100">
                      Copia tus celdas en Excel (Ctrl+C) y pégalas aquí (Ctrl+V) para cargarlas automáticamente
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-emerald-800 text-emerald-100 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido principal */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
                {/* Guía visual de columnas recomendadas */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>📋 Orden reconocido de columnas al copiar celdas en Excel:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadExcelExample}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                    >
                      Cargar ejemplo de prueba
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-center font-mono text-[11px]">
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 1</span>
                      <strong className="text-slate-800">Nº Causa</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 2</span>
                      <strong className="text-slate-800">Boleta Nº</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 3</span>
                      <strong className="text-slate-800">Notificado</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 4 (opc)</span>
                      <span className="text-slate-600 font-semibold">Carácter</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 5 (opc)</span>
                      <span className="text-slate-600 font-semibold">Audiencia</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 6 (opc)</span>
                      <span className="text-slate-600 font-semibold">Tribunal</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 7 (opc)</span>
                      <span className="text-slate-600 font-semibold">Art. COPP</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 8 (opc)</span>
                      <span className="text-slate-600 font-semibold">Alguacil</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-2">
                    💡 <strong>Flexibilidad Total:</strong> Si solo copias Causa, Boleta y Notificado, el sistema automáticamente asignará el Tribunal y Alguacil predeterminados, y la boleta se clasificará como "NOTIFICACIÓN".
                  </p>
                </div>

                {/* Área de pegado */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span>Pega aquí tus filas de Excel:</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Leer directamente del portapapeles del navegador"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>Pegar del Portapapeles</span>
                      </button>
                      {excelRawText && (
                        <button
                          type="button"
                          onClick={() => setExcelRawText('')}
                          className="text-slate-400 hover:text-rose-600 text-[11px] cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    autoFocus
                    rows={5}
                    value={excelRawText}
                    onChange={(e) => setExcelRawText(e.target.value)}
                    placeholder="Haz clic aquí y pulsa Ctrl+V para pegar las celdas copiadas de Excel..."
                    className="w-full p-3 font-mono text-xs border-2 border-slate-300 focus:border-emerald-500 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:outline-none bg-slate-50 placeholder:text-slate-400"
                  />
                </div>

                {/* Vista Previa de Filas Parseadas */}
                {excelParsedRows.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                          ✓ {excelParsedRows.length} boletas detectadas
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          ({excelParsedRows.filter(r => r.isValid).length} listas sin observaciones)
                        </span>
                      </div>

                      {/* Modo de inserción */}
                      <div className="flex items-center gap-3 text-xs bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-600">Al insertar:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="excelImportMode"
                            value="REPLACE_EMPTY"
                            checked={excelImportMode === 'REPLACE_EMPTY'}
                            onChange={() => setExcelImportMode('REPLACE_EMPTY')}
                            className="text-emerald-600"
                          />
                          <span>Reemplazar filas vacías</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="excelImportMode"
                            value="APPEND"
                            checked={excelImportMode === 'APPEND'}
                            onChange={() => setExcelImportMode('APPEND')}
                            className="text-emerald-600"
                          />
                          <span>Anexar al final</span>
                        </label>
                      </div>
                    </div>

                    {/* Tabla de previsualización */}
                    <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl shadow-xs">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-1.5 text-center w-8">#</th>
                            <th className="p-1.5">Nº Causa</th>
                            <th className="p-1.5 w-16">Boleta</th>
                            <th className="p-1.5">Notificado / Citado</th>
                            <th className="p-1.5 w-20">Carácter</th>
                            <th className="p-1.5 w-24">Audiencia</th>
                            <th className="p-1.5 w-12 text-center">Tri</th>
                            <th className="p-1.5 w-14 text-center">Art.</th>
                            <th className="p-1.5">Alguacil</th>
                            <th className="p-1.5 w-16 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {excelParsedRows.map((r, i) => (
                            <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/60'}>
                              <td className="p-1.5 text-center font-bold text-slate-400">{i + 1}</td>
                              <td className="p-1.5 font-mono font-bold text-slate-900">{r.numeroCausa}</td>
                              <td className="p-1.5 font-bold text-indigo-700">{r.boletaNumero}</td>
                              <td className="p-1.5 font-semibold text-slate-800">{r.notificadoCitado}</td>
                              <td className="p-1.5 text-slate-600">{r.tipoCitado}</td>
                              <td className="p-1.5">
                                {r.esSoloNotificacion ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                    NOTIFICACIÓN
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-700">{r.fechaAudiencia}</span>
                                )}
                              </td>
                              <td className="p-1.5 text-center font-bold">{r.tribunal}</td>
                              <td className="p-1.5 text-center font-mono font-bold">{r.articuloCOPP || '-'}</td>
                              <td className="p-1.5 text-slate-600">{r.alguacilPractica || '-'}</td>
                              <td className="p-1.5 text-center">
                                {r.isValid ? (
                                  <span className="text-emerald-600 font-bold text-[10px]">✓ Lista</span>
                                ) : (
                                  <span className="text-rose-600 font-bold text-[10px]" title={r.validationNote}>Incompleta</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer del modal Excel */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="px-4 py-2 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={excelParsedRows.length === 0}
                  onClick={handleApplyExcelRows}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                    excelParsedRows.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02]'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Insertar {excelParsedRows.length} Boletas en la Matriz</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
