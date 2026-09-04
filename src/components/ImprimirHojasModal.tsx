import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Layers, 
  CheckSquare, 
  Square, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Settings2, 
  ChevronDown, 
  ChevronUp,
  Scale,
  Building2,
  Calendar
} from 'lucide-react';
import { BoletaJudicial, ConfiguracionDespacho } from '../types/judicial';
import { calcularHojasLote, HojaLote } from '../utils/sheetCalculation';
import { exportarBoletasPDF } from '../utils/exportPDF';

interface ImprimirHojasModalProps {
  isOpen: boolean;
  onClose: () => void;
  boletas: BoletaJudicial[];
  config: ConfiguracionDespacho;
  filtroTribunal?: string;
}

export const ImprimirHojasModal: React.FC<ImprimirHojasModalProps> = ({
  isOpen,
  onClose,
  boletas,
  config,
  filtroTribunal,
}) => {
  // Capacidad por hoja (por defecto 20 boletas para llenar 1 hoja completa)
  const [capacidadPorHoja, setCapacidadPorHoja] = useState<number>(20);
  // Identificador inicial para las hojas (ejemplo solicitado: uac1233)
  const [idInicial, setIdInicial] = useState<string>(() => {
    return localStorage.getItem('uac_ultimo_id_hoja') || 'uac1233';
  });
  // Hojas seleccionadas para imprimir (array de números de hoja: 1, 2, 3...)
  const [selectedHojas, setSelectedHojas] = useState<number[]>([]);
  // Detalle expandido de alguna hoja para inspección
  const [expandedHoja, setExpandedHoja] = useState<number | null>(null);

  // Filtrar boletas si hay tribunal seleccionado
  const boletasAProcesar = useMemo(() => {
    return filtroTribunal && filtroTribunal !== 'TODOS'
      ? boletas.filter(b => b.tribunal.toUpperCase() === filtroTribunal.toUpperCase())
      : boletas;
  }, [boletas, filtroTribunal]);

  // Calcular las hojas del lote según la capacidad y el identificador inicial
  const hojasCalculadas: HojaLote[] = useMemo(() => {
    return calcularHojasLote(boletasAProcesar, capacidadPorHoja, idInicial);
  }, [boletasAProcesar, capacidadPorHoja, idInicial]);

  // Inicializar todas las hojas seleccionadas por defecto cuando se abre o cambian las hojas
  React.useEffect(() => {
    if (hojasCalculadas.length > 0 && selectedHojas.length === 0) {
      setSelectedHojas(hojasCalculadas.map(h => h.numeroHoja));
    }
  }, [hojasCalculadas.length]);

  if (!isOpen) return null;

  const totalBoletas = boletasAProcesar.length;
  const totalHojas = hojasCalculadas.length;
  const hojasLlenas = hojasCalculadas.filter(h => h.estaLlena).length;
  const allSelected = totalHojas > 0 && selectedHojas.length === totalHojas;

  const handleToggleHoja = (numHoja: number) => {
    setSelectedHojas(prev => 
      prev.includes(numHoja) 
        ? prev.filter(n => n !== numHoja) 
        : [...prev, numHoja].sort((a, b) => a - b)
    );
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedHojas([]);
    } else {
      setSelectedHojas(hojasCalculadas.map(h => h.numeroHoja));
    }
  };

  const handleSelectOnlyLlenas = () => {
    const llenas = hojasCalculadas.filter(h => h.estaLlena).map(h => h.numeroHoja);
    setSelectedHojas(llenas);
  };

  const handleSelectUltimaHoja = () => {
    if (totalHojas > 0) {
      setSelectedHojas([totalHojas]);
    }
  };

  const handlePrint = (solotodas: boolean = false) => {
    const seleccion = solotodas 
      ? hojasCalculadas.map(h => h.numeroHoja) 
      : (selectedHojas.length > 0 ? selectedHojas : hojasCalculadas.map(h => h.numeroHoja));

    if (seleccion.length === 0) {
      alert('Por favor selecciona al menos una hoja para imprimir.');
      return;
    }

    // Guardar último ID inicial usado para conveniencia
    try {
      localStorage.setItem('uac_ultimo_id_hoja', idInicial.trim() || 'uac1233');
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }

    exportarBoletasPDF(boletasAProcesar, config, filtroTribunal === 'TODOS' ? undefined : filtroTribunal, {
      hojasSeleccionadas: seleccion,
      capacidadPorHoja,
      idInicial: idInicial.trim() || 'uac1233',
    });

    onClose();
  };

  const boletasSeleccionadasCount = hojasCalculadas
    .filter(h => selectedHojas.includes(h.numeroHoja))
    .reduce((acc, h) => acc + h.cantidad, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Cabecera */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Impresión de Listado por Lotes / Hojas
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30">
                  Control de Folios
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Calcula automáticamente la capacidad por hoja (cuando se llena, empieza otra) y permite seleccionar cuáles imprimir.
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

        {/* Barra de Ajuste de Folios e Identificador */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {/* Identificador Inicial de Hoja */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-700">ID Corto Inicial:</span>
              <input
                type="text"
                value={idInicial}
                onChange={(e) => setIdInicial(e.target.value.toLowerCase())}
                placeholder="ej: uac1233"
                className="w-24 font-mono font-bold text-indigo-900 bg-indigo-50/60 px-2 py-0.5 rounded border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
              />
              <span className="text-[10px] text-slate-600 font-normal">
                (ej: uac1233)
              </span>
            </div>

            {/* Capacidad por Hoja */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-700">Límite por Hoja:</span>
              <select
                value={capacidadPorHoja}
                onChange={(e) => setCapacidadPorHoja(Number(e.target.value))}
                className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer text-xs"
              >
                <option value={20}>20 Boletas (Recomendado / 1 Hoja)</option>
                <option value={18}>18 Boletas</option>
                <option value={15}>15 Boletas</option>
                <option value={22}>22 Boletas</option>
              </select>
            </div>
          </div>

          {/* Estadísticas de Cálculo de Hojas */}
          <div className="flex items-center gap-2">
            <span className="bg-slate-200 text-slate-800 px-2.5 py-1 rounded-lg font-bold">
              {totalBoletas} Boleta(s)
            </span>
            <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg font-bold border border-indigo-200">
              {totalHojas} Hoja(s) calculada(s)
            </span>
          </div>
        </div>

        {/* Barra de Acciones de Selección Rápida */}
        <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-indigo-600 cursor-pointer px-2 py-1 rounded hover:bg-slate-100"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{allSelected ? 'Deseleccionar Todas' : 'Seleccionar Todas las Hojas'}</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleSelectOnlyLlenas}
              disabled={hojasLlenas === 0}
              className="px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Solo Llenas ({hojasLlenas})
            </button>
            <button
              type="button"
              onClick={handleSelectUltimaHoja}
              className="px-2 py-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded font-semibold cursor-pointer"
            >
              Solo Última Hoja
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Seleccionadas: <strong className="text-indigo-900">{selectedHojas.length}</strong> de {totalHojas} hojas ({boletasSeleccionadasCount} boletas)
          </div>
        </div>

        {/* Lista Visual de Hojas Calculadas */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          {hojasCalculadas.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-sm text-slate-600">No hay boletas para calcular hojas</p>
              <p className="text-xs">Agrega boletas a la lista para generar y visualizar los folios.</p>
            </div>
          ) : (
            hojasCalculadas.map((hoja, hojaIdx) => {
              const isChecked = selectedHojas.includes(hoja.numeroHoja);
              const isExpanded = expandedHoja === hoja.numeroHoja;
              const fillPercentage = Math.min(100, Math.round((hoja.cantidad / hoja.capacidad) * 100));

              return (
                <div
                  key={`imprimir-hoja-${hoja.numeroHoja}-${hoja.idHoja || hojaIdx}`}
                  className={`rounded-xl border transition-all ${
                    isChecked
                      ? 'border-indigo-300 bg-white shadow-xs'
                      : 'border-slate-200 bg-slate-100/60 opacity-80'
                  }`}
                >
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    {/* Checkbox y Datos de la Hoja */}
                    <div 
                      onClick={() => handleToggleHoja(hoja.numeroHoja)}
                      className="flex items-center gap-3 cursor-pointer flex-1 select-none"
                    >
                      <div className="text-indigo-600">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      {/* Identificador corto de la hoja (uac1233) */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-xs tracking-wide">
                          {hoja.idHoja}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              Hoja {hoja.numeroHoja}
                            </span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              (Folio {hoja.numeroHoja} de {totalHojas})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Ítems Nº <strong>{hoja.rangoItems.desde}</strong> al <strong>{hoja.rangoItems.hasta}</strong>
                            {' '}• {hoja.cantidad} boleta(s)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Estado de la Hoja: Llena o En Curso */}
                    <div className="flex items-center gap-3">
                      {hoja.estaLlena ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Hoja Llena ({hoja.cantidad}/{hoja.capacidad})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>En Curso ({hoja.cantidad}/{hoja.capacidad} - Restan {hoja.capacidad - hoja.cantidad})</span>
                        </div>
                      )}

                      {/* Botón expandir detalle */}
                      <button
                        type="button"
                        onClick={() => setExpandedHoja(isExpanded ? null : hoja.numeroHoja)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                        title="Ver boletas contenidas en esta hoja"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Barra de progreso de llenado de la hoja */}
                  <div className="px-3.5 pb-2.5">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          hoja.estaLlena ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Detalle desplegable de las boletas en esta hoja */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 p-3 bg-slate-50/90 text-xs space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-slate-600 font-semibold text-[11px]">
                        <span>Boletas incluidas en el Folio {hoja.idHoja}:</span>
                        <span>Devueltas: {hoja.totalDevueltas} | Pendientes: {hoja.pendientes}</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                        {hoja.boletas.map((b, idx) => (
                          <div key={b.id ? `hoja-b-${b.id}-${idx}` : `hoja-b-${hoja.numeroHoja}-${b.numeroItem || idx}`} className="p-2 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="w-6 text-slate-400 font-mono text-center">
                                {(hoja.numeroHoja - 1) * hoja.capacidad + idx + 1}
                              </span>
                              <span className="font-bold text-slate-800">{b.numeroCausa}</span>
                              <span className="text-indigo-600 font-semibold">Bol. #{b.boletaNumero}</span>
                              <span className="text-slate-600 truncate max-w-xs">{b.notificadoCitado}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {b.tribunal}
                              </span>
                              {b.articuloCOPP && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px]">
                                  Art. {b.articuloCOPP}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pie y Botones de Acción */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            {selectedHojas.length > 0 ? (
              <span>
                Se generará un documento PDF con <strong>{selectedHojas.length} hoja(s) física(s)</strong> (total {boletasSeleccionadasCount} boletas).
              </span>
            ) : (
              <span className="text-rose-600 font-semibold">
                Selecciona al menos una hoja para imprimir.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => handlePrint(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>Imprimir Todo el Lote ({totalHojas} Hojas)</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrint(false)}
              disabled={selectedHojas.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hojas Seleccionadas ({selectedHojas.length})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
