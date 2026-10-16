export interface ChemElement {
  ar: string;
  en: string;
  symbol: string;
}

export const ELEMENTS: ChemElement[] = [
  { ar: 'الهيدروجين', en: 'Hydrogen', symbol: 'H' },
  { ar: 'الأكسجين', en: 'Oxygen', symbol: 'O' },
  { ar: 'الكربون', en: 'Carbon', symbol: 'C' },
  { ar: 'الصوديوم', en: 'Sodium', symbol: 'Na' },
  { ar: 'الكلور', en: 'Chlorine', symbol: 'Cl' },
  { ar: 'الحديد', en: 'Iron', symbol: 'Fe' },
  { ar: 'البوتاسيوم', en: 'Potassium', symbol: 'K' },
  { ar: 'النيتروجين', en: 'Nitrogen', symbol: 'N' },
  { ar: 'الكالسيوم', en: 'Calcium', symbol: 'Ca' },
  { ar: 'الذهب', en: 'Gold', symbol: 'Au' },
];
