import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Send, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Download, 
  Printer, 
  Calendar, 
  UserCheck, 
  Layers, 
  FileCheck2,
  CheckSquare,
  Square,
  AlertCircle,
  CalendarClock,
  Filter,
  QrCode,
  Pencil,
  Edit3,
  Check,
  X,
  Users
} from 'lucide-react';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  ConfiguracionDespacho,
  hasArticulo,
  getCaracterDisplay,
  getCaracterPriority
} from '../types/judicial';
import { formatFechaDisplay } from '../utils/alerts';
import { 
  exportarPlanillaAcusesPDF,
  exportarListadoDiligenciasRutasPDF,
  exportarInformeMatrizTribunalPDF,
  exportarOficioEstadisticasGlobalesPDF
} from '../utils/exportPDF';

interface AcusesTribunalViewProps {
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  config: ConfiguracionDespacho;
  initialTribunalCode?: string;
  initialSelectedBoletaIds?: string[];
  onUpdateBoletas: (updated: BoletaJudicial[]) => void;
}

export const AcusesTribunalView: React.FC<AcusesTribunalViewProps> = ({
  boletas,
  tribunales,
  config,
  initialTribunalCode = 'C1',
  initialSelectedBoletaIds = [],
  onUpdateBoletas,
}) => {
  const [selectedTribunalCode, setSelectedTribunalCode] = useState<string>(initialTribunalCode);
  const [selectedBoletaIds, setSelectedBoletaIds] = useState<string[]>(initialSelectedBoletaIds);
  const [filterStatus, setFilterStatus] = useState<'TODAS' | 'DEVUELTAS_HOY' | 'PENDIENTES' | 'ENTREGADAS'>('TODAS');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPlanillaModal, setShowPlanillaModal] = useState(false);
  
  // Fecha en que se hará la entrega (pregunta requerida por el usuario)
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [fechaEntregaPlanilla, setFechaEntregaPlanilla] = useState(todayStr);
  const [alguacilEntregaPlanilla, setAlguacilEntregaPlanilla] = useState('');
  
  // Sync if initial props change
  React.useEffect(() => {
    if (initialTribunalCode) {
      setSelectedTribunalCode(initialTribunalCode);
    }
  }, [initialTribunalCode]);

  React.useEffect(() => {
    if (initialSelectedBoletaIds && initialSelectedBoletaIds.length > 0) {
      setSelectedBoletaIds(initialSelectedBoletaIds);
    }
  }, [initialSelectedBoletaIds]);
  
  // Batch form fields
  const [batchFechaEntrega, setBatchFechaEntrega] = useState(todayStr);
  const [batchHoraEntrega, setBatchHoraEntrega] = useState(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  const [batchRecibidoPor, setBatchRecibidoPor] = useState('');
  const [batchNumeroOficio, setBatchNumeroOficio] = useState('');
  const [batchObservaciones, setBatchObservaciones] = useState('');

  // Info del tribunal seleccionado
  const selectedTribunal = useMemo(() => {
    return tribunales.find(t => t.codigo === selectedTribunalCode) || tribunales[0];
  }, [tribunales, selectedTribunalCode]);

  // Helper: Solo las boletas listas por entregar o ya entregadas aparecen en los acuses.
  // Es decir: practicadas por alguacil, devueltas a UAC, o ya devueltas/acusadas.
  // Si están en diligencia en calle con el alguacil sin regresar a UAC, NO deben aparecer en acuses.
  const isBoletaListaPorEntregar = (b: BoletaJudicial): boolean => {
    return b.devueltaAlTribunal || b.estado === 'PRACTICADA' || !!b.fechaRecibidoUAC || !!b.acuseGenerado;
  };

  // Todas las boletas registradas para este tribunal
  const boletasTodasTribunal = useMemo(() => {
    return boletas.filter(b => b.tribunal.toUpperCase() === selectedTribunalCode.toUpperCase());
  }, [boletas, selectedTribunalCode]);

  // Boletas de este tribunal LISTAS por entregar o ya entregadas (estas son las que aparecen en acuses)
  const boletasTribunal = useMemo(() => {
    return boletasTodasTribunal.filter(b => isBoletaListaPorEntregar(b));
  }, [boletasTodasTribunal]);

  // Boletas de este tribunal que aún están en diligencia en la calle (no listas para acuse hasta que vuelvan a UAC)
  const boletasEnDiligencia = useMemo(() => {
    return boletasTodasTribunal.filter(b => !isBoletaListaPorEntregar(b));
  }, [boletasTodasTribunal]);

  // Boletas devueltas hoy en este tribunal
  const boletasDevueltasHoy = useMemo(() => {
    return boletasTribunal.filter(b => b.devueltaAlTribunal && b.fechaDevueltaTribunal === todayStr);
  }, [boletasTribunal, todayStr]);

  // Métricas del tribunal en Acuses
  const totalBoletas = boletasTribunal.length;
  const listosParaEntregar = boletasTribunal.filter(b => !b.devueltaAlTribunal).length;
  const yaEntregados = boletasTribunal.filter(b => b.devueltaAlTribunal).length;
  const totalNoListas = boletasEnDiligencia.length;

  // Detectar si hay causas/boletas repetidas con la misma tri, numeroCausa, boletaNumero
  const boletasRepetidasInfo = useMemo(() => {
    const counts = new Map<string, number>();
    boletasTribunal.forEach(b => {
      const key = `${b.numeroCausa.trim()}|${b.boletaNumero.trim()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const repetidas = Array.from(counts.entries()).filter(([_, count]) => count > 1);
    return {
      hayRepetidas: repetidas.length > 0,
      cantidadGrupos: repetidas.length,
    };
  }, [boletasTribunal]);

  // Asignación rápida de "Recibido por Tribunal" para varias o todas las boletas
  const [bulkRecibidoNombre, setBulkRecibidoNombre] = useState('');
  const [bulkRecibidoFecha, setBulkRecibidoFecha] = useState(todayStr);
  const [bulkRecibidoHora, setBulkRecibidoHora] = useState(() => 
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  );

  // Sugerencias de personas que han recibido previamente en este u otros tribunales
  const personasRecibieronRecientes = useMemo(() => {
    const setNames = new Set<string>();
    boletasTodasTribunal.forEach(b => {
      if (b.acuseRecibidoPor && b.acuseRecibidoPor.trim().length > 1) {
        setNames.add(b.acuseRecibidoPor.trim());
      }
    });
    if (setNames.size < 3) {
      boletas.forEach(b => {
        if (b.acuseRecibidoPor && b.acuseRecibidoPor.trim().length > 1) {
          setNames.add(b.acuseRecibidoPor.trim());
        }
      });
    }
    return Array.from(setNames).slice(0, 5);
  }, [boletasTodasTribunal, boletas]);

  // Aplicar persona recibida a TODAS las boletas del tribunal
  const handleAplicarRecibidoATodas = () => {
    const nombreClean = bulkRecibidoNombre.trim();
    if (!nombreClean) {
      alert('Por favor escribe el nombre de la persona que recibió en el tribunal.');
      return;
    }
    if (boletasTribunal.length === 0) {
      alert('No hay boletas listas en este tribunal para asignar.');
      return;
    }
    const fechaClean = bulkRecibidoFecha || todayStr;
    const horaClean = bulkRecibidoHora.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const targetIds = boletasTribunal.map(b => b.id);

    const updated = boletas.map(b => {
      if (targetIds.includes(b.id)) {
        return {
          ...b,
          acuseRecibidoPor: nombreClean,
          acuseFechaEntrega: fechaClean,
          acuseHoraEntrega: horaClean,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: fechaClean,
          acuseGenerado: true,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
  };

  // Aplicar persona recibida a las boletas SELECCIONADAS
  const handleAplicarRecibidoASeleccionadas = () => {
    const nombreClean = bulkRecibidoNombre.trim();
    if (!nombreClean) {
      alert('Por favor escribe el nombre de la persona que recibió en el tribunal.');
      return;
    }
    if (selectedBoletaIds.length === 0) {
      alert('Por favor selecciona primero las boletas marcando las casillas a la izquierda.');
      return;
    }
    const fechaClean = bulkRecibidoFecha || todayStr;
    const horaClean = bulkRecibidoHora.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const updated = boletas.map(b => {
      if (selectedBoletaIds.includes(b.id)) {
        return {
          ...b,
          acuseRecibidoPor: nombreClean,
          acuseFechaEntrega: fechaClean,
          acuseHoraEntrega: horaClean,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: fechaClean,
          acuseGenerado: true,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
  };

  // Marcar boletas en diligencia como recibidas en UAC (ponerlas listas para entregar)
  const handleMarcarEnDiligenciaComoListas = () => {
    if (boletasEnDiligencia.length === 0) return;
    if (!confirm(`¿Confirmas que regresaron y se recibieron en UAC las ${boletasEnDiligencia.length} boleta(s) de ${selectedTribunal.codigo} para ponerlas listas por entregar?`)) return;

    const ids = boletasEnDiligencia.map(b => b.id);
    const updated = boletas.map(b => {
      if (ids.includes(b.id)) {
        return {
          ...b,
          fechaRecibidoUAC: todayStr,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });
    onUpdateBoletas(updated);
  };

  // Inline editing para casilla "RECIBIDO EN TRIBUNAL" (Secretaria que recibió, fecha y hora)
  const [editingRecibidoId, setEditingRecibidoId] = useState<string | null>(null);
  const [editRecibidoNombre, setEditRecibidoNombre] = useState('');
  const [editRecibidoFecha, setEditRecibidoFecha] = useState(todayStr);
  const [editRecibidoHora, setEditRecibidoHora] = useState('');
  const [editAplicarSeleccionadas, setEditAplicarSeleccionadas] = useState(false);

  // Iniciar edición de la secretaria en la casilla
  const handleStartEditRecibido = (b: BoletaJudicial) => {
    setEditingRecibidoId(b.id);
    setEditRecibidoNombre(b.acuseRecibidoPor || '');
    setEditRecibidoFecha(b.acuseFechaEntrega || b.fechaDevueltaTribunal || todayStr);
    setEditRecibidoHora(b.acuseHoraEntrega || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    setEditAplicarSeleccionadas(selectedBoletaIds.includes(b.id) && selectedBoletaIds.length > 1);
  };

  // Guardar datos de quien recibió directamente desde la casilla
  const handleSaveEditRecibido = (boletaId: string, applyScope: 'ONE' | 'ALL' | 'SELECTED' = 'ONE') => {
    const nombreClean = editRecibidoNombre.trim();
    const fechaClean = editRecibidoFecha || todayStr;
    const horaClean = editRecibidoHora.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    let targetIds = [boletaId];
    if (applyScope === 'ALL') {
      targetIds = boletasTribunal.map(b => b.id);
    } else if (applyScope === 'SELECTED') {
      targetIds = (selectedBoletaIds.length > 0 && selectedBoletaIds.includes(boletaId)) ? selectedBoletaIds : [boletaId];
    } else if (editAplicarSeleccionadas && selectedBoletaIds.includes(boletaId)) {
      targetIds = selectedBoletaIds;
    }

    const updated = boletas.map(b => {
      if (targetIds.includes(b.id)) {
        return {
          ...b,
          acuseRecibidoPor: nombreClean || undefined,
          acuseFechaEntrega: nombreClean ? fechaClean : b.acuseFechaEntrega,
          acuseHoraEntrega: nombreClean ? horaClean : b.acuseHoraEntrega,
          devueltaAlTribunal: !!nombreClean,
          fechaDevueltaTribunal: nombreClean ? fechaClean : b.fechaDevueltaTribunal,
          acuseGenerado: !!nombreClean,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setEditingRecibidoId(null);
  };

  // Limpiar / revertir a Sin cargo registrado
  const handleClearRecibido = (boletaId: string) => {
    const updated = boletas.map(b => {
      if (b.id === boletaId) {
        return {
          ...b,
          acuseRecibidoPor: undefined,
          acuseFechaEntrega: undefined,
          acuseHoraEntrega: undefined,
          devueltaAlTribunal: false,
          fechaDevueltaTribunal: undefined,
          acuseGenerado: false,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });
    onUpdateBoletas(updated);
    setEditingRecibidoId(null);
  };

  // Toggle selección
  const toggleSelectBoleta = (id: string) => {
    setSelectedBoletaIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllPendientes = () => {
    const pendientesIds = boletasTribunal.filter(b => !b.devueltaAlTribunal).map(b => b.id);
    setSelectedBoletaIds(pendientesIds);
  };

  const selectAllDevueltasHoy = () => {
    const hoyIds = boletasDevueltasHoy.map(b => b.id);
    setSelectedBoletaIds(hoyIds);
  };

  const clearSelection = () => {
    setSelectedBoletaIds([]);
  };

  // Determinar boletas a incluir para la planilla
  const boletasAIncluir = useMemo(() => {
    if (selectedBoletaIds.length > 0) {
      return boletasTribunal.filter(b => selectedBoletaIds.includes(b.id));
    }
    // Si no hay seleccionadas manualmente, incluir las devueltas o pendientes según filtro
    const devueltas = boletasTribunal.filter(b => b.devueltaAlTribunal);
    return devueltas.length > 0 ? devueltas : boletasTribunal;
  }, [boletasTribunal, selectedBoletaIds]);

  // Abrir modal de confirmación y fecha antes de generar PDF
  const handleOpenPlanillaModal = () => {
    if (boletasTribunal.length === 0) {
      alert('No hay boletas registradas para este tribunal.');
      return;
    }
    // Determinar alguacil por defecto
    const alguacilesLista = Array.from(new Set(boletasAIncluir.map(b => b.alguacilPractica).filter(Boolean)));
    setAlguacilEntregaPlanilla(alguacilesLista.join(', ') || config.alguacilesRuta || 'ALGUACILAZGO');
    setShowPlanillaModal(true);
  };

  // Generar Planilla PDF Oficial de Acuse con la fecha especificada
  const handleConfirmarGeneracionPlanilla = (marcarEntregadas: boolean = false) => {
    if (boletasAIncluir.length === 0) {
      alert('No hay boletas seleccionadas para generar la planilla.');
      return;
    }

    exportarPlanillaAcusesPDF(
      selectedTribunal.nombre,
      boletasAIncluir,
      config,
      fechaEntregaPlanilla,
      alguacilEntregaPlanilla || config.alguacilesRuta
    );

    if (marcarEntregadas) {
      const idsAEntregar = boletasAIncluir.map(b => b.id);
      const updated = boletas.map(b => {
        if (idsAEntregar.includes(b.id)) {
          return {
            ...b,
            devueltaAlTribunal: true,
            fechaDevueltaTribunal: fechaEntregaPlanilla,
            acuseGenerado: true,
            acuseFechaEntrega: fechaEntregaPlanilla,
            estado: 'DEVUELTA_TRIBUNAL' as const,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });
      onUpdateBoletas(updated);
      setSelectedBoletaIds([]);
    }

    setShowPlanillaModal(false);
  };

  // Guardar entrega en lote con formulario modal
  const handleGuardarEntregaLote = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBoletaIds.length === 0) return;

    const updated = boletas.map(b => {
      if (selectedBoletaIds.includes(b.id)) {
        return {
          ...b,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: batchFechaEntrega,
          acuseGenerado: true,
          acuseNumeroControl: batchNumeroOficio || `ACU-${selectedTribunal.codigo}-${batchFechaEntrega}`,
          acuseFechaEntrega: batchFechaEntrega,
          acuseHoraEntrega: batchHoraEntrega.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          acuseRecibidoPor: batchRecibidoPor || 'Secretaría del Tribunal',
          acuseObservaciones: batchObservaciones,
          estado: 'DEVUELTA_TRIBUNAL' as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setSelectedBoletaIds([]);
    setShowBatchModal(false);
    setBatchRecibidoPor('');
    setBatchObservaciones('');
  };

  // Marcado directo de entrega rápida (1 solo clic)
  const handleDirectMarkEntregadas = () => {
    if (selectedBoletaIds.length === 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = boletas.map(b => {
      if (selectedBoletaIds.includes(b.id)) {
        return {
          ...b,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: b.fechaDevueltaTribunal || todayStr,
          acuseGenerado: true,
          acuseNumeroControl: b.acuseNumeroControl || `ACU-${selectedTribunal.codigo}-${todayStr}`,
          acuseFechaEntrega: b.acuseFechaEntrega || todayStr,
          acuseRecibidoPor: b.acuseRecibidoPor || 'Secretaría del Tribunal',
          estado: 'DEVUELTA_TRIBUNAL' as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setSelectedBoletaIds([]);
  };

  return (
    <div className="space-y-5">
      {/* Selector de Tribunales en Cuadrícula / Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Seleccionar Tribunal para Relación de Acuses
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            11 Tribunales del Circuito Judicial
          </span>
        </div>

        {/* Botones de Tribunales */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {tribunales.map((tri) => {
            const count = boletas.filter(b => b.tribunal.toUpperCase() === tri.codigo.toUpperCase() && isBoletaListaPorEntregar(b)).length;
            const pendientes = boletas.filter(b => b.tribunal.toUpperCase() === tri.codigo.toUpperCase() && isBoletaListaPorEntregar(b) && !b.devueltaAlTribunal).length;
            const enRuta = boletas.filter(b => b.tribunal.toUpperCase() === tri.codigo.toUpperCase() && !isBoletaListaPorEntregar(b)).length;
            const isSelected = selectedTribunalCode === tri.codigo;

            return (
              <button
                key={tri.id}
                id={`btn-select-tri-${tri.codigo}`}
                onClick={() => {
                  setSelectedTribunalCode(tri.codigo);
                  setSelectedBoletaIds([]);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${isSelected ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-800'}`}>
                    {tri.codigo}
                  </span>
                  {pendientes > 0 ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                      {pendientes} pend.
                    </span>
                  ) : count > 0 ? (
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-emerald-600'}`}>
                      Al día
                    </span>
                  ) : (
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      Sin boletas
                    </span>
                  )}
                </div>
                <p className={`text-[11px] font-semibold mt-1.5 truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                  {tri.nombre}
                </p>
                <div className={`flex items-center justify-between mt-1 text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                  <span>Listas: {count} {enRuta > 0 ? `(${enRuta} en ruta)` : ''}</span>
                  <span>{Math.round((count > 0 ? ((count - pendientes) / count) : 1) * 100)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle y Gestión de Acuses del Tribunal Seleccionado */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Encabezado del Tribunal */}
        <div className="p-4 sm:p-5 bg-[#1e293b] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-700">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-black text-indigo-300 text-lg">
              {selectedTribunal.codigo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {selectedTribunal.nombre}
                </h3>
                <span className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white font-extrabold rounded uppercase">
                  {selectedTribunal.tipo}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Relación y control de boletas judiciales, acuses de recibo y devoluciones
              </p>
            </div>
          </div>

          {/* Botones de acción del acuse */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              id="btn-imprimir-planilla-acuse"
              onClick={handleOpenPlanillaModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ring-1 ring-white/20"
              title="Generar Planilla Oficial de Entrega en formato PDF para imprimir"
            >
              <FileCheck2 className="w-4 h-4 text-white" />
              <span>Generar Planilla (PDF)</span>
            </button>

            {/* Botón Oficio de Rendición por Tribunal con QR (Sin listado detallado de boletas) */}
            <button
              id="btn-oficio-tribunal-qr"
              onClick={() => exportarInformeMatrizTribunalPDF(selectedTribunal, boletas, config)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-500 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ring-1 ring-white/10"
              title={`Descargar Oficio de Rendición por Tribunal con 7 Artículos COPP (167 al S 165), efectividad y QR para ${selectedTribunal.codigo}`}
            >
              <QrCode className="w-4 h-4 text-amber-300" />
              <span>Oficio Tribunal COPP (QR)</span>
            </button>

            <button
              id="btn-oficio-global-qr"
              onClick={() => exportarOficioEstadisticasGlobalesPDF(boletas, tribunales, config)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Descargar Oficio de Rendición de Estadísticas Globales por Artículos del COPP para Presidencia con Código QR"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Oficio Global COPP (QR)</span>
            </button>

            {selectedBoletaIds.length > 0 && (
              <button
                type="button"
                onClick={handleDirectMarkEntregadas}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Marcar inmediatamente como entregadas al tribunal sin abrir formulario"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Marcar Entregadas ({selectedBoletaIds.length})</span>
              </button>
            )}

            <button
              id="btn-marcar-entregadas-acuse"
              disabled={selectedBoletaIds.length === 0}
              onClick={() => setShowBatchModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ${
                selectedBoletaIds.length > 0
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
              }`}
              title="Abrir formulario para especificar número de oficio y persona que recibe"
            >
              <FileText className="w-4 h-4" />
              <span>Registrar con Oficio</span>
            </button>
          </div>
        </div>

        {/* Notificación de causas consolidadas si existen */}
        {boletasRepetidasInfo.hayRepetidas && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Detección de Causas/Boletas:</strong> Se detectaron boletas que comparten Tribunal, Nº de Causa y Boleta Nº. Al generar la planilla PDF, el sistema las consolidará automáticamente mostrando <strong>Nº DE CAUSA, BOLETA Nº, CARÁCTER, TRI</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Tarjetas de Resumen Rápido del Tribunal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Listas en Acuses</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{totalBoletas}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Devueltas / Acusadas</span>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{yaEntregados}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider">Devueltas Hoy</span>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">{boletasDevueltasHoy.length}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">Pendientes de Entrega</span>
            <p className="text-2xl font-bold text-amber-800 mt-0.5">{listosParaEntregar}</p>
          </div>
        </div>

        {/* Notificación informativa: Boletas no listas por entregar (aún en diligencia en calle con alguacil) */}
        {totalNoListas > 0 && (
          <div className="px-4 py-2.5 bg-amber-50/90 border-b border-amber-200 text-amber-950 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{totalNoListas} boleta(s) aún en diligencia en la calle:</strong> No se muestran en estos acuses hasta que regresen a UAC o estén practicadas por el alguacil.
              </span>
            </div>
            <button
              type="button"
              onClick={handleMarcarEnDiligenciaComoListas}
              className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-lg font-bold text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
              title="Marcar que estas boletas ya fueron devueltas a la Unidad de Alguacilazgo para que aparezcan listas para acuse"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marcar recibidas en UAC ({totalNoListas})</span>
            </button>
          </div>
        )}

        <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtros de Estado */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterStatus('TODAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'TODAS'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({boletasTribunal.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('DEVUELTAS_HOY')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'DEVUELTAS_HOY'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Devueltas Hoy ({boletasDevueltasHoy.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PENDIENTES')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'PENDIENTES'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({boletasTribunal.filter(b => !b.devueltaAlTribunal).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ENTREGADAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'ENTREGADAS'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Entregadas ({boletasTribunal.filter(b => b.devueltaAlTribunal).length})
              </button>
            </div>

            {boletasDevueltasHoy.length > 0 && (
              <button
                onClick={selectAllDevueltasHoy}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold cursor-pointer border border-indigo-200"
                title="Seleccionar solo las boletas devueltas hoy"
              >
                <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Seleccionar devueltas de hoy ({boletasDevueltasHoy.length})</span>
              </button>
            )}

            <button
              onClick={selectAllPendientes}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer border border-slate-200"
            >
              <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
              <span>Seleccionar pendientes</span>
            </button>
            {selectedBoletaIds.length > 0 && (
              <button
                onClick={clearSelection}
                className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
              >
                Limpiar ({selectedBoletaIds.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
              {selectedBoletaIds.length > 0 
                ? `${selectedBoletaIds.length} seleccionada(s) para imprimir/entregar` 
                : 'Ninguna marcada (se incluirán todas las del tribunal al imprimir)'}
            </span>
          </div>
        </div>

        {/* PANEL: Asignación Rápida de "Recibido en Tribunal" para varias o todas las boletas */}
        <div className="p-3.5 bg-gradient-to-r from-amber-50/90 via-indigo-50/60 to-emerald-50/60 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  Recibido en Tribunal (Asignación Rápida sin escribir boleta por boleta)
                </span>
                <span className="text-[11px] text-slate-600 block">
                  Escribe la persona una sola vez y aplícala a <strong>todas</strong> las boletas o a un <strong>grupo seleccionado</strong>.
                </span>
              </div>
            </div>

            {/* Sugerencias de secretarias/asistentes que han recibido */}
            {personasRecibieronRecientes.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-bold">Frecuentes:</span>
                <div className="flex flex-wrap items-center gap-1">
                  {personasRecibieronRecientes.map((nombre, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBulkRecibidoNombre(nombre)}
                      className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md font-semibold text-[11px] cursor-pointer shadow-2xs transition-colors"
                      title={`Copiar "${nombre}" al campo de texto`}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {/* Input Nombre de Quien Recibió */}
            <div className="flex-1 min-w-[260px]">
              <input
                type="text"
                value={bulkRecibidoNombre}
                onChange={(e) => setBulkRecibidoNombre(e.target.value)}
                placeholder="Nombre de la Secretaria o Asistente que recibe (ej: Abg. María Gómez)..."
                className="w-full px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>

            {/* Fecha */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Fecha:</span>
              <input
                type="date"
                value={bulkRecibidoFecha}
                onChange={(e) => setBulkRecibidoFecha(e.target.value)}
                className="text-xs text-slate-800 font-medium focus:outline-none"
              />
            </div>

            {/* Hora */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Hora:</span>
              <input
                type="text"
                value={bulkRecibidoHora}
                onChange={(e) => setBulkRecibidoHora(e.target.value)}
                placeholder="ej: 10:30 AM"
                className="w-22 text-xs text-slate-800 font-medium focus:outline-none"
              />
            </div>

            {/* Botón 1: Asignar a TODAS las boletas del tribunal */}
            <button
              type="button"
              onClick={handleAplicarRecibidoATodas}
              disabled={!bulkRecibidoNombre.trim() || boletasTribunal.length === 0}
              className="px-3.5 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
              title={`Asigna "${bulkRecibidoNombre || 'esta persona'}" a las ${boletasTribunal.length} boletas listas de ${selectedTribunal.codigo}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Aplicar a TODAS ({boletasTribunal.length})</span>
            </button>

            {/* Botón 2: Asignar a las SELECCIONADAS */}
            <button
              type="button"
              onClick={handleAplicarRecibidoASeleccionadas}
              disabled={!bulkRecibidoNombre.trim() || selectedBoletaIds.length === 0}
              className="px-3.5 py-1.5 text-xs font-black text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
              title={selectedBoletaIds.length > 0 ? `Asigna a las ${selectedBoletaIds.length} boletas marcadas` : 'Marca al menos una boleta con su casilla a la izquierda'}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>☑️ Aplicar a SELECCIONADAS ({selectedBoletaIds.length})</span>
            </button>
          </div>
        </div>

        {/* Tabla de Boletas del Tribunal con bordes visibles, texto centrado y 7 Columnas COPP */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-slate-300">
            <thead>
              <tr className="bg-[#1e293b] text-white font-bold border-b border-slate-700 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-10 border border-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      boletasTribunal.length > 0 &&
                      boletasTribunal.every(b => selectedBoletaIds.includes(b.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBoletaIds(boletasTribunal.map(b => b.id));
                      } else {
                        setSelectedBoletaIds([]);
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-2 text-center w-10 border border-slate-700">Nº</th>
                <th className="py-2.5 px-3 min-w-[130px] border border-slate-700">Nº CAUSA / EXP.</th>
                <th className="py-2.5 px-2 text-center w-20 border border-slate-700">BOLETA Nº</th>
                <th className="py-2.5 px-2 text-center min-w-[85px] border border-slate-700">CARÁCTER</th>
                <th className="py-2.5 px-3 min-w-[180px] text-center border border-slate-700">NOTIFICADO Y CITADO</th>
                <th className="py-2.5 px-2 text-center min-w-[85px] border border-slate-700">F. AUDIENCIA</th>
                <th className="py-2.5 px-1.5 text-center min-w-[65px] border border-slate-700">HORA</th>

                {/* 7 Columnas COPP con colores exactos y bordes visibles */}
                <th className="py-2 px-1 text-center bg-[#8f9ca8] text-slate-950 w-8 font-black border border-slate-400" title="Art. 167 COPP - Boleta personal">167</th>
                <th className="py-2 px-1 text-center bg-[#5c98e2] text-slate-950 w-8 font-black border border-slate-400" title="Art. 168 COPP - Víctima/Expertos">168</th>
                <th className="py-2 px-1 text-center bg-[#8ea8be] text-slate-950 w-8 font-black border border-slate-400" title="Art. 169 COPP - Telemática / Fax / Correo">169</th>
                <th className="py-2 px-1 text-center bg-[#9dce64] text-slate-950 w-8 font-black border border-slate-400" title="Art. 170 COPP - Funcionarios / Militares">170</th>
                <th className="py-2 px-1 text-center bg-[#e7444b] text-slate-950 w-8 font-black border border-slate-400" title="Art. 171 COPP - Cartel / Edictos">171</th>
                <th className="py-2 px-1 text-center bg-[#fce444] text-slate-950 w-8 font-black border border-slate-400" title="Art. 165 COPP - Notificación">165</th>
                <th className="py-1 px-1 text-center bg-[#df7a40] text-slate-950 w-9 font-black select-none text-[10px] leading-tight border border-slate-400" title="Art. S 165 COPP - Notificación Especial">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black leading-none">S</span>
                    <span className="text-[10px] font-black leading-none mt-0.5">165</span>
                  </div>
                </th>

                <th className="py-2.5 px-2 min-w-[95px] border border-slate-700">ALGUACIL</th>
                <th className="py-2.5 px-2 text-center min-w-[110px] border border-slate-700">ESTADO ACUSE</th>
                <th className="py-2.5 px-3 min-w-[130px] border border-slate-700">RECIBIDO EN TRIBUNAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {boletasTribunal
                .filter(b => {
                  if (filterStatus === 'DEVUELTAS_HOY') return b.devueltaAlTribunal && b.fechaDevueltaTribunal === todayStr;
                  if (filterStatus === 'PENDIENTES') return !b.devueltaAlTribunal;
                  if (filterStatus === 'ENTREGADAS') return b.devueltaAlTribunal;
                  return true;
                })
                .length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-8 text-center text-slate-400 border border-slate-200">
                    No hay boletas asignadas para {selectedTribunal.nombre} con este filtro.
                  </td>
                </tr>
              ) : (
                boletasTribunal
                  .filter(b => {
                    if (filterStatus === 'DEVUELTAS_HOY') return b.devueltaAlTribunal && b.fechaDevueltaTribunal === todayStr;
                    if (filterStatus === 'PENDIENTES') return !b.devueltaAlTribunal;
                    if (filterStatus === 'ENTREGADAS') return b.devueltaAlTribunal;
                    return true;
                  })
                  .map((b, idx) => {
                  const isSelected = selectedBoletaIds.includes(b.id);
                  const is167 = hasArticulo(b, '167');
                  const is168 = hasArticulo(b, '168');
                  const is169 = hasArticulo(b, '169');
                  const is170 = hasArticulo(b, '170');
                  const is171 = hasArticulo(b, '171');
                  const is165 = hasArticulo(b, '165');
                  const isS165 = hasArticulo(b, 'S_165');

                  return (
                    <tr 
                      key={b.id}
                      className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/70 font-medium' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-center border border-slate-300">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectBoleta(b.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-center font-bold text-slate-500 border border-slate-300">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-indigo-700 font-mono border border-slate-300">
                        {b.numeroCausa}
                      </td>

                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 bg-slate-50 border border-slate-300">
                        {b.boletaNumero}
                      </td>

                      {/* CARÁCTER (con orden prioritario) */}
                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                          {getCaracterDisplay(b.tipoCitado)}
                        </span>
                      </td>

                      {/* NOTIFICADO Y CITADO (Centrado) */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 text-center border border-slate-300">
                        {b.notificadoCitado}
                      </td>

                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        {b.esSoloNotificacion ? (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded font-semibold text-slate-600">
                            NOTIFICACIÓN
                          </span>
                        ) : (
                          <span className="font-bold text-slate-800">
                            {formatFechaDisplay(b.fechaAudiencia)}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-1.5 text-center font-bold text-slate-700 border border-slate-300">
                        {b.horaAudiencia || '-'}
                      </td>

                      {/* 167 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {is167 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8f9ca8] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      {/* 168 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {is168 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#5c98e2] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      {/* 169 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {is169 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8ea8be] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      {/* 170 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {is170 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#9dce64] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      {/* 171 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {is171 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#e7444b] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      {/* 165 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {is165 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#fce444] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      {/* S 165 */}
                      <td className="py-2 px-1 text-center border border-slate-300">
                        {isS165 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#df7a40] text-slate-950 font-black text-xs">
                            1
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 font-semibold text-slate-700 border border-slate-300">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">
                          {b.alguacilPractica || '-'}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center border border-slate-300">
                        {b.devueltaAlTribunal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Entregado {b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Por Entregar</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-2.5 text-slate-700 border border-slate-300 align-top">
                        {editingRecibidoId === b.id ? (
                          <div className="flex flex-col gap-1.5 p-2 bg-amber-50/95 border border-amber-400 rounded-lg shadow-sm min-w-[220px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-amber-700" />
                                Secretaria que Recibió
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingRecibidoId(null)}
                                className="text-slate-400 hover:text-slate-700 text-xs p-0.5 cursor-pointer"
                                title="Cerrar edición"
                              >
                                ✕
                              </button>
                            </div>
                            <input
                              type="text"
                              value={editRecibidoNombre}
                              onChange={(e) => setEditRecibidoNombre(e.target.value)}
                              placeholder="Nombre de la Secretaria..."
                              className="w-full px-2 py-1 text-xs border border-amber-300 rounded font-bold text-slate-900 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditRecibido(b.id);
                                if (e.key === 'Escape') setEditingRecibidoId(null);
                              }}
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <span className="text-[9px] text-slate-600 font-bold block">Fecha:</span>
                                <input
                                  type="date"
                                  value={editRecibidoFecha}
                                  onChange={(e) => setEditRecibidoFecha(e.target.value)}
                                  className="w-full px-1.5 py-0.5 text-[11px] border border-slate-300 rounded bg-white text-slate-800 font-medium"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-600 font-bold block">Hora:</span>
                                <input
                                  type="text"
                                  value={editRecibidoHora}
                                  onChange={(e) => setEditRecibidoHora(e.target.value)}
                                  placeholder="ej. 10:30 AM"
                                  className="w-full px-1.5 py-0.5 text-[11px] border border-slate-300 rounded bg-white text-slate-800 font-medium"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-amber-200/80">
                              {b.acuseRecibidoPor ? (
                                <button
                                  type="button"
                                  onClick={() => handleClearRecibido(b.id)}
                                  className="px-1.5 py-0.5 text-[10px] text-rose-600 hover:bg-rose-100 rounded font-semibold cursor-pointer"
                                  title="Quitar registro y volver a Sin cargo registrado"
                                >
                                  Limpiar
                                </button>
                              ) : <span />}
                              
                              <div className="flex flex-wrap items-center gap-1 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => setEditingRecibidoId(null)}
                                  className="px-2 py-0.5 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                
                                {boletasTribunal.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditRecibido(b.id, 'ALL')}
                                    className="px-2 py-0.5 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer shadow-2xs"
                                    title={`Copiar "${editRecibidoNombre || 'este nombre'}" a todas las ${boletasTribunal.length} boletas`}
                                  >
                                    A Todas ({boletasTribunal.length})
                                  </button>
                                )}

                                {selectedBoletaIds.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditRecibido(b.id, 'SELECTED')}
                                    className="px-2 py-0.5 text-[10px] bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold cursor-pointer shadow-2xs"
                                    title={`Copiar a las ${selectedBoletaIds.length} boletas seleccionadas`}
                                  >
                                    A Selecc. ({selectedBoletaIds.length})
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleSaveEditRecibido(b.id, 'ONE')}
                                  className="px-2.5 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="Guardar únicamente en esta boleta"
                                >
                                  <Check className="w-3 h-3" />
                                  Guardar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : b.acuseRecibidoPor ? (
                          <div 
                            onClick={() => handleStartEditRecibido(b)}
                            className="group cursor-pointer p-1.5 rounded-lg hover:bg-indigo-50/70 border border-transparent hover:border-indigo-200 transition-all"
                            title="Hacer clic para editar secretaria que recibió, fecha u hora"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 text-[11px] leading-tight">
                                {b.acuseRecibidoPor}
                              </span>
                              <Pencil className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 shrink-0" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5">
                              <Calendar className="w-2.5 h-2.5 text-slate-400" />
                              <span>{formatFechaDisplay(b.acuseFechaEntrega || b.fechaDevueltaTribunal)}</span>
                              {b.acuseHoraEntrega && (
                                <>
                                  <span>•</span>
                                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{b.acuseHoraEntrega}</span>
                                </>
                              )}
                            </div>
                            {b.acuseNumeroControl && (
                              <span className="text-[9px] text-indigo-600 font-mono font-semibold block">{b.acuseNumeroControl}</span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditRecibido(b)}
                            className="w-full text-left p-1.5 rounded-lg border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-700 transition-colors flex items-center justify-between group cursor-pointer"
                            title="Hacer clic para escribir secretaria que recibió con fecha y hora"
                          >
                            <span className="italic text-[11px]">Sin cargo registrado</span>
                            <span className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-indigo-200">
                              <Edit3 className="w-3 h-3" />
                              Escribir
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: PREGUNTAR FECHA QUE SE HARÁ LA ENTREGA ANTES DE GENERAR PLANILLA PDF */}
      {showPlanillaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e293b] text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold">
                  Generar Planilla de Acuses (PDF) — {selectedTribunal.nombre}
                </h3>
              </div>
              <button
                onClick={() => setShowPlanillaModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Tribunal Destino:</span>
                  <span className="font-black bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded">{selectedTribunal.codigo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Boletas a incluir en el listado:</span>
                  <span className="font-extrabold text-indigo-700">{boletasAIncluir.length} boleta(s)</span>
                </div>
                {selectedBoletaIds.length > 0 ? (
                  <p className="text-[11px] text-indigo-700">
                    Se imprimirán exclusivamente las <strong>{selectedBoletaIds.length}</strong> boletas seleccionadas.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    No seleccionaste boletas individuales: se imprimirán todas las de este tribunal ({boletasAIncluir.length}).
                  </p>
                )}
              </div>

              {/* Pregunta Requerida: FECHA EN QUE SE HARÁ LA ENTREGA */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  📅 ¿EN QUÉ FECHA SE HARÁ LA ENTREGA AL TRIBUNAL?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={fechaEntregaPlanilla}
                    onChange={(e) => setFechaEntregaPlanilla(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFechaEntregaPlanilla(todayStr)}
                    className="px-2.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechaEntregaPlanilla(tomorrowStr)}
                    className="px-2.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
                  >
                    Mañana
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Esta fecha aparecerá en el encabezado oficial del acuse de entrega.
                </p>
              </div>

              {/* Alguacil Entrega */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Entregado por (Alguacilazgo):
                </label>
                <input
                  type="text"
                  value={alguacilEntregaPlanilla}
                  onChange={(e) => setAlguacilEntregaPlanilla(e.target.value)}
                  placeholder="Ej: RENZO M. / ALGUACILAZGO"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Aviso de consolidación de causas si aplica */}
              {boletasRepetidasInfo.hayRepetidas && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                  <span className="font-bold">Regla de consolidación activa:</span> Si varias boletas tienen el mismo Tribunal, Nº de Causa y Boleta Nº, en el PDF se incluirán consolidadas con su respectivo <strong>Nº DE CAUSA, BOLETA Nº, CARÁCTER, TRI</strong>.
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPlanillaModal(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                
                <button
                  type="button"
                  onClick={() => handleConfirmarGeneracionPlanilla(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer"
                  title="Genera y descarga el PDF sin cambiar el estado de las boletas"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Solo Descargar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmarGeneracionPlanilla(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer"
                  title="Descarga el PDF y marca las boletas como entregadas con la fecha seleccionada"
                >
                  <FileCheck2 className="w-4 h-4 text-white" />
                  <span>Descargar y Marcar Entregadas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Registro de Entrega en Lote */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e293b] text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold">
                  Registrar Entrega de Acuses ({selectedBoletaIds.length} Boletas)
                </h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarEntregaLote} className="p-5 space-y-4">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900">
                Se marcarán como <strong>Entregadas y Devueltas</strong> las {selectedBoletaIds.length} boletas seleccionadas de <strong>{selectedTribunal.nombre}</strong>.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Entrega:
                  </label>
                  <input
                    type="date"
                    required
                    value={batchFechaEntrega}
                    onChange={(e) => setBatchFechaEntrega(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hora de Entrega:
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 10:30 AM"
                    value={batchHoraEntrega}
                    onChange={(e) => setBatchHoraEntrega(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recibido en Tribunal por (Secretaria / Asistente):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Abg. María González - Secretaria de Sala"
                  value={batchRecibidoPor}
                  onChange={(e) => setBatchRecibidoPor(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nº de Oficio / Cargo de Entrega:
                </label>
                <input
                  type="text"
                  placeholder={`Ej: OFI-${selectedTribunal.codigo}-2026-088`}
                  value={batchNumeroOficio}
                  onChange={(e) => setBatchNumeroOficio(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones / Notas del Acuse:
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Entregado con sello de recibido y firma autógrafa"
                  value={batchObservaciones}
                  onChange={(e) => setBatchObservaciones(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer"
                >
                  Confirmar Entrega de Acuses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
