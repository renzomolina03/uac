import React from 'react';
import { 
  Building2, 
  Plus, 
  Settings, 
  BarChart3, 
  Zap,
  Printer,
  Calendar,
  Users,
  FileSpreadsheet,
  ListOrdered,
  RotateCcw,
  FileCheck
} from 'lucide-react';
import { ConfiguracionDespacho } from '../types/judicial';

interface HeaderProps {
  config: ConfiguracionDespacho;
  currentTab: 'boletas' | 'enrutamiento' | 'acuses' | 'stats';
  onTabChange: (tab: 'boletas' | 'enrutamiento' | 'acuses' | 'stats') => void;
  onOpenNewBoleta: () => void;
  onOpenBatchModal?: () => void;
  onOpenExportModal: () => void;
  onOpenConfigModal: () => void;
  onOpenNuevaListaModal: () => void;
  onMonthChange: (newMonth: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  currentTab,
  onTabChange,
  onOpenNewBoleta,
  onOpenBatchModal,
  onOpenExportModal,
  onOpenConfigModal,
  onOpenNuevaListaModal,
  onMonthChange,
}) => {
  const meses = [
    { key: '2026-07', label: 'Julio 2026' },
    { key: '2026-08', label: 'Agosto 2026' },
    { key: '2026-09', label: 'Septiembre 2026' },
    { key: '2026-10', label: 'Octubre 2026' },
    { key: '2026-11', label: 'Noviembre 2026' },
    { key: '2026-12', label: 'Diciembre 2026' },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo y Título Principal */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Control de Boletas Judiciales
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-400/30 uppercase">
                  Mérida
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {config.circuitoJudicial} • {config.unidad}
              </p>
            </div>
          </div>

          {/* Botones de Acción Rápida */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Mes */}
            <div className="flex items-center bg-slate-800 rounded-xl px-2 py-1 border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                id="header-select-mes-ruta"
                value={config.mesRutaActual}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-transparent text-indigo-300 text-xs font-bold focus:outline-none cursor-pointer"
              >
                {meses.map((m) => (
                  <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nueva Lista / Cerrar Jornada */}
            <button
              id="header-btn-nueva-lista"
              onClick={onOpenNuevaListaModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="Iniciar una nueva lista, cerrar la jornada actual o reiniciar tabla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nueva Lista</span>
            </button>

            {/* Imprimir / Exportar Reporte */}
            <button
              id="header-btn-exportar"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="Generar reportes oficiales y exportar a PDF o Excel"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Imprimir Reporte</span>
            </button>

            {/* Nueva Boleta */}
            <button
              id="header-btn-nueva-boleta"
              onClick={onOpenNewBoleta}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              title="Registrar una nueva boleta"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nueva Boleta</span>
            </button>

            {/* Configuración */}
            <button
              id="header-btn-config"
              onClick={onOpenConfigModal}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-700"
              title="Ajustes y Tribunales"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación Principales (Súper claras y sencillas) */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
          <button
            id="tab-btn-boletas"
            onClick={() => onTabChange('boletas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'boletas'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>1. Lista de Boletas (Principal)</span>
          </button>

          <button
            id="tab-btn-enrutamiento"
            onClick={() => onTabChange('enrutamiento')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'enrutamiento'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Listados por Alguacil</span>
          </button>

          <button
            id="tab-btn-acuses"
            onClick={() => onTabChange('acuses')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'acuses'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>3. Listados por Tribunal (Acuses)</span>
          </button>

          <button
            id="tab-btn-stats"
            onClick={() => onTabChange('stats')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currentTab === 'stats'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>4. Estadísticas</span>
          </button>
        </div>
      </div>
    </header>
  );
};
