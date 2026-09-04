import React, { useState, useEffect } from 'react';
import { 
  Header 
} from './components/Header';
import { 
  AlertsBanner 
} from './components/AlertsBanner';
import { 
  BoletaTable 
} from './components/BoletaTable';
import { 
  EnrutamientoAlguacilesView 
} from './components/EnrutamientoAlguacilesView';
import { 
  AcusesTribunalView 
} from './components/AcusesTribunalView';
import { 
  MonthlyStatsView 
} from './components/MonthlyStatsView';
import { 
  BoletaFormModal 
} from './components/BoletaFormModal';
import { 
  BoletaQuickBatchModal 
} from './components/BoletaQuickBatchModal';
import { 
  BoletaDetailModal 
} from './components/BoletaDetailModal';
import { 
  ExportModal 
} from './components/ExportModal';
import { 
  ConfigModal 
} from './components/ConfigModal';
import { 
  NuevaListaModal 
} from './components/NuevaListaModal';

import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ConfiguracionDespacho,
  ArticuloCOPP,
  SeccionRuta
} from './types/judicial';

import { 
  BOLETAS_INICIALES, 
  TRIBUNALES_REGISTRADOS, 
  ALGUACILES_INICIALES, 
  CONFIG_INICIAL 
} from './data/mockBoletas';

const STORAGE_KEY_BOLETAS = 'tsj_control_boletas_v1';
const STORAGE_KEY_CONFIG = 'tsj_config_despacho_v1';
const STORAGE_KEY_ALGUACILES = 'tsj_alguaciles_v1';

export default function App() {
  // Configuración
  const [config, setConfig] = useState<ConfiguracionDespacho>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      return saved ? JSON.parse(saved) : CONFIG_INICIAL;
    } catch {
      return CONFIG_INICIAL;
    }
  });

  // Alguaciles
  const [alguaciles, setAlguaciles] = useState<Alguacil[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALGUACILES);
      return saved ? JSON.parse(saved) : ALGUACILES_INICIALES;
    } catch {
      return ALGUACILES_INICIALES;
    }
  });

  // Tribunales
  const [tribunales] = useState<TribunalInfo[]>(TRIBUNALES_REGISTRADOS);

  // Boletas Judiciales
  const [boletas, setBoletas] = useState<BoletaJudicial[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOLETAS);
      if (!saved) return BOLETAS_INICIALES;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return BOLETAS_INICIALES;
      const seenIds = new Set<string>();
      return parsed.map((b: any, idx: number) => {
        let validId = b.id;
        if (!validId || seenIds.has(validId)) {
          validId = `bol-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
        }
        seenIds.add(validId);
        return {
          ...b,
          id: validId,
          numeroItem: typeof b.numeroItem === 'number' ? b.numeroItem : idx + 1,
        };
      });
    } catch {
      return BOLETAS_INICIALES;
    }
  });

  // Tab activa: 'boletas' | 'enrutamiento' | 'acuses' | 'stats'
  const [currentTab, setCurrentTab] = useState<'boletas' | 'enrutamiento' | 'acuses' | 'stats'>('boletas');
  const [targetTribunalCode, setTargetTribunalCode] = useState<string>(tribunales[0]?.codigo || 'C1');
  const [targetBoletaIdsForAcuses, setTargetBoletaIdsForAcuses] = useState<string[]>([]);

  // Navegación dirigida hacia Acuses por Tribunal
  const handleNavigateToAcuses = (tribunalCode: string, boletaIds?: string[]) => {
    setTargetTribunalCode(tribunalCode);
    if (boletaIds && boletaIds.length > 0) {
      setTargetBoletaIdsForAcuses(boletaIds);
    }
    setCurrentTab('acuses');
    showToast(`Navegando a Acuses de ${tribunalCode}${boletaIds ? ` (${boletaIds.length} boletas seleccionadas)` : ''}`);
  };

  // Filtro de Alerta seleccionado en el banner
  const [filtroAlertaActivo, setFiltroAlertaActivo] = useState<string>('TODAS');

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBoleta, setEditingBoleta] = useState<BoletaJudicial | null>(null);
  const [viewingBoleta, setViewingBoleta] = useState<BoletaJudicial | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isNuevaListaModalOpen, setIsNuevaListaModalOpen] = useState(false);

  // Toast Notificación
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Persistir en LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOLETAS, JSON.stringify(boletas));
    } catch (e) {
      console.error('Error saving boletas to localStorage:', e);
    }
  }, [boletas]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Error saving config to localStorage:', e);
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ALGUACILES, JSON.stringify(alguaciles));
    } catch (e) {
      console.error('Error saving alguaciles to localStorage:', e);
    }
  }, [alguaciles]);

  // Manejador para Guardar / Actualizar Boleta Individual
  const handleSaveBoleta = (data: Partial<BoletaJudicial>, keepOpen?: boolean) => {
    if (editingBoleta) {
      // Actualizar existente
      setBoletas(prev =>
        prev.map(b => (b.id === editingBoleta.id ? ({ ...b, ...data, updatedAt: new Date().toISOString() } as BoletaJudicial) : b))
      );
      showToast(`Boleta Nº ${data.boletaNumero || editingBoleta.boletaNumero} actualizada exitosamente.`);
      setEditingBoleta(null);
    } else {
      // Crear nueva
      const newBoleta: BoletaJudicial = {
        id: `bol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        numeroItem: boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1,
        numeroCausa: data.numeroCausa || 'LP11-P-2026-000',
        boletaNumero: data.boletaNumero || '0000',
        notificadoCitado: data.notificadoCitado || 'PERSONA CITADA',
        tipoCitado: data.tipoCitado || 'IMPUTADO',
        esSoloNotificacion: !!data.esSoloNotificacion,
        fechaAudiencia: data.fechaAudiencia || 'NOTIFICACION',
        horaAudiencia: data.horaAudiencia,
        tipoAudiencia: data.tipoAudiencia,
        fechaAsignacion: data.fechaAsignacion || new Date().toISOString().slice(0, 10),
        tribunal: data.tribunal || (tribunales[0]?.codigo || 'C1'),
        articuloCOPP: data.articuloCOPP || '',
        alguacilPractica: data.alguacilPractica || '',
        estado: data.devueltaAlTribunal ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
        devueltaAlTribunal: !!data.devueltaAlTribunal,
        fechaDevueltaTribunal: data.fechaDevueltaTribunal,
        fechaRecibidoUAC: data.fechaRecibidoUAC,
        acuseGenerado: !!data.acuseGenerado,
        acuseRecibidoPor: data.acuseRecibidoPor,
        acuseNumeroControl: data.acuseNumeroControl,
        observaciones: data.observaciones,
        direccionCitacion: data.direccionCitacion,
        mesRuta: config.mesRutaActual,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setBoletas(prev => [...prev, newBoleta]);
      showToast(`Boleta Nº ${newBoleta.boletaNumero} registrada exitosamente.`);
    }

    if (!keepOpen) {
      setIsFormModalOpen(false);
    }
  };

  // Manejador para Agregar Boleta Rápida Directa
  const handleQuickAddBoleta = (data: Partial<BoletaJudicial>) => {
    const nextItem = boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1;
    const newBoleta: BoletaJudicial = {
      id: `bol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      numeroItem: nextItem,
      numeroCausa: data.numeroCausa || 'LP11-P-2026-000',
      boletaNumero: data.boletaNumero || 'S/N',
      notificadoCitado: data.notificadoCitado || 'PERSONA CITADA',
      tipoCitado: data.tipoCitado || 'IMPUTADO',
      esSoloNotificacion: !data.fechaAudiencia,
      fechaAudiencia: data.fechaAudiencia || 'NOTIFICACION',
      fechaAsignacion: new Date().toISOString().slice(0, 10),
      tribunal: data.tribunal || (tribunales[0]?.codigo || 'C1'),
      seccionRuta: data.seccionRuta || 'RUTA_NOTIFICACION_CITACION',
      articuloCOPP: data.articuloCOPP || '',
      alguacilPractica: data.alguacilPractica || '',
      estado: data.devueltaAlTribunal ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
      devueltaAlTribunal: !!data.devueltaAlTribunal,
      acuseGenerado: false,
      mesRuta: config.mesRutaActual,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setBoletas(prev => [...prev, newBoleta]);
    showToast(`✓ Boleta Nº ${newBoleta.boletaNumero} agregada a la lista.`);
  };

  // Manejador para Guardar Lote de Boletas (Agregar a existente o nuevo lote)
  const handleSaveBatch = (newBoletas: Partial<BoletaJudicial>[], replaceExisting: boolean = false) => {
    if (newBoletas.length === 0) return;

    const baseNextItem = boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1;

    const formattedBoletas: BoletaJudicial[] = newBoletas.map((data, idx) => {
      const assignedItem = replaceExisting
        ? (idx + 1)
        : (data.numeroItem !== undefined ? data.numeroItem : (baseNextItem + idx));

      return {
        id: (data as any).id || `bol-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        numeroItem: assignedItem,
        numeroCausa: data.numeroCausa || 'LP11-P-2026-000',
        boletaNumero: data.boletaNumero || 'S/N',
        notificadoCitado: data.notificadoCitado || 'PERSONA CITADA',
        tipoCitado: data.tipoCitado || 'IMPUTADO',
        esSoloNotificacion: data.esSoloNotificacion ?? !data.fechaAudiencia,
        fechaAudiencia: data.fechaAudiencia || 'NOTIFICACION',
        fechaAsignacion: data.fechaAsignacion || new Date().toISOString().slice(0, 10),
        tribunal: data.tribunal || (tribunales[0]?.codigo || 'C1'),
        seccionRuta: data.seccionRuta || 'RUTA_NOTIFICACION_CITACION',
        articuloCOPP: data.articuloCOPP || '',
        articulosCOPP: data.articulosCOPP,
        alguacilPractica: data.alguacilPractica || '',
        estado: data.devueltaAlTribunal ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
        devueltaAlTribunal: !!data.devueltaAlTribunal,
        acuseGenerado: false,
        direccionCitacion: data.direccionCitacion,
        mesRuta: data.mesRuta || config.mesRutaActual,
        createdAt: (data as any).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    if (replaceExisting) {
      setBoletas(formattedBoletas);
      showToast(`¡Nuevo lote de ${formattedBoletas.length} boletas iniciado desde el Ítem Nº 1!`);
    } else {
      setBoletas(prev => [...prev, ...formattedBoletas]);
      showToast(`¡${formattedBoletas.length} boletas agregadas exitosamente al lote existente!`);
    }
  };

  // Eliminar Boleta
  const handleDeleteBoleta = (id: string) => {
    const target = boletas.find(b => b.id === id);
    if (!target) return;
    if (confirm(`¿Estás seguro de eliminar el registro de la boleta Nº ${target.boletaNumero} (Causa: ${target.numeroCausa})?`)) {
      setBoletas(prev => prev.filter(b => b.id !== id));
      showToast(`Boleta Nº ${target.boletaNumero} eliminada.`);
    }
  };

  // Toggle rápido "Devuelta al Tribunal"
  const handleToggleDevuelta = (id: string, devuelta: boolean) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setBoletas(prev =>
      prev.map(b => {
        if (b.id === id) {
          return {
            ...b,
            devueltaAlTribunal: devuelta,
            fechaDevueltaTribunal: devuelta ? (b.fechaDevueltaTribunal || todayStr) : undefined,
            estado: devuelta ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );
    showToast(devuelta ? 'Boleta marcada como devuelta al Tribunal.' : 'Boleta marcada como pendiente.');
  };

  // Bulk Devuelta al Tribunal
  const handleBulkDevuelta = (boletaIds: string[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setBoletas(prev =>
      prev.map(b => {
        if (boletaIds.includes(b.id)) {
          return {
            ...b,
            devueltaAlTribunal: true,
            fechaDevueltaTribunal: b.fechaDevueltaTribunal || todayStr,
            estado: 'DEVUELTA_TRIBUNAL',
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );
    showToast(`${boletaIds.length} boleta(s) marcadas como devueltas al Tribunal.`);
  };

  // Bulk Practicada en UAC
  const handleBulkPracticada = (boletaIds: string[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setBoletas(prev =>
      prev.map(b => {
        if (boletaIds.includes(b.id)) {
          return {
            ...b,
            estado: 'PRACTICADA',
            fechaRecibidoUAC: b.fechaRecibidoUAC || todayStr,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );
    showToast(`${boletaIds.length} boleta(s) marcadas como practicadas en UAC.`);
  };

  // Bulk Delete
  const handleBulkDelete = (boletaIds: string[]) => {
    setBoletas(prev => prev.filter(b => !boletaIds.includes(b.id)));
    showToast(`${boletaIds.length} boleta(s) eliminadas.`);
  };

  // Actualizar artículo(s) COPP directamente (permite hasta 2 por boleta)
  const handleUpdateArticulo = (boletaId: string, articulo: ArticuloCOPP, articulos?: ArticuloCOPP[]) => {
    const finalList = articulos && articulos.length > 0 
      ? articulos 
      : (articulo ? articulo.split(',').map(s => s.trim() as ArticuloCOPP).filter(Boolean) : []);

    setBoletas(prev =>
      prev.map(b => (b.id === boletaId ? { 
        ...b, 
        articuloCOPP: (finalList.join(', ') || '') as ArticuloCOPP, 
        articulosCOPP: finalList,
        updatedAt: new Date().toISOString() 
      } : b))
    );
    const label = finalList.length > 1 ? finalList.join(' y ') : (finalList[0] || 'ninguno');
    showToast(finalList.length > 0 ? `Artículo(s) COPP asignado(s): ${label}.` : 'Artículo COPP desmarcado.');
  };

  // Asignar artículo COPP en lote
  const handleBulkAssignArticulo = (boletaIds: string[], articulo: ArticuloCOPP) => {
    const list = articulo ? [articulo] : [];
    setBoletas(prev =>
      prev.map(b => (boletaIds.includes(b.id) ? { 
        ...b, 
        articuloCOPP: articulo, 
        articulosCOPP: list,
        updatedAt: new Date().toISOString() 
      } : b))
    );
    showToast(`Artículo COPP ${articulo || 'limpiado'} asignado a ${boletaIds.length} boleta(s).`);
  };

  // Actualizar Alguacil que practicó directamente
  const handleUpdateAlguacil = (boletaId: string, alguacil: string) => {
    setBoletas(prev =>
      prev.map(b => (b.id === boletaId ? { ...b, alguacilPractica: alguacil, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`Alguacil ${alguacil} asignado para practicar.`);
  };

  // Asignar Alguacil en lote
  const handleBulkAssignAlguacil = (boletaIds: string[], alguacil: string) => {
    setBoletas(prev =>
      prev.map(b => (boletaIds.includes(b.id) ? { ...b, alguacilPractica: alguacil, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`Alguacil ${alguacil} asignado a ${boletaIds.length} boleta(s).`);
  };

  // Actualizar Sección de Ruta
  const handleUpdateSeccion = (boletaId: string, seccion: SeccionRuta) => {
    setBoletas(prev =>
      prev.map(b => (b.id === boletaId ? { ...b, seccionRuta: seccion, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`Sección de ruta actualizada.`);
  };

  // Asignar Sección de Ruta en lote
  const handleBulkAssignSeccion = (boletaIds: string[], seccion: SeccionRuta) => {
    setBoletas(prev =>
      prev.map(b => (boletaIds.includes(b.id) ? { ...b, seccionRuta: seccion, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`${boletaIds.length} boleta(s) movidas a nueva sección.`);
  };

  // Quick acuse trigger
  const handleQuickAcuse = (boleta: BoletaJudicial) => {
    setEditingBoleta(boleta);
    setIsFormModalOpen(true);
  };

  // Limpieza y Nueva Lista
  const handleClearAllBoletas = () => {
    setBoletas([]);
    showToast('✓ Lista vaciada exitosamente. Iniciando nuevo listado desde el Item Nº 1.');
  };

  const handleClearCompletedOnly = () => {
    const pendientes = boletas.filter(b => !b.devueltaAlTribunal && !b.acuseGenerado);
    const reenumeradas = pendientes.map((b, idx) => ({ ...b, numeroItem: idx + 1 }));
    setBoletas(reenumeradas);
    showToast(`✓ Se conservaron ${reenumeradas.length} boletas activas/pendientes. Lista reordenada.`);
  };

  // Reset a datos de prueba
  const handleResetToDemoData = () => {
    setBoletas(BOLETAS_INICIALES);
    setConfig(CONFIG_INICIAL);
    setAlguaciles(ALGUACILES_INICIALES);
    showToast('Datos de demostración restablecidos.');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1e293b] text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado Principal */}
      <Header
        config={config}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenNewBoleta={() => {
          setEditingBoleta(null);
          setIsFormModalOpen(true);
        }}
        onOpenBatchModal={() => {
          setIsBatchModalOpen(true);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onOpenNuevaListaModal={() => setIsNuevaListaModalOpen(true)}
        onMonthChange={(newMonth) => {
          setConfig(prev => ({ ...prev, mesRutaActual: newMonth }));
          showToast(`Mes de ruta cambiado a ${newMonth}`);
        }}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Pestaña 1: Control General de Boletas */}
        {currentTab === 'boletas' && (
          <div className="space-y-5">
            {/* Monitor de Alertas Automáticas */}
            <AlertsBanner
              boletas={boletas}
              activeFilter={filtroAlertaActivo}
              onSelectFilter={setFiltroAlertaActivo}
            />

            {/* Tabla de Control de Boletas */}
            <BoletaTable
              boletas={boletas}
              tribunales={tribunales}
              alguaciles={alguaciles}
              config={config}
              filtroAlertaActivo={filtroAlertaActivo}
              onEditBoleta={(boleta) => {
                setEditingBoleta(boleta);
                setIsFormModalOpen(true);
              }}
              onDeleteBoleta={handleDeleteBoleta}
              onViewBoleta={(boleta) => setViewingBoleta(boleta)}
              onToggleDevuelta={handleToggleDevuelta}
              onQuickAcuse={handleQuickAcuse}
              onNavigateToAcuses={handleNavigateToAcuses}
              onBulkDevuelta={handleBulkDevuelta}
              onBulkPracticada={handleBulkPracticada}
              onBulkDelete={handleBulkDelete}
              onUpdateArticulo={handleUpdateArticulo}
              onBulkAssignArticulo={handleBulkAssignArticulo}
              onUpdateAlguacil={handleUpdateAlguacil}
              onBulkAssignAlguacil={handleBulkAssignAlguacil}
              onUpdateSeccion={handleUpdateSeccion}
              onBulkAssignSeccion={handleBulkAssignSeccion}
              onOpenNewBoleta={() => {
                setEditingBoleta(null);
                setIsFormModalOpen(true);
              }}
              onOpenBatchModal={() => setIsBatchModalOpen(true)}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenNuevaListaModal={() => setIsNuevaListaModalOpen(true)}
              onQuickAddBoleta={handleQuickAddBoleta}
            />
          </div>
        )}

        {/* Pestaña 2: Enrutamiento por Alguacil & Hojas de Ruta */}
        {currentTab === 'enrutamiento' && (
          <EnrutamientoAlguacilesView
            boletas={boletas}
            alguaciles={alguaciles}
            tribunales={tribunales}
            config={config}
            onNavigateToAcuses={handleNavigateToAcuses}
            onUpdateBoletas={(updated) => {
              setBoletas(updated);
              showToast('Enrutamiento de alguaciles actualizado.');
            }}
          />
        )}

        {/* Pestaña 3: Relación de Acuses por Tribunal */}
        {currentTab === 'acuses' && (
          <AcusesTribunalView
            boletas={boletas}
            tribunales={tribunales}
            config={config}
            initialTribunalCode={targetTribunalCode}
            initialSelectedBoletaIds={targetBoletaIdsForAcuses}
            onUpdateBoletas={(updated) => {
              setBoletas(updated);
              showToast('Relación de acuses actualizada correctamente.');
            }}
          />
        )}

        {/* Pestaña 4: Estadísticas y Resumen Mensual */}
        {currentTab === 'stats' && (
          <MonthlyStatsView
            boletas={boletas}
            tribunales={tribunales}
            config={config}
          />
        )}
      </main>

      {/* Modal Carga Individual */}
      <BoletaFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingBoleta(null);
        }}
        onSave={handleSaveBoleta}
        onOpenBatchMode={() => {
          setIsBatchModalOpen(true);
        }}
        initialData={editingBoleta}
        tribunales={tribunales}
        alguaciles={alguaciles}
        proximoNumeroItem={boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1}
        mesRutaActual={config.mesRutaActual}
      />

      {/* Modal Carga Rápida en Lote (Multi-Boletas) */}
      <BoletaQuickBatchModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSaveBatch={handleSaveBatch}
        tribunales={tribunales}
        alguaciles={alguaciles}
        proximoNumeroItem={boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1}
        mesRutaActual={config.mesRutaActual}
        boletasExistentes={boletas}
      />

      {/* Modal Detalle de Boleta */}
      <BoletaDetailModal
        isOpen={!!viewingBoleta}
        onClose={() => setViewingBoleta(null)}
        boleta={viewingBoleta}
        tribunales={tribunales}
        onEdit={(b) => {
          setViewingBoleta(null);
          setEditingBoleta(b);
          setIsFormModalOpen(true);
        }}
        onToggleDevuelta={(id, dev) => {
          handleToggleDevuelta(id, dev);
          if (viewingBoleta && viewingBoleta.id === id) {
            setViewingBoleta(prev => prev ? { ...prev, devueltaAlTribunal: dev } : null);
          }
        }}
      />

      {/* Modal Exportación */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        boletas={boletas}
        tribunales={tribunales}
        alguaciles={alguaciles}
        config={config}
      />

      {/* Modal Configuración */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSaveConfig={setConfig}
        alguaciles={alguaciles}
        onSaveAlguaciles={setAlguaciles}
        boletas={boletas}
        onRestoreBoletas={setBoletas}
        onResetToDemoData={handleResetToDemoData}
      />

      {/* Modal Iniciar Nueva Lista / Cerrar Jornada */}
      <NuevaListaModal
        isOpen={isNuevaListaModalOpen}
        onClose={() => setIsNuevaListaModalOpen(false)}
        boletas={boletas}
        tribunales={tribunales}
        alguaciles={alguaciles}
        config={config}
        onClearAll={handleClearAllBoletas}
        onClearCompletedOnly={handleClearCompletedOnly}
        onResetDemoData={handleResetToDemoData}
        onOpenQuickBatch={() => {
          setIsBatchModalOpen(true);
        }}
      />
    </div>
  );
}

