import { colors } from './theme';

export type CategoryKey =
  | 'Alimentación' | 'Transporte' | 'Vivienda' | 'Servicios'
  | 'Salud' | 'Entretenimiento' | 'Ropa' | 'Educación' | 'Otros';

export const CATEGORIES: CategoryKey[] = [
  'Alimentación', 'Transporte', 'Vivienda', 'Servicios',
  'Salud', 'Entretenimiento', 'Ropa', 'Educación', 'Otros',
];

// Icons are from @expo/vector-icons MaterialCommunityIcons
export const CATEGORY_META: Record<CategoryKey, { icon: string; color: string }> = {
  'Alimentación': { icon: 'food-apple', color: '#BC4749' },
  'Transporte': { icon: 'car', color: '#5B7DB1' },
  'Vivienda': { icon: 'home-variant', color: '#386641' },
  'Servicios': { icon: 'water', color: '#3D8BFD' },
  'Salud': { icon: 'medical-bag', color: '#E07A5F' },
  'Entretenimiento': { icon: 'gamepad-variant', color: '#9B5DE5' },
  'Ropa': { icon: 'hanger', color: '#D4A373' },
  'Educación': { icon: 'school', color: '#0096C7' },
  'Otros': { icon: 'dots-horizontal', color: '#6B705C' },
};

export const ACCOUNTS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Ahorros'];

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  return `${sign}$${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${names[m - 1]} ${y}`;
}

export function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[m - 1]} ${y}`;
}
