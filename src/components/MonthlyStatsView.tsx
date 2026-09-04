import React, { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Flame, 
  Users, 
  Building2, 
  FileSpreadsheet, 
  FileText,
  TrendingUp,
  QrCode,
  FileCheck2,
  Download
} from 'lucide-react';
import { BoletaJudicial, TribunalInfo, ConfiguracionDespacho } from '../types/judicial';
import { ARTICULOS_INFO } from '../data/mockBoletas';
import { evaluarAlertaBoleta } from '../utils/alerts';
import { exportarBoletasExcel } from '../utils/exportExcel';
import { 
  exportarBoletasPDF, 
  exportarOficioEstadisticasGlobalesPDF, 
  exportarInformeMatrizTribunalPDF 
} from '../utils/exportPDF';

interface MonthlyStatsViewProps {
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  config: ConfiguracionDespacho;
}

export const MonthlyStatsView: React.FC<MonthlyStatsViewProps> = ({
  boletas,
  tribunales,
  config,
}) => {
  const [selectedTribunalCodeForQR, setSelectedTribunalCodeForQR] = useState(tribunales[0]?.codigo || 'C1');
  const [downloadingMsg, setDownloadingMsg] = useState('');

  const total = boletas.length;
  const devueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const pendientes = total - devueltas;
  const conAcuse = boletas.filter(b => b.acuseGenerado).length;

  let criticas = 0;
  let urgentes = 0;
  boletas.forEach(b => {
    const a = evaluarAlertaBoleta(b);
    if (a.nivel === 'CRITICA') criticas++;
    if (a.nivel === 'URGENTE') urgentes++;
  });

  const porcentajeEfectividad = total > 0 ? Math.round((devueltas / total) * 100) : 0;

  const handleDescargarOficioGlobal = async () => {
    setDownloadingMsg('Generando Oficio de Rendición de Estadísticas Globales por Artículos del COPP (QR)...');
    try {
      await exportarOficioEstadisticasGlobalesPDF(boletas, tribunales, config);
      setDownloadingMsg('¡Oficio Global descargado exitosamente!');
    } catch (e) {
      console.error(e);
      setDownloadingMsg('Error al generar el oficio');
    }
    setTimeout(() => setDownloadingMsg(''), 3500);
  };

  const handleDescargarOficioTribunal = async (triObj?: TribunalInfo) => {
    const targetTri = triObj || tribunales.find(t => t.codigo === selectedTribunalCodeForQR) || tribunales[0];
    if (!targetTri) return;
    setDownloadingMsg(`Generando Oficio de Rendición con QR para ${targetTri.codigo}...`);
    try {
      await exportarInformeMatrizTribunalPDF(targetTri, boletas, config);
      setDownloadingMsg(`¡Oficio de Rendición con QR para ${targetTri.codigo} descargado!`);
    } catch (e) {
      console.error(e);
      setDownloadingMsg('Error al generar el oficio');
    }
    setTimeout(() => setDownloadingMsg(''), 3500);
  };

  // Conteo por Artículo COPP
  const countArticulos = {
    '167': boletas.filter(b => b.articuloCOPP === '167').length,
    '168': boletas.filter(b => b.articuloCOPP === '168').length,
    '169': boletas.filter(b => b.articuloCOPP === '169').length,
    '170': boletas.filter(b => b.articuloCOPP === '170').length,
    '171': boletas.filter(b => b.articuloCOPP === '171').length,
    '165': boletas.filter(b => b.articuloCOPP === '165').length,
    'S_165': boletas.filter(b => b.articuloCOPP === 'S_165').length,
  };

  // Conteo por Alguacil
  const alguacilesStats = React.useMemo(() => {
    const map: Record<string, { total: number; devueltas: number }> = {};
    boletas.forEach(b => {
      const alg = b.alguacilPractica || 'SIN ASIGNAR';
      if (!map[alg]) map[alg] = { total: 0, devueltas: 0 };
      map[alg].total++;
      if (b.devueltaAlTribunal) map[alg].devueltas++;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [boletas]);

  return (
    <div className="space-y-5">
      {/* Header de Estadísticas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Informe Estadístico Mensual de Boletas y Alguacilazgo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ruta {config.mesRutaActual} • {config.circuitoJudicial}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDescargarOficioGlobal}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Descargar Oficio Formal de Estadísticas Globales con Código QR para Presidencia"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>Oficio Global con QR (PDF)</span>
          </button>
          <button
            onClick={() => exportarBoletasExcel(boletas, config)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel</span>
          </button>
          <button
            onClick={() => exportarBoletasPDF(boletas, config)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {downloadingMsg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Clock className="w-4 h-4 animate-spin text-indigo-600" />
          <span>{downloadingMsg}</span>
        </div>
      )}

      {/* SECCIÓN INSTITUCIONAL: OFICIOS CON CÓDIGO QR */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-lg shadow-2xs border border-slate-800">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Unidad de Actos y Comunicación
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded">
                  Validación Oficial QR
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Emisión de Oficios Institucionales y Rendición de Cuentas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Certificación procesal por Artículos del COPP, efectividad de entrega y validación digital mediante Código QR
              </p>
            </div>
          </div>
          <span className="self-start sm:self-center text-[11px] px-3 py-1 bg-white border border-slate-200 text-slate-700 font-mono rounded-md shadow-2xs">
            Formato A4 • Membrete y Firmas
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/30">
          {/* OFICIO 1: GLOBAL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Presidencia del Circuito • Global
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  11 Tribunales
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                Oficio: Rendición de Estadísticas Globales por Artículos del COPP
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Documento rector consolidado dirigido a la Presidencia del Circuito Judicial Penal. Incluye la matriz de los 11 tribunales, tipificación legal de los 7 Artículos del COPP (167 al S 165), efectividad global porcentual, firmas del Alguacilazgo y <strong>Código QR de validación institucional</strong>.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={handleDescargarOficioGlobal}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Descargar Oficio Global COPP (PDF con QR)</span>
              </button>
            </div>
          </div>

          {/* OFICIO 2: POR TRIBUNAL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Por Despacho Judicial • Juez y Secretaría
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  Formato Ejecutivo
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                Oficio de Rendición por Tribunal (Artículos del COPP y QR)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Oficio formal individualizado para el Juez(a) y Secretario(a) del tribunal seleccionado. Certifica las diligencias asignadas y practicadas, matriz de los 7 Artículos del COPP, porcentaje de efectividad y firmas. <em>Formato ejecutivo oficial sin listado individual de boletas.</em>
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={selectedTribunalCodeForQR}
                  onChange={(e) => setSelectedTribunalCodeForQR(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                >
                  {tribunales.map((t) => (
                    <option key={t.codigo} value={t.codigo} className="text-slate-900">
                      {t.codigo} - {t.nombre}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleDescargarOficioTribunal()}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Oficio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Total Boletas</span>
            <span className="p-1 rounded-md bg-indigo-50 text-indigo-600 font-bold text-[10px]">Ruta Mes</span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{total}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total de órdenes diligenciadas</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">Efectividad de Entrega</span>
            <span className="p-1 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              {porcentajeEfectividad}%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{devueltas} <span className="text-sm font-semibold text-emerald-600">/ {total}</span></p>
          <p className="text-[11px] text-emerald-700 mt-1">{conAcuse} boletas con acuse registrado</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-100 bg-amber-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">En Trámite / Pendientes</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{pendientes}</p>
          <p className="text-[11px] text-amber-700 mt-1">Por devolver a los tribunales</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-100 bg-rose-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-rose-700 tracking-wider">Alertas Críticas</span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{criticas + urgentes}</p>
          <p className="text-[11px] text-rose-700 mt-1">{criticas} vencidas/hoy + {urgentes} en 48h</p>
        </div>
      </div>

      {/* Distribución por Artículos COPP y Tribunales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Distribución por Artículo COPP */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Distribución por Artículos del COPP
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Modalidades de Notificación</span>
          </div>

          <div className="space-y-3">
            {Object.entries(ARTICULOS_INFO).map(([key, info]) => {
              const count = countArticulos[key as keyof typeof countArticulos] || 0;
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${info.colorBg}`}></span>
                      <span className="text-slate-800">{info.nombre}</span>
                    </div>
                    <span className="text-slate-600 font-bold">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${info.colorBg}`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por Tribunal */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-600" />
              Carga de Trabajo por Tribunal
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">11 Despachos Judiciales</span>
          </div>

          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
            {tribunales.map((tri) => {
              const boletasTri = boletas.filter(b => b.tribunal.toUpperCase() === tri.codigo.toUpperCase());
              const count = boletasTri.length;
              const dev = boletasTri.filter(b => b.devueltaAlTribunal).length;
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={tri.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-black text-[10px]">
                      {tri.codigo}
                    </span>
                    <span className="font-semibold text-slate-800 truncate max-w-[160px] sm:max-w-[220px]">
                      {tri.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-emerald-700 font-bold text-[11px] hidden sm:inline">
                      {dev}/{count} Devueltas
                    </span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-extrabold rounded text-[10px]">
                      {count}
                    </span>
                    <button
                      onClick={() => handleDescargarOficioTribunal(tri)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[10px] transition-colors cursor-pointer shadow-2xs"
                      title={`Descargar Oficio de Rendición con QR para ${tri.codigo}`}
                    >
                      <QrCode className="w-3 h-3 text-amber-400" />
                      <span>Oficio QR</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rendimiento por Alguacil */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-600" />
            Rendimiento y Asignaciones por Alguacil
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Funcionarios de Citación</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {alguacilesStats.map(([nombre, stat]) => {
            const efectividad = stat.total > 0 ? Math.round((stat.devueltas / stat.total) * 100) : 0;

            return (
              <div key={nombre} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-900">{nombre}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    {stat.total} boletas
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between mb-1">
                  <span>Devueltas:</span>
                  <span className="font-bold text-emerald-700">{stat.devueltas} / {stat.total}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-1.5 rounded-full" 
                    style={{ width: `${efectividad}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-right font-semibold text-slate-500 mt-1">
                  {efectividad}% de efectividad
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
