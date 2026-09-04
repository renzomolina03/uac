import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Check, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  Eye, 
  ArrowUpDown, 
  Scale, 
  Printer, 
  FolderOpen, 
  MapPin, 
  Mail, 
  Building2, 
  Globe2, 
  Plus, 
  Zap, 
  Users,
  CheckCircle,
  RotateCcw,
  Copy,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ArticuloCOPP, 
  SeccionRuta, 
  SECCIONES_INFO, 
  ConfiguracionDespacho,
  hasArticulo,
  toggleArticuloBoleta,
  getCaracterDisplay
} from '../types/judicial';
import { formatFechaDisplay, evaluarAlertaBoleta } from '../utils/alerts';
import { exportarBoletasPDF, exportarReporteTribunalResultadosPDF } from '../utils/exportPDF';
import { copiarBoletasParaExcel } from '../utils/exportExcel';
import { calcularHojasLote, mapearBoletasAHojas } from '../utils/sheetCalculation';
import { ImprimirHojasModal } from './ImprimirHojasModal';

interface BoletaTableProps {
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  alguaciles: Alguacil[];
  config: ConfiguracionDespacho;
  filtroAlertaActivo: string;
  onEditBoleta: (boleta: BoletaJudicial) => void;
  onDeleteBoleta: (id: string) => void;
  onViewBoleta: (boleta: BoletaJudicial) => void;
  onToggleDevuelta: (id: string, devuelta: boolean) => void;
  onQuickAcuse: (boleta: BoletaJudicial) => void;
  onNavigateToAcuses?: (tribunalCode: string, boletaIds?: string[]) => void;
  onBulkDevuelta?: (boletaIds: string[]) => void;
  onBulkPracticada?: (boletaIds: string[]) => void;
  onBulkDelete?: (boletaIds: string[]) => void;
  onUpdateArticulo?: (boletaId: string, articulo: ArticuloCOPP, articulos?: ArticuloCOPP[]) => void;
  onBulkAssignArticulo?: (boletaIds: string[], articulo: ArticuloCOPP) => void;
  onUpdateAlguacil?: (boletaId: string, alguacil: string) => void;
  onBulkAssignAlguacil?: (boletaIds: string[], alguacil: string) => void;
  onUpdateSeccion?: (boletaId: string, seccion: SeccionRuta) => void;
  onBulkAssignSeccion?: (boletaIds: string[], seccion: SeccionRuta) => void;
  onOpenNewBoleta?: () => void;
  onOpenBatchModal?: () => void;
  onOpenExportModal?: () => void;
  onOpenNuevaListaModal?: () => void;
  onQuickAddBoleta?: (boleta: Partial<BoletaJudicial>) => void;
}

export const BoletaTable: React.FC<BoletaTableProps> = ({
  boletas,
  tribunales,
  alguaciles,
  config,
  filtroAlertaActivo,
  onEditBoleta,
  onDeleteBoleta,
  onViewBoleta,
  onToggleDevuelta,
  onBulkDevuelta,
  onBulkDelete,
  onUpdateArticulo,
  onBulkAssignArticulo,
  onUpdateAlguacil,
  onBulkAssignAlguacil,
  onUpdateSeccion,
  onBulkAssignSeccion,
  onOpenNewBoleta,
  onOpenBatchModal,
  onOpenExportModal,
  onOpenNuevaListaModal,
  onQuickAddBoleta,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeccion, setSelectedSeccion] = useState<string>('TODAS');
  const [selectedTribunal, setSelectedTribunal] = useState('TODOS');
  const [selectedAlguacil, setSelectedAlguacil] = useState('TODOS');
  const [selectedBoletaIds, setSelectedBoletaIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'item' | 'causa' | 'audiencia'>('item');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isImprimirHojasOpen, setIsImprimirHojasOpen] = useState(false);
  const [selectedHojaFilter, setSelectedHojaFilter] = useState<number | null>(null);

  // Mini formulario de carga directa (Barra Rápida Superior)
  const [quickCausa, setQuickCausa] = useState('');
  const [quickBoleta, setQuickBoleta] = useState('');
  const [quickNombre, setQuickNombre] = useState('');
  const [quickTribunal, setQuickTribunal] = useState(tribunales[0]?.codigo || 'C1');
  const [quickAudiencia, setQuickAudiencia] = useState('');
  const [quickAlguacil, setQuickAlguacil] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Conteos por sección
  const conteoSecciones = useMemo(() => {
    const counts: Record<string, number> = {
      TODAS: boletas.length,
      RUTA_NOTIFICACION_CITACION: 0,
      CORREO_EXT: 0,
      RUTA_INTERNA: 0,
      OTROS_ESTADOS_MERIDA: 0,
    };
    boletas.forEach(b => {
      const sec = b.seccionRuta || 'RUTA_NOTIFICACION_CITACION';
      if (counts[sec] !== undefined) counts[sec]++;
      else counts['RUTA_NOTIFICACION_CITACION']++;
    });
    return counts;
  }, [boletas]);

  // Lista de alguaciles únicos
  const alguacilesList = useMemo(() => {
    return Array.from(new Set(boletas.map(b => b.alguacilPractica))).filter(Boolean).sort();
  }, [boletas]);

  // Filtrado de boletas
  const boletasFiltradas = useMemo(() => {
    return boletas.filter((b) => {
      const sec = b.seccionRuta || 'RUTA_NOTIFICACION_CITACION';
      const matchSeccion = selectedSeccion === 'TODAS' || sec === selectedSeccion;

      const matchSearch =
        searchTerm === '' ||
        b.numeroCausa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.boletaNumero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.notificadoCitado.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.alguacilPractica.toLowerCase().includes(searchTerm.toLowerCase());

      const matchTribunal =
        selectedTribunal === 'TODOS' || b.tribunal.toUpperCase() === selectedTribunal.toUpperCase();

      const matchAlguacil =
        selectedAlguacil === 'TODOS' || b.alguacilPractica === selectedAlguacil;

      let matchAlerta = true;
      if (filtroAlertaActivo && filtroAlertaActivo !== 'TODAS') {
        const alerta = evaluarAlertaBoleta(b);
        if (filtroAlertaActivo === 'CRITICA') matchAlerta = alerta.nivel === 'CRITICA';
        else if (filtroAlertaActivo === 'URGENTE') matchAlerta = alerta.nivel === 'URGENTE';
        else if (filtroAlertaActivo === 'DEVUELTA') matchAlerta = b.devueltaAlTribunal;
      }

      return matchSeccion && matchSearch && matchTribunal && matchAlguacil && matchAlerta;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortField === 'item') cmp = a.numeroItem - b.numeroItem;
      else if (sortField === 'causa') cmp = a.numeroCausa.localeCompare(b.numeroCausa);
      else if (sortField === 'audiencia') cmp = (a.fechaAudiencia || '').localeCompare(b.fechaAudiencia || '');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [boletas, searchTerm, selectedSeccion, selectedTribunal, selectedAlguacil, filtroAlertaActivo, sortField, sortDirection]);

  // Cálculo de hojas del lote (20 boletas por hoja física)
  const hojasCalculadas = useMemo(() => {
    return calcularHojasLote(boletasFiltradas, 20, 'uac1233');
  }, [boletasFiltradas]);

  const mapaBoletasHojas = useMemo(() => {
    return mapearBoletasAHojas(boletasFiltradas, 20, 'uac1233');
  }, [boletasFiltradas]);

  // Boletas a mostrar en la tabla (aplica filtro por hoja si el usuario hizo clic en una hoja específica)
  const boletasAMostrarEnTabla = useMemo(() => {
    if (selectedHojaFilter === null) return boletasFiltradas;
    const hojaObj = hojasCalculadas.find(h => h.numeroHoja === selectedHojaFilter);
    return hojaObj ? hojaObj.boletas : boletasFiltradas;
  }, [boletasFiltradas, selectedHojaFilter, hojasCalculadas]);

  const handlePrintListado = () => {
    if (boletasFiltradas.length === 0) {
      alert('No hay boletas en la vista actual para imprimir.');
      return;
    }
    setIsImprimirHojasOpen(true);
  };

  // Manejadores de copia rápida para Excel
  const handleCopyAllForExcel = async () => {
    const ok = await copiarBoletasParaExcel(boletasFiltradas, true);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  const handleCopySelectedForExcel = async () => {
    const selectedBoletas = boletas.filter(b => selectedBoletaIds.includes(b.id));
    if (selectedBoletas.length === 0) return;
    const ok = await copiarBoletasParaExcel(selectedBoletas, true);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCausa.trim() || !quickBoleta.trim() || !quickNombre.trim()) {
      alert('Por favor completa Nº de Causa, Boleta Nº y Nombre');
      return;
    }

    if (onQuickAddBoleta) {
      onQuickAddBoleta({
        numeroCausa: quickCausa.trim().toUpperCase(),
        boletaNumero: quickBoleta.trim(),
        notificadoCitado: quickNombre.trim().toUpperCase(),
        tribunal: quickTribunal,
        fechaAudiencia: quickAudiencia || undefined,
        alguacilPractica: quickAlguacil,
        seccionRuta: (selectedSeccion !== 'TODAS' ? selectedSeccion : 'RUTA_NOTIFICACION_CITACION') as SeccionRuta,
        articuloCOPP: '',
        devueltaAlTribunal: false,
      });

      // Incrementar boleta correlativa
      if (/^\d+$/.test(quickBoleta)) {
        setQuickBoleta(String(parseInt(quickBoleta, 10) + 1));
      } else {
        setQuickBoleta('');
      }
      setQuickNombre('');
      setQuickAudiencia('');
    }
  };

  return (
    <div className="space-y-3">
      
      {/* 1. SECCIONES DE TRABAJO (Pestañas directas y amigables) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5">
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <span>Selecciona la Sección de Trabajo:</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenBatchModal && (
              <button
                id="btn-seccion-carga-rapida"
                onClick={onOpenBatchModal}
                className="text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 px-2.5 py-1 rounded-lg font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                title="Carga Rápida en Lote / Pegar desde Excel"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Carga Rápida</span>
              </button>
            )}

            <button
              id="btn-toggle-quick-add"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showQuickAdd ? 'Ocultar Agregar Rápido' : '⚡ Agregar Boleta Aquí'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          <button
            onClick={() => setSelectedSeccion('TODAS')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
              selectedSeccion === 'TODAS'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>TODAS</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-white/20 font-black">{conteoSecciones['TODAS']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('RUTA_NOTIFICACION_CITACION')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
              selectedSeccion === 'RUTA_NOTIFICACION_CITACION'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900'
            }`}
          >
            <span className="truncate">1. Notif. y Citación</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['RUTA_NOTIFICACION_CITACION']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('CORREO_EXT')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
              selectedSeccion === 'CORREO_EXT'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-900'
            }`}
          >
            <span className="truncate">2. Correo Ext.</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['CORREO_EXT']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('RUTA_INTERNA')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
              selectedSeccion === 'RUTA_INTERNA'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
            }`}
          >
            <span className="truncate">3. Ruta Interna</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['RUTA_INTERNA']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('OTROS_ESTADOS_MERIDA')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              selectedSeccion === 'OTROS_ESTADOS_MERIDA'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900'
            }`}
          >
            <span className="truncate">4. Mérida / Otros</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['OTROS_ESTADOS_MERIDA']}</span>
          </button>
        </div>
      </div>

      {/* BARRA DE AGREGAR RÁPIDO (SUPER FÁCIL) */}
      {showQuickAdd && (
        <form 
          onSubmit={handleQuickAddSubmit}
          className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Agregar boleta en 1 segundo:</span>
            </span>
            <span className="text-[11px] text-indigo-700">Llena los datos y pulsa Enter o Agregar</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <div>
              <input
                type="text"
                value={quickCausa}
                onChange={(e) => setQuickCausa(e.target.value)}
                placeholder="Nº de Causa (ej. LP11-P-2026-000123)"
                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <input
                type="text"
                value={quickBoleta}
                onChange={(e) => setQuickBoleta(e.target.value)}
                placeholder="Boleta Nº (ej. 021)"
                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <input
                type="text"
                value={quickNombre}
                onChange={(e) => setQuickNombre(e.target.value)}
                placeholder="Nombre de la persona a notificar"
                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <select
                value={quickTribunal}
                onChange={(e) => setQuickTribunal(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {tribunales.map((t, tIdx) => (
                  <option key={`quick-tri-${t.id || t.codigo || tIdx}`} value={t.codigo}>{t.codigo} ({t.nombre})</option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 2. BARRA DE BÚSQUEDA, FILTROS Y BOTÓN DE IMPRESIÓN */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Nº de Causa, Boleta, Nombre o Alguacil..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros Dropdowns y Botón Imprimir */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tribunal */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium mr-1.5">Tribunal:</span>
            <select
              value={selectedTribunal}
              onChange={(e) => setSelectedTribunal(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              {tribunales.map((t, tIdx) => (
                <option key={`filter-tri-${t.id || t.codigo || tIdx}`} value={t.codigo}>{t.codigo} - {t.nombre}</option>
              ))}
            </select>
          </div>

          {/* Alguacil */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium mr-1.5">Alguacil:</span>
            <select
              value={selectedAlguacil}
              onChange={(e) => setSelectedAlguacil(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              {alguacilesList.map((a, aIdx) => (
                <option key={`filter-alg-${a}-${aIdx}`} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Botón Copiar para Excel */}
          <button
            onClick={handleCopyAllForExcel}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Copiar las filas filtradas al portapapeles en el orden exacto para pegar (Ctrl+V) en Excel"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-600" />
            <span>{copyFeedback ? '¡Copiado para Excel! ✓' : 'Copiar para Excel'}</span>
          </button>

          {/* Botón Nueva Lista */}
          {onOpenNuevaListaModal && (
            <button
              onClick={onOpenNuevaListaModal}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-slate-700"
              title="Iniciar una nueva lista, cerrar jornada o limpiar tabla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nueva Lista</span>
            </button>
          )}

          {/* Botón Cargar Lote / Excel */}
          {onOpenBatchModal && (
            <button
              onClick={onOpenBatchModal}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Cargar lote de boletas rápidamente o pegar desde Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-950" />
              <span>Cargar Lote / Excel</span>
            </button>
          )}

          {/* Botón Imprimir Listado */}
          <button
            onClick={handlePrintListado}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Imprimir el listado actual de boletas filtradas en PDF oficial"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Listado</span>
          </button>
        </div>
      </div>

      {/* 3. BARRA DE ACCIONES MASIVAS (Si hay seleccionadas) */}
      {selectedBoletaIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-300">
              {selectedBoletaIds.length} seleccionadas
            </span>
            <button
              onClick={() => setSelectedBoletaIds([])}
              className="text-indigo-700 hover:underline font-semibold cursor-pointer"
            >
              Deseleccionar
            </button>
            <button
              onClick={handleCopySelectedForExcel}
              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              title="Copiar solo las seleccionadas para pegar en Excel"
            >
              <Copy className="w-3 h-3" />
              <span>Copiar Sel. para Excel</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Asignación rápida de Artículos COPP con 7 botones de colores idénticos a la imagen */}
            {onBulkAssignArticulo && (
              <div className="flex items-center gap-1 bg-slate-900/40 p-1 rounded-lg">
                <span className="text-[10px] text-slate-300 font-bold px-1 hidden sm:inline">Art:</span>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '167')}
                  className="px-2 py-0.5 rounded bg-[#8f9ca8] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 167 a seleccionadas"
                >
                  167
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '168')}
                  className="px-2 py-0.5 rounded bg-[#5c98e2] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 168 a seleccionadas"
                >
                  168
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '169')}
                  className="px-2 py-0.5 rounded bg-[#8ea8be] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 169 a seleccionadas"
                >
                  169
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '170')}
                  className="px-2 py-0.5 rounded bg-[#9dce64] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 170 a seleccionadas"
                >
                  170
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '171')}
                  className="px-2 py-0.5 rounded bg-[#e7444b] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 171 a seleccionadas"
                >
                  171
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '165')}
                  className="px-2 py-0.5 rounded bg-[#fce444] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 165 a seleccionadas"
                >
                  165
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, 'S_165')}
                  className="px-2 py-0.5 rounded bg-[#df7a40] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. S 165 a seleccionadas"
                >
                  S 165
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '')}
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-semibold cursor-pointer"
                  title="Limpiar artículo de seleccionadas"
                >
                  Borrar
                </button>
              </div>
            )}

            {/* Asignar Alguacil */}
            {onBulkAssignAlguacil && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkAssignAlguacil(selectedBoletaIds, e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="bg-white border border-indigo-300 font-bold text-slate-800 px-2 py-1 rounded-lg text-xs cursor-pointer focus:outline-none"
              >
                <option value="" disabled>Asignar Alguacil...</option>
                {alguaciles.map((a, aIdx) => (
                  <option key={`bulk-alg-${a.id || a.nombre || aIdx}`} value={a.nombre}>{a.nombre}</option>
                ))}
              </select>
            )}

            {/* Marcar Devueltas */}
            {onBulkDevuelta && (
              <button
                onClick={() => {
                  onBulkDevuelta(selectedBoletaIds);
                  setSelectedBoletaIds([]);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
              >
                ✓ Marcar Devueltas
              </button>
            )}

            {/* Eliminar */}
            {onBulkDelete && (
              <button
                onClick={() => {
                  if (window.confirm(`¿Eliminar las ${selectedBoletaIds.length} boletas?`)) {
                    onBulkDelete(selectedBoletaIds);
                    setSelectedBoletaIds([]);
                  }
                }}
                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-bold cursor-pointer transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3.5. CONTROL DE HOJAS / FOLIOS DEL LOTE (Cálculo automático de llenado por hoja física de 20 boletas) */}
      <div className="bg-slate-900 text-white rounded-xl shadow-xs border border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Hojas del Lote (20 por hoja):</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedHojaFilter(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedHojaFilter === null
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Todas ({boletasFiltradas.length})
          </button>

          {hojasCalculadas.map((hoja, hojaIdx) => {
            const isSelected = selectedHojaFilter === hoja.numeroHoja;
            return (
              <button
                key={`hoja-filter-btn-${hoja.numeroHoja}-${hoja.idHoja || hojaIdx}`}
                type="button"
                onClick={() => setSelectedHojaFilter(isSelected ? null : hoja.numeroHoja)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-md ring-2 ring-indigo-400 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={`Folio ${hoja.numeroHoja}: Ítems ${hoja.rangoItems.desde} al ${hoja.rangoItems.hasta} (${hoja.cantidad}/${hoja.capacidad} boletas)`}
              >
                <span className="font-mono text-indigo-400 font-black">[{hoja.idHoja}]</span>
                <span>Hoja {hoja.numeroHoja}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
                  hoja.estaLlena 
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                }`}>
                  {hoja.cantidad}/{hoja.capacidad} {hoja.estaLlena ? '✓' : '⚡'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {selectedHojaFilter !== null && (
            <button
              type="button"
              onClick={() => setSelectedHojaFilter(null)}
              className="text-indigo-300 hover:text-white text-xs underline cursor-pointer"
            >
              Ver todas las boletas
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsImprimirHojasOpen(true)}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="Seleccionar y configurar hojas para imprimir en PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Seleccionar Hojas a Imprimir</span>
          </button>
        </div>
      </div>

      {/* 4. TABLA PRINCIPAL (CON BORDES MARCADOS VISIBLES Y CLAROS) */}
      <div className="bg-white rounded-xl shadow-xs border-2 border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-400 text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-[11px]">
                <th className="py-3 px-2 text-center w-8 border border-slate-700">
                  <input
                    type="checkbox"
                    checked={boletasFiltradas.length > 0 && boletasFiltradas.every(b => selectedBoletaIds.includes(b.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBoletaIds(boletasFiltradas.map(b => b.id));
                      else setSelectedBoletaIds([]);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 text-center w-10 border border-slate-700">Nº</th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:bg-slate-800 border border-slate-700"
                  onClick={() => {
                    if (sortField === 'causa') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                    else { setSortField('causa'); setSortDirection('asc'); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Nº DE CAUSA</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-2 text-center w-20 border border-slate-700">BOLETA Nº</th>
                
                {/* NOTIFICADO Y CITADO CENTRADO */}
                <th className="py-3 px-3 min-w-[200px] text-center border border-slate-700">NOTIFICADO Y CITADO</th>
                
                {/* FECHA DE AUDIENCIA */}
                <th 
                  className="py-3 px-2 text-center min-w-[95px] cursor-pointer hover:bg-slate-800 border border-slate-700"
                  onClick={() => {
                    if (sortField === 'audiencia') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                    else { setSortField('audiencia'); setSortDirection('asc'); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>FECHA DE AUDIENCIA</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* HORA AL LADO DE FECHA DE AUDIENCIA */}
                <th className="py-3 px-2 text-center w-18 border border-slate-700">
                  HORA
                </th>

                <th className="py-3 px-2 text-center min-w-[90px] text-slate-300 border border-slate-700">
                  FECHA DE ASIGNACION
                </th>
                <th className="py-3 px-2 text-center w-12 border border-slate-700">TRI</th>

                {/* 7 Columnas COPP idénticas a la imagen con bordes marcados */}
                <th className="py-2 px-1 text-center bg-[#8f9ca8] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 167 COPP - Boleta personal directa">167</th>
                <th className="py-2 px-1 text-center bg-[#5c98e2] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 168 COPP - Víctima/Expertos">168</th>
                <th className="py-2 px-1 text-center bg-[#8ea8be] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 169 COPP - Telemática / Fax / Correo">169</th>
                <th className="py-2 px-1 text-center bg-[#9dce64] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 170 COPP - Funcionarios / Militares">170</th>
                <th className="py-2 px-1 text-center bg-[#e7444b] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 171 COPP - Cartel / Edictos">171</th>
                <th className="py-2 px-1 text-center bg-[#fce444] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 165 COPP - Notificación Ordinaria">165</th>
                <th className="py-1 px-1 text-center bg-[#df7a40] text-slate-950 w-9 font-black border border-slate-600 select-none text-[10px] leading-tight" title="Art. S 165 COPP - Notificación Especial / Sustitutiva">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black leading-none">S</span>
                    <span className="text-[10px] font-black leading-none mt-0.5">165</span>
                  </div>
                </th>

                <th className="py-3 px-3 min-w-[120px] text-center border border-slate-700">ALGUACIL</th>
                <th className="py-3 px-2 text-center min-w-[90px] border border-slate-700">DEVUELTA</th>
                <th className="py-3 px-2 text-center w-16 border border-slate-700">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {boletasAMostrarEnTabla.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-500 border border-slate-300">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <p className="font-bold text-slate-700 text-sm">No hay boletas en esta vista</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Puedes agregar una usando la barra rápida o el botón Nueva Boleta.
                      </p>
                      {onOpenBatchModal && (
                        <button
                          onClick={onOpenBatchModal}
                          className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Cargar Lote
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                boletasAMostrarEnTabla.map((b, idx) => {
                  const alerta = evaluarAlertaBoleta(b);
                  const isSelected = selectedBoletaIds.includes(b.id);
                  const is167 = hasArticulo(b, '167');
                  const is168 = hasArticulo(b, '168');
                  const is169 = hasArticulo(b, '169');
                  const is170 = hasArticulo(b, '170');
                  const is171 = hasArticulo(b, '171');
                  const is165 = hasArticulo(b, '165');
                  const isS165 = hasArticulo(b, 'S_165');

                  const handleToggle = (art: ArticuloCOPP) => {
                    const result = toggleArticuloBoleta(b, art);
                    onUpdateArticulo?.(b.id, result.articuloCOPP, result.articulosCOPP);
                  };

                  const infoHoja = mapaBoletasHojas.get(b.id);

                  return (
                    <tr 
                      key={b.id ? `boleta-row-${b.id}` : `boleta-row-${b.numeroItem}-${idx}`}
                      className={`hover:bg-indigo-50/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/80' : (alerta.nivel === 'CRITICA' ? 'bg-rose-50/40' : '')
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedBoletaIds(prev => 
                              prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
                            );
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Nº con Identificación Corta de Hoja */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-500 border border-slate-300">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-slate-700">{b.numeroItem}</span>
                          {infoHoja && (
                            <span 
                              className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold"
                              title={`Hoja ${infoHoja.numeroHoja}: ${infoHoja.idHoja} (Posición ${infoHoja.posicionEnHoja} de 20)`}
                            >
                              {infoHoja.idHoja}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nº DE CAUSA */}
                      <td className="py-2.5 px-3 font-bold text-indigo-900 font-mono border border-slate-300">
                        {b.numeroCausa}
                      </td>

                      {/* BOLETA */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 bg-slate-50/70 border border-slate-300">
                        {b.boletaNumero}
                      </td>

                      {/* PERSONA (CENTRADA SEGÚN SOLICITUD) */}
                      <td className="py-2.5 px-3 text-center border border-slate-300">
                        <div className="flex flex-col items-center justify-center text-center">
                          <span className="font-bold text-slate-900 block truncate max-w-[240px]" title={b.notificadoCitado}>
                            {b.notificadoCitado}
                          </span>
                          {b.tipoCitado && (
                            <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              {getCaracterDisplay(b.tipoCitado)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* FECHA DE AUDIENCIA */}
                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        {b.esSoloNotificacion ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                            Notificación
                          </span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-800">
                              {formatFechaDisplay(b.fechaAudiencia)}
                            </span>
                            {alerta.nivel === 'CRITICA' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                ¡Hoy / Urgente!
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* HORA DE AUDIENCIA */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 border border-slate-300">
                        {b.horaAudiencia ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                            {b.horaAudiencia}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      {/* FECHA DE ASIGNACIÓN */}
                      <td className="py-2.5 px-2 text-center text-slate-700 font-medium border border-slate-300">
                        {formatFechaDisplay(b.fechaAsignacion)}
                      </td>

                      {/* TRIBUNAL */}
                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-black text-[11px]">
                          {b.tribunal}
                        </span>
                      </td>

                      {/* 167 (Se puede marcar hasta 2 artículos COPP) */}
                      <td 
                        onClick={() => handleToggle('167')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-slate-200 select-none ${
                          is167 ? 'bg-slate-100' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. 167 (permite hasta 2)"
                      >
                        {is167 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8f9ca8] text-slate-950 font-black text-xs shadow-xs border border-slate-500">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* 168 */}
                      <td 
                        onClick={() => handleToggle('168')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-blue-100 select-none ${
                          is168 ? 'bg-blue-50' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. 168 (permite hasta 2)"
                      >
                        {is168 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#5c98e2] text-slate-950 font-black text-xs shadow-xs border border-blue-600">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* 169 */}
                      <td 
                        onClick={() => handleToggle('169')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-sky-100 select-none ${
                          is169 ? 'bg-sky-50' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. 169 (permite hasta 2)"
                      >
                        {is169 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8ea8be] text-slate-950 font-black text-xs shadow-xs border border-sky-600">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* 170 */}
                      <td 
                        onClick={() => handleToggle('170')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-lime-100 select-none ${
                          is170 ? 'bg-lime-50' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. 170 (permite hasta 2)"
                      >
                        {is170 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#9dce64] text-slate-950 font-black text-xs shadow-xs border border-lime-600">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* 171 */}
                      <td 
                        onClick={() => handleToggle('171')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-red-100 select-none ${
                          is171 ? 'bg-red-50' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. 171 (permite hasta 2)"
                      >
                        {is171 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#e7444b] text-slate-950 font-black text-xs shadow-xs border border-red-600">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* 165 */}
                      <td 
                        onClick={() => handleToggle('165')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-yellow-100 select-none ${
                          is165 ? 'bg-yellow-50' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. 165 (permite hasta 2)"
                      >
                        {is165 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#fce444] text-slate-950 font-black text-xs shadow-xs border border-yellow-500">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* S 165 */}
                      <td 
                        onClick={() => handleToggle('S_165')}
                        className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-orange-100 select-none ${
                          isS165 ? 'bg-orange-50' : ''
                        }`}
                        title="Clic para marcar/desmarcar Art. S 165 (permite hasta 2)"
                      >
                        {isS165 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#df7a40] text-slate-950 font-black text-xs shadow-xs border border-orange-600">
                            1
                          </span>
                        ) : null}
                      </td>

                      {/* ALGUACIL */}
                      <td className="py-2.5 px-3 border border-slate-300">
                        <select
                          value={b.alguacilPractica || ''}
                          onChange={(e) => onUpdateAlguacil?.(b.id, e.target.value)}
                          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold px-2 py-1 rounded-lg text-xs border border-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">(Sin Alguacil)</option>
                          {alguaciles.map((a, aIdx) => (
                            <option key={`row-alg-${b.id || idx}-${a.id || a.nombre || aIdx}`} value={a.nombre}>{a.nombre}</option>
                          ))}
                        </select>
                      </td>

                      {/* DEVUELTA (Botón Toggle 1 clic) */}
                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        <button
                          onClick={() => onToggleDevuelta(b.id, !b.devueltaAlTribunal)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            b.devueltaAlTribunal
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                          }`}
                          title={b.devueltaAlTribunal ? 'Clic para cambiar a Pendiente' : 'Clic para marcar como Devuelta'}
                        >
                          {b.devueltaAlTribunal ? '✓ SÍ' : '⏳ Pendiente'}
                        </button>
                      </td>

                      {/* ACCIONES */}
                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditBoleta(b)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteBoleta(b.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Impresión y Selección de Hojas */}
      <ImprimirHojasModal
        isOpen={isImprimirHojasOpen}
        onClose={() => setIsImprimirHojasOpen(false)}
        boletas={boletasFiltradas}
        config={config}
        filtroTribunal={selectedTribunal}
      />
    </div>
  );
};
