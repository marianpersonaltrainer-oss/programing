import { evoBrand } from '../constants/evoBrand.js'

/**
 * Mi Camino visual extension.
 * Keeps the official EVO palette and adds a single approved warm achievement accent
 * for badges/milestones. Operational screens should remain mostly neutral/lilac.
 */
export const miCaminoTheme = {
  ...evoBrand,
  background: '#FBF8F7',
  surface: '#FFFFFF',
  surfaceLilac: '#F8F2FA',
  surfaceWarm: '#FFFCEB',
  ink: '#241126',
  inkSoft: '#645765',
  line: '#E9E0EA',
  purple: '#6A1F6D',
  purpleBright: '#A729AD',
  purpleSoft: '#EEE0F2',
  achievementGold: '#B88A3B',
  achievementGoldSoft: '#F4EAD7',
  danger: '#A43C52',
  warning: '#9A6D1A',
  success: '#3D7555',
}

export const miCaminoShadow = '0 12px 36px rgba(58, 30, 59, 0.08)'
