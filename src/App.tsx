import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  Calculator, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Save,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  Plus,
  Minus,
  Upload,
  User,
  Loader2,
  AlertCircle,
  FileText,
  Download
} from 'lucide-react';
import { TASKS, MONTHS, YEARS, Task } from './constants';

// Types
interface ProductivityData {
  [yearMonth: string]: {
    [taskId: number]: number;
  };
}

interface Settings {
  dailyEffortGoal: number;
  daysWorked: number;
  filterStart: { year: number; month: string };
  filterEnd: { year: number; month: string };
  isFilterActive: boolean;
  serverName: string;
}

const STORAGE_KEY = 'produtividade_data_v1';
const SETTINGS_KEY = 'produtividade_settings_v1';

// Holidays list (YYYY-MM-DD)
const HOLIDAYS = [
  '2026-02-16', '2026-02-17', '2026-02-18', // Carnival 2026
  '2026-01-01', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'
];

function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    const dateString = curDate.toISOString().split('T')[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = HOLIDAYS.includes(dateString);
    
    if (!isWeekend && !isHoliday) {
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

export default function App() {
  // State
  const [data, setData] = useState<ProductivityData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    
    // Initial data for Feb 2026 based on the PDF
    return {
      "2026-fev": {
        1: 11, 2: 1, 4: 16, 10: 13, 13: 1, 14: 24, 15: 1, 292: 38, 30: 26, 31: 24, 
        33: 39, 37: 23, 38: 10, 39: 27, 40: 114, 44: 41, 48: 3, 49: 41
      }
    };
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    
    // Calculate automatic days worked
    const start = new Date(2026, 1, 1); // Feb 1st, 2026 (Month is 0-indexed)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const autoDays = calculateBusinessDays(start, yesterday);

    const defaultSettings = { 
      dailyEffortGoal: 10.1, 
      daysWorked: autoDays,
      filterStart: { year: 2026, month: 'fev' },
      filterEnd: { year: 2026, month: 'dez' },
      isFilterActive: false,
      serverName: ''
    };
    
    if (!saved) return defaultSettings;
    const parsed = JSON.parse(saved);
    return { ...defaultSettings, ...parsed };
  });

  const [activeYear, setActiveYear] = useState(2026);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Gemini Setup
  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), []);

  // Helper to get month index
  const getMonthIdx = (m: string) => MONTHS.indexOf(m);
  const getPeriodValue = (year: number, month: string) => year * 12 + getMonthIdx(month);

  // Calculations
  const taskTotals = useMemo(() => {
    const totals: { [taskId: number]: number } = {};
    const startVal = getPeriodValue(settings.filterStart.year, settings.filterStart.month);
    const endVal = getPeriodValue(settings.filterEnd.year, settings.filterEnd.month);

    TASKS.forEach(task => {
      let sum = 0;
      Object.keys(data).forEach(key => {
        const [yearStr, monthStr] = key.split('-');
        const year = parseInt(yearStr);
        const currentVal = getPeriodValue(year, monthStr);

        if (!settings.isFilterActive || (currentVal >= startVal && currentVal <= endVal)) {
          sum += data[key][task.id] || 0;
        }
      });
      totals[task.id] = sum;
    });
    return totals;
  }, [data, settings.isFilterActive, settings.filterStart, settings.filterEnd]);

  const totalEffort = useMemo(() => {
    return (Object.values(taskTotals) as number[]).reduce((acc, val) => acc + val, 0);
  }, [taskTotals]);

  const totalPoints = useMemo(() => {
    return TASKS.reduce((acc, task) => {
      return acc + (taskTotals[task.id] * task.unitValue);
    }, 0);
  }, [taskTotals]);

  // Calculate yesterday's date for display
  const yesterdayDisplay = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('pt-BR');
  }, []);

  const targetPoints = settings.dailyEffortGoal * settings.daysWorked;
  const percentageReached = targetPoints > 0 ? (totalPoints / targetPoints) * 100 : 0;

  // Handlers
  const handleValueChange = (year: number, month: string, taskId: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const key = `${year}-${month}`;
    setData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [taskId]: numValue
      }
    }));
  };

  const handleReset = () => {
    setData({});
    setSettings(prev => ({ 
      ...prev, 
      serverName: '',
      isFilterActive: false 
    }));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    setShowResetConfirm(false);
  };

  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setTimeout(() => setIsSaving(false), 1000);
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Clear server name if no data exists
  useEffect(() => {
    const hasAnyData = Object.values(data).some(monthData => 
      Object.values(monthData).some(val => val > 0)
    );
    
    if (!hasAnyData && settings.serverName !== '') {
      setSettings(prev => ({ ...prev, serverName: '' }));
    }
  }, [data]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      let contents: any[] = [];
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.type === 'text/plain') {
        const text = await file.text();
        contents = [
          {
            parts: [
              { text: `Conteúdo do arquivo ${file.name}:\n\n${text}` },
              {
                text: `Analise o texto abaixo extraído de um arquivo e organize os dados de produtividade. 
                
                Informações a extrair:
                1. Nome do Servidor.
                2. Mês (sigla: ${MONTHS.join(', ')}) e Ano.
                3. Lista de atividades e quantidades.
                
                Mapeie as atividades para estes IDs:
                ${TASKS.map(t => `${t.id}: ${t.name}`).join('\n')}
                
                Retorne APENAS um JSON no formato:
                {"serverName": "...", "month": "...", "year": 2026, "data": {"ID": QTD}}`
              }
            ]
          }
        ];
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        contents = [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.type || "application/pdf",
                  data: base64Data
                }
              },
              {
                text: `Você é um assistente especializado em extrair dados de relatórios de produtividade jurídica (Relatório Sintético de Teletrabalho).
                
                INSTRUÇÕES DE EXTRAÇÃO:
                1. NOME DO SERVIDOR: Localizado no cabeçalho (ex: "Nome do Servidor: ANTONIO FRANCIEL DE ARAUJO").
                2. PERÍODO: Identifique o mês e ano (ex: "Data Inicial: 01/02/2026" indica Fevereiro de 2026). Use siglas: ${MONTHS.join(', ')}.
                3. TABELA DE ATIVIDADES: Extraia as tarefas e suas quantidades (Qtde).
                
                MAPEAMENTO OBRIGATÓRIO (Mapeie o nome do documento para o nosso ID):
                - "01-Despachos" -> ID 1
                - "02-Ata de Audiência" -> ID 2
                - "03-Decisão Recurso" -> ID 3
                - "04-Decisão" -> ID 4
                - "05-Sentença IDPJ" -> ID 5
                - "06-Sentença com mérito" -> ID 6
                - "07-Sentença sem mérito" -> ID 7
                - "08-Sentença ED" -> ID 8
                - "09-Sentença EE" -> ID 9
                - "11-Sentença" -> ID 10
                - "13-Mandado" -> ID 13
                - "14-Intimação" -> ID 14
                - "15-Alvará" -> ID 15
                - "16-Carta Precatória" -> ID 16
                - "17-Edital" -> ID 17
                - "18-Notificação" -> ID 18
                - "19-Ofício" -> ID 19
                - "20-Precatório" -> ID 20
                - "21-RPV" -> ID 21
                - "22-Perícias" -> ID 22
                - "23-Certidão Crédito" -> ID 23
                - "24-Sisbajud" -> ID 24
                - "26-INFOJUD" -> ID 26
                - "27-INFOSEG" -> ID 27
                - "28-RENAJUD" -> ID 28
                - "29-Planilha de Cálculos" -> ID 292
                - "30-Atualização de Cálculos" -> ID 30
                - "31-Planilha de Cálculos PjeCalc" -> ID 31
                - "32-Documento Diverso" -> ID 32
                - "33-Certidão" -> ID 33
                - "37-Mudança Fase" -> ID 37
                - "38-Arquivamento" -> ID 38
                - "39-Pagamentos" -> ID 39
                - "40-Sobrestament/Dessobestamento" -> ID 40
                - "41-BNDT" -> ID 41
                - "42-Mudança classe processual" -> ID 42
                - "43-Audiência" -> ID 43
                - "44-Conclusão" -> ID 44
                - "45-Desarquivamento" -> ID 45
                - "48-Retificação" -> ID 48
                - "49-Escaninho" -> ID 49
                
                FORMATO DE SAÍDA (JSON):
                {
                  "serverName": "Nome",
                  "month": "sigla",
                  "year": 2026,
                  "data": [
                    {"taskId": ID_NUMERICO, "quantity": QTD_NUMERICA}
                  ]
                }
                
                Atenção: Ignore tarefas com quantidade zero. Retorne APENAS o JSON.`
              }
            ]
          }
        ];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              serverName: { type: Type.STRING },
              month: { type: Type.STRING },
              year: { type: Type.NUMBER },
              data: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.NUMBER },
                    quantity: { type: Type.NUMBER }
                  },
                  required: ["taskId", "quantity"]
                }
              }
            },
            required: ["serverName", "month", "year", "data"]
          }
        }
      });

      console.log("Gemini Response:", response.text);
      
      let result;
      try {
        const cleanText = response.text.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanText);
      } catch (e) {
        console.error("Erro ao processar JSON:", e, response.text);
        throw new Error("O sistema não conseguiu processar a resposta do documento. Por favor, tente novamente ou use um arquivo mais legível.");
      }
      
      // Convert array back to object format
      const formattedData: { [key: string]: number } = {};
      if (Array.isArray(result.data)) {
        result.data.forEach((item: any) => {
          if (item.taskId && item.quantity > 0) {
            formattedData[item.taskId.toString()] = item.quantity;
          }
        });
      }

      // Robust month parsing
      let monthSigla = result.month ? result.month.toLowerCase().trim() : '';
      if (!MONTHS.includes(monthSigla)) {
        const fullMonths: { [key: string]: string } = {
          'janeiro': 'jan', 'fevereiro': 'fev', 'março': 'mar', 'abril': 'abr', 'maio': 'mai', 'junho': 'jun',
          'julho': 'jul', 'agosto': 'ago', 'setembro': 'set', 'outubro': 'out', 'novembro': 'nov', 'dezembro': 'dez'
        };
        monthSigla = fullMonths[monthSigla] || monthSigla;
      }

      if (!MONTHS.includes(monthSigla)) {
        throw new Error(`Mês não identificado no documento: ${result.month || 'Não encontrado'}. Verifique se o período está visível no arquivo.`);
      }

      const hasImportedData = Object.keys(formattedData).length > 0;
      if (!hasImportedData) {
        setImportError("Não conseguimos extrair dados de produtividade deste documento. Certifique-se de que o arquivo contém a lista de atividades e suas respectivas quantidades.");
        setIsImporting(false);
        return;
      }

      // Update productivity data
      const key = `${result.year || activeYear}-${monthSigla}`;
      
      setData(prev => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          ...formattedData
        }
      }));

      // Update server name and year
      setSettings(s => ({ ...s, serverName: result.serverName || s.serverName }));
      if (result.year) setActiveYear(result.year);
      
    } catch (error: any) {
      console.error("Erro ao importar documento:", error);
      setImportError(error.message || "Falha ao processar o documento. Verifique o formato e tente novamente.");
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const title = `Relatório de Produtividade - ${settings.serverName || 'Servidor não identificado'}`;
    const period = settings.isFilterActive 
      ? `Período: ${settings.filterStart.month.toUpperCase()}/${settings.filterStart.year} até ${settings.filterEnd.month.toUpperCase()}/${settings.filterEnd.year}`
      : `Relatório Geral - Ano ${activeYear}`;

    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(period, 14, 28);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 34);

    const relevantMonths = MONTHS.filter(month => {
      if (activeYear === 2026 && month === 'jan') return false;
      if (!settings.isFilterActive) return true;
      const startVal = getPeriodValue(settings.filterStart.year, settings.filterStart.month);
      const endVal = getPeriodValue(settings.filterEnd.year, settings.filterEnd.month);
      const currentVal = getPeriodValue(activeYear, month);
      return currentVal >= startVal && currentVal <= endVal;
    });

    const tableData = TASKS.map((task, idx) => {
      const row: any[] = [idx + 1, task.name];
      
      relevantMonths.forEach(month => {
        row.push(data[`${activeYear}-${month}`]?.[task.id] || 0);
      });

      row.push(taskTotals[task.id] || 0);
      row.push(task.unitValue.toFixed(1));
      row.push((taskTotals[task.id] * task.unitValue).toFixed(1));
      
      return row;
    });

    const headers = ['#', 'Atividade'];
    relevantMonths.forEach(m => headers.push(m.toUpperCase()));
    headers.push('Esforço', 'Vr Unit', 'Pontos');

    autoTable(doc, {
      startY: 40,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20] },
      styles: { fontSize: 8 },
      columnStyles: { 1: { cellWidth: 60 } }
    });

    // Add Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Resumo do Período:`, 14, finalY);
    doc.setFontSize(10);
    doc.text(`Esforço Total: ${totalEffort}`, 14, finalY + 7);
    doc.text(`Pontuação Alcançada: ${totalPoints.toFixed(1)}`, 14, finalY + 12);
    doc.text(`Meta de Pontos: ${targetPoints.toFixed(1)}`, 14, finalY + 17);
    doc.text(`Percentual Alcançado: ${percentageReached.toFixed(2)}%`, 14, finalY + 22);

    doc.save(`Relatorio_Produtividade_${settings.serverName || 'Servidor'}.pdf`);
  };

  const generateExcel = () => {
    const relevantMonths = MONTHS.filter(month => {
      if (activeYear === 2026 && month === 'jan') return false;
      if (!settings.isFilterActive) return true;
      const startVal = getPeriodValue(settings.filterStart.year, settings.filterStart.month);
      const endVal = getPeriodValue(settings.filterEnd.year, settings.filterEnd.month);
      const currentVal = getPeriodValue(activeYear, month);
      return currentVal >= startVal && currentVal <= endVal;
    });

    const worksheetData = TASKS.map((task, idx) => {
      const row: any = {
        '#': idx + 1,
        'Atividade': task.name
      };
      
      relevantMonths.forEach(month => {
        row[month.toUpperCase()] = data[`${activeYear}-${month}`]?.[task.id] || 0;
      });

      row['Esforço Realizado'] = taskTotals[task.id] || 0;
      row['Vr Unit Esforço'] = task.unitValue;
      row['Alcance Pontos'] = taskTotals[task.id] * task.unitValue;
      
      return row;
    });

    // Add summary row
    const summaryRow: any = {
      'Atividade': 'TOTAIS GERAIS',
      'Esforço Realizado': totalEffort,
      'Alcance Pontos': totalPoints
    };
    worksheetData.push(summaryRow);

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtividade");
    XLSX.writeFile(wb, `Relatorio_Produtividade_${settings.serverName || 'Servidor'}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 bg-[#E4E3E0] z-20">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-serif italic tracking-tight uppercase">Controle de Produtividade</h1>
          <div className="flex items-center gap-2">
            <User size={12} className="opacity-50" />
            <span className="text-[10px] font-mono uppercase opacity-50 whitespace-nowrap">Nome do Servidor;</span>
            <input 
              type="text"
              placeholder="NOME DO SERVIDOR"
              value={settings.serverName}
              onChange={(e) => setSettings(s => ({ ...s, serverName: e.target.value.toUpperCase() }))}
              className="text-xs font-mono bg-transparent border-b border-transparent hover:border-black/20 focus:border-[#141414] focus:outline-none w-64 transition-all"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 px-4 py-2 border border-[#141414] cursor-pointer hover:bg-black/5 transition-all relative h-[40px] w-full justify-center">
              {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="text-xs font-medium uppercase tracking-wider whitespace-nowrap">
                {isImporting ? 'Processando...' : 'Importar Documento'}
              </span>
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf,.csv,.ods,application/vnd.oasis.opendocument.spreadsheet"
                onChange={handleFileUpload}
                disabled={isImporting}
              />
            </label>

            <div className="flex items-center gap-3 px-3 py-1 border border-[#141414] bg-white h-[40px] w-full justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Relatório:</span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={generatePDF}
                  className="flex items-center gap-1 px-2 py-1 border border-black/10 hover:bg-black/5 transition-all"
                  title="Gerar Relatório PDF"
                >
                  <FileText size={12} />
                  <span className="text-[9px] font-bold uppercase">PDF</span>
                </button>
                <button 
                  onClick={generateExcel}
                  className="flex items-center gap-1 px-2 py-1 border border-black/10 hover:bg-black/5 transition-all"
                  title="Gerar Planilha Excel/Google"
                >
                  <FileSpreadsheet size={12} />
                  <span className="text-[9px] font-bold uppercase">PLAN</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {showResetConfirm ? (
              <div className="flex flex-col gap-1">
                <button 
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider h-[20px]"
                >
                  Confirmar Limpeza
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex items-center justify-center gap-2 px-2 py-1 border border-black/10 text-[10px] font-bold uppercase tracking-wider h-[20px]"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 transition-all h-[40px]"
                title="Limpar todos os dados da planilha"
              >
                <Trash2 size={18} />
                <span className="text-sm font-medium uppercase tracking-wider">Limpar Planilha</span>
              </button>
            )}
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] hover:bg-opacity-90 transition-all h-[40px]"
            >
              {isSaving ? <CheckCircle2 size={18} /> : <Save size={18} />}
              <span className="text-sm font-medium uppercase tracking-wider">{isSaving ? 'Salvo' : 'Salvar'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto">
        {/* Error Message */}
        <AnimatePresence>
          {importError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-red-50 border border-red-200 p-4 flex items-center gap-3 text-red-800">
                <AlertCircle size={18} />
                <p className="text-sm font-medium">{importError}</p>
                <button 
                  onClick={() => setImportError(null)}
                  className="ml-auto text-xs font-bold uppercase hover:underline"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#141414] p-5 flex flex-col justify-between group hover:bg-[#141414] hover:text-white transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase opacity-50">Esforço Total Realizado</span>
              <Calculator size={16} className="opacity-30" />
            </div>
            <div className="mt-4">
              <span className="text-4xl font-serif italic">{totalEffort}</span>
              <p className="text-xs mt-1 opacity-60">Soma de todas as unidades</p>
            </div>
          </div>

          <div className="bg-white border border-[#141414] p-5 flex flex-col justify-between group hover:bg-[#141414] hover:text-white transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase opacity-50">Pontuação Alcançada</span>
              <TrendingUp size={16} className="opacity-30" />
            </div>
            <div className="mt-4">
              <span className="text-4xl font-serif italic">{totalPoints.toFixed(1)}</span>
              <p className="text-xs mt-1 opacity-60">Pontos ponderados totais</p>
            </div>
          </div>

          <div className="bg-white border border-[#141414] p-5 flex flex-col justify-between group hover:bg-[#141414] hover:text-white transition-all duration-300">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase opacity-50">Meta de Pontuação</span>
              <CheckCircle2 size={16} className="opacity-30" />
            </div>
            <div className="mt-4">
              <span className="text-4xl font-serif italic">{targetPoints.toFixed(1)}</span>
              <p className="text-xs mt-1 opacity-60">Baseado em {settings.daysWorked} dias úteis</p>
            </div>
          </div>

          <div className={`border border-[#141414] p-5 flex flex-col justify-between transition-all duration-300 ${percentageReached >= 100 ? 'bg-emerald-50 text-emerald-900 border-emerald-900' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono uppercase opacity-50">Percentual Alcançado</span>
              <div className={`w-2 h-2 rounded-full ${percentageReached >= 100 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </div>
            <div className="mt-4">
              <span className="text-4xl font-serif italic">{percentageReached.toFixed(2)}%</span>
              <div className="w-full bg-black/10 h-1 mt-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentageReached, 100)}%` }}
                  className={`h-full ${percentageReached >= 100 ? 'bg-emerald-600' : 'bg-[#141414]'}`}
                />
              </div>
              <p className="text-[10px] mt-3 font-medium uppercase tracking-tight leading-tight">
                {percentageReached > 0 && (
                  percentageReached >= 130 ? (
                    <span className="text-emerald-700">Excelente desempenho, continue assim!!!!</span>
                  ) : percentageReached >= 100 ? (
                    <span className="text-emerald-700">Parabéns, meta alcançada!!!!!</span>
                  ) : percentageReached >= 85 ? (
                    <span className="text-amber-700">Só mais um pouco e você consegue seu objetivo</span>
                  ) : (
                    <span className="text-red-700">Você precisa melhorar a sua produção, vamos lá, você consegue!!!!</span>
                  )
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="bg-white border border-[#141414] mb-8 p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4 border-r border-black/10 pr-6">
            <div className="flex flex-col">
              <label className="text-[10px] font-mono uppercase opacity-50">Dias Trabalhados:</label>
              <span className="text-[9px] font-mono opacity-40 leading-tight">Contagem até {yesterdayDisplay}</span>
            </div>
            <div className="flex items-center border border-[#141414]">
              <button 
                onClick={() => setSettings(s => ({ ...s, daysWorked: Math.max(0, s.daysWorked - 1) }))}
                className="p-1 hover:bg-[#141414] hover:text-white transition-colors"
              >
                <Minus size={14} />
              </button>
              <input 
                type="number" 
                value={settings.daysWorked}
                onChange={(e) => setSettings(s => ({ ...s, daysWorked: parseInt(e.target.value) || 0 }))}
                className="w-12 text-center font-mono text-sm focus:outline-none"
              />
              <button 
                onClick={() => setSettings(s => ({ ...s, daysWorked: s.daysWorked + 1 }))}
                className="p-1 hover:bg-[#141414] hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 border-r border-black/10 pr-6">
            <label className="text-[10px] font-mono uppercase opacity-50">Meta Diária:</label>
            <input 
              type="number" 
              step="0.1"
              value={settings.dailyEffortGoal}
              onChange={(e) => setSettings(s => ({ ...s, dailyEffortGoal: parseFloat(e.target.value) || 0 }))}
              className="w-16 border border-[#141414] text-center font-mono text-sm p-1 focus:outline-none focus:bg-[#141414] focus:text-white transition-all"
            />
          </div>

          {/* Filter Section */}
          <div className="flex items-center gap-4 flex-grow">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSettings(s => ({ ...s, isFilterActive: !s.isFilterActive }))}
                className={`p-2 border border-[#141414] transition-all ${settings.isFilterActive ? 'bg-[#141414] text-white' : 'hover:bg-black/5'}`}
                title="Ativar Filtro de Período"
              >
                <Calendar size={16} />
              </button>
              <label className="text-[10px] font-mono uppercase opacity-50">Filtro de Período:</label>
            </div>

            <div className={`flex items-center gap-2 transition-opacity ${settings.isFilterActive ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <select 
                value={`${settings.filterStart.month}-${settings.filterStart.year}`}
                onChange={(e) => {
                  const [m, y] = e.target.value.split('-');
                  setSettings(s => ({ ...s, filterStart: { month: m, year: parseInt(y) } }));
                }}
                className="text-xs font-mono border border-[#141414] p-1 bg-transparent"
              >
                {YEARS.flatMap(y => MONTHS.map(m => (
                  <option key={`start-${y}-${m}`} value={`${m}-${y}`}>{m.toUpperCase()} {y}</option>
                )))}
              </select>
              <span className="text-[10px] font-mono opacity-50">ATÉ</span>
              <select 
                value={`${settings.filterEnd.month}-${settings.filterEnd.year}`}
                onChange={(e) => {
                  const [m, y] = e.target.value.split('-');
                  setSettings(s => ({ ...s, filterEnd: { month: m, year: parseInt(y) } }));
                }}
                className="text-xs font-mono border border-[#141414] p-1 bg-transparent"
              >
                {YEARS.flatMap(y => MONTHS.map(m => (
                  <option key={`end-${y}-${m}`} value={`${m}-${y}`}>{m.toUpperCase()} {y}</option>
                )))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <label className="text-[10px] font-mono uppercase opacity-50">Visualizar Ano:</label>
            <div className="flex border border-[#141414]">
              {YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => setActiveYear(year)}
                  className={`px-4 py-1 text-xs font-mono uppercase transition-all ${activeYear === year ? 'bg-[#141414] text-white' : 'hover:bg-black/5'}`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Spreadsheet Table */}
        <div className="bg-white border border-[#141414] overflow-x-auto shadow-2xl">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-[#141414] bg-black/5">
                <th className="p-4 text-left border-r border-[#141414] sticky left-0 bg-[#f9f9f9] z-10 w-[300px]">
                  <span className="text-[10px] font-mono uppercase opacity-50">Atividade / Controle de Produtividade</span>
                </th>
                {MONTHS.map(month => {
                  // Skip Jan 2026
                  if (activeYear === 2026 && month === 'jan') return null;

                  const isFiltered = settings.isFilterActive && 
                    (getPeriodValue(activeYear, month) < getPeriodValue(settings.filterStart.year, settings.filterStart.month) || 
                     getPeriodValue(activeYear, month) > getPeriodValue(settings.filterEnd.year, settings.filterEnd.month));
                  
                  return (
                    <th key={month} className={`p-2 text-center border-r border-[#141414] min-w-[60px] transition-opacity ${isFiltered ? 'opacity-20' : 'opacity-100'}`}>
                      <span className="text-[10px] font-mono uppercase">{month}</span>
                    </th>
                  );
                })}
                <th className="p-4 text-center border-r border-[#141414] bg-black/10">
                  <span className="text-[10px] font-mono uppercase">Esforço Realizado</span>
                </th>
                <th className="p-4 text-center border-r border-[#141414]">
                  <span className="text-[10px] font-mono uppercase">Vr Unit Esforço</span>
                </th>
                <th className="p-4 text-center bg-[#141414] text-white">
                  <span className="text-[10px] font-mono uppercase">Alcance Pontos</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {TASKS.map((task, idx) => (
                <tr key={task.id} className="border-b border-[#141414] hover:bg-black/[0.02] transition-colors group">
                  <td className="p-3 border-r border-[#141414] sticky left-0 bg-white group-hover:bg-[#f9f9f9] z-10">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono opacity-30 w-4">{idx + 1}</span>
                      <span className="text-sm font-medium">{task.name}</span>
                    </div>
                  </td>
                  {MONTHS.map(month => {
                    // Skip Jan 2026
                    if (activeYear === 2026 && month === 'jan') return null;

                    const isFiltered = settings.isFilterActive && 
                      (getPeriodValue(activeYear, month) < getPeriodValue(settings.filterStart.year, settings.filterStart.month) || 
                       getPeriodValue(activeYear, month) > getPeriodValue(settings.filterEnd.year, settings.filterEnd.month));

                    return (
                      <td key={month} className={`p-1 border-r border-[#141414] transition-opacity ${isFiltered ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                        <input 
                          type="text"
                          inputMode="numeric"
                          disabled={isFiltered}
                          value={data[`${activeYear}-${month}`]?.[task.id] || ''}
                          onChange={(e) => handleValueChange(activeYear, month, task.id, e.target.value)}
                          className="w-full text-center font-mono text-sm p-1 focus:outline-none focus:bg-[#141414] focus:text-white transition-all disabled:cursor-not-allowed"
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                  <td className="p-3 text-center border-r border-[#141414] font-mono text-sm bg-black/[0.03]">
                    {taskTotals[task.id] || 0}
                  </td>
                  <td className="p-3 text-center border-r border-[#141414] font-mono text-sm opacity-60">
                    {task.unitValue.toFixed(1)}
                  </td>
                  <td className="p-3 text-center font-mono text-sm font-bold bg-black/[0.05]">
                    {(taskTotals[task.id] * task.unitValue).toFixed(1)}
                  </td>
                </tr>
              ))}
              {/* Footer Total Row */}
              <tr className="bg-[#141414] text-white">
                <td className="p-4 border-r border-white/20 sticky left-0 bg-[#141414] z-10">
                  <span className="text-xs font-mono uppercase tracking-widest">Totais Gerais</span>
                </td>
                {MONTHS.map(month => {
                  // Skip Jan 2026
                  if (activeYear === 2026 && month === 'jan') return null;

                  const monthTotal = TASKS.reduce((acc, task) => acc + (data[`${activeYear}-${month}`]?.[task.id] || 0), 0);
                  const isFiltered = settings.isFilterActive && 
                    (getPeriodValue(activeYear, month) < getPeriodValue(settings.filterStart.year, settings.filterStart.month) || 
                     getPeriodValue(activeYear, month) > getPeriodValue(settings.filterEnd.year, settings.filterEnd.month));
                  
                  return (
                    <td key={month} className={`p-2 text-center border-r border-white/20 font-mono text-xs transition-opacity ${isFiltered ? 'opacity-20' : 'opacity-100'}`}>
                      {monthTotal}
                    </td>
                  );
                })}
                <td className="p-4 text-center border-r border-white/20 font-mono text-lg italic">
                  {totalEffort}
                </td>
                <td className="p-4 border-r border-white/20"></td>
                <td className="p-4 text-center font-mono text-lg italic bg-white text-[#141414]">
                  {totalPoints.toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <footer className="mt-12 border-t border-[#141414] pt-8 flex flex-col md:flex-row justify-between gap-8 opacity-60">
          <div className="max-w-md">
            <h4 className="text-xs font-mono uppercase mb-2">Sobre este Sistema</h4>
            <p className="text-sm leading-relaxed">
              Este controle de produtividade foi desenvolvido para automatizar o registro de atividades e o cálculo de metas. 
              Os dados são salvos localmente no seu navegador.
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet size={16} />
              <span className="text-xs font-mono uppercase">Exportação Disponível</span>
            </div>
            <p className="text-[10px] font-mono">VERSÃO 1.0.0 • {new Date().getFullYear()}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
