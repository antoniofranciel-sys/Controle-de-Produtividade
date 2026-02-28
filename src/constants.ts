export interface Task {
  id: number;
  name: string;
  unitValue: number;
}

export const TASKS: Task[] = [
  { id: 1, name: "Despachos", unitValue: 0.5 },
  { id: 2, name: "Ata de Audiência", unitValue: 0.7 },
  { id: 3, name: "Decisão Recurso", unitValue: 0.4 },
  { id: 4, name: "Decisão", unitValue: 0.7 },
  { id: 5, name: "Sentença - IDPJ", unitValue: 1.4 },
  { id: 6, name: "Sentença com mérito", unitValue: 1.1 },
  { id: 7, name: "Sentença sem mérito", unitValue: 0.7 },
  { id: 8, name: "Sentença ED", unitValue: 0.7 },
  { id: 9, name: "Sentença EE / Impugnação à Sentença de Liquidação", unitValue: 1.4 },
  { id: 10, name: "Sentença", unitValue: 0.7 },
  { id: 11, name: "Sentença Parcial", unitValue: 0.7 },
  { id: 13, name: "Mandado", unitValue: 0.5 },
  { id: 14, name: "Intimação", unitValue: 0.2 },
  { id: 15, name: "Alvará", unitValue: 0.5 },
  { id: 16, name: "Carta Precatória", unitValue: 0.5 },
  { id: 17, name: "Edital", unitValue: 0.2 },
  { id: 18, name: "Notificação", unitValue: 0.2 },
  { id: 19, name: "Ofício", unitValue: 0.5 },
  { id: 20, name: "Precatório", unitValue: 0.7 },
  { id: 21, name: "RPV", unitValue: 0.5 },
  { id: 22, name: "Perícias - Requisição de Honorários", unitValue: 0.7 },
  { id: 23, name: "Certidão de Crédito", unitValue: 0.7 },
  { id: 24, name: "SISBAJUD", unitValue: 0.5 },
  { id: 26, name: "INFOJUD", unitValue: 0.7 },
  { id: 27, name: "INFOSEG", unitValue: 0.7 },
  { id: 28, name: "RENAJUD", unitValue: 0.4 },
  { id: 291, name: "Ferramenta - Outras (especificar no registro detalhado)", unitValue: 0.7 },
  { id: 292, name: "Planilha de Cálculos - Sentenças", unitValue: 1.8 },
  { id: 30, name: "Atualização de Cálculos", unitValue: 0.7 },
  { id: 31, name: "Planilha de Cálculos PjeCalc", unitValue: 1.8 },
  { id: 32, name: "Documentos diversos", unitValue: 0.1 },
  { id: 33, name: "Certidão", unitValue: 0.2 },
  { id: 37, name: "Mudança de fase", unitValue: 0.4 },
  { id: 38, name: "Arquivamento", unitValue: 0.4 },
  { id: 39, name: "Pagamentos", unitValue: 0.2 },
  { id: 40, name: "Sobrestamento/Dessobrestamento", unitValue: 0.2 },
  { id: 41, name: "BNDT", unitValue: 0.1 },
  { id: 42, name: "Mudança de classe processual", unitValue: 0.1 },
  { id: 43, name: "Audiência (marcação ou cancelamento)", unitValue: 0.1 },
  { id: 44, name: "Conclusão", unitValue: 0.1 },
  { id: 45, name: "Desarquivamento", unitValue: 0.1 },
  { id: 48, name: "Retificação", unitValue: 0.1 },
  { id: 49, name: "Escaninho (Baixa de petição)", unitValue: 0.1 },
];

export const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"
];

export const YEARS = [2026, 2027];
