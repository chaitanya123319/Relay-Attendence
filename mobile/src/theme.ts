/** Central design tokens — dark-friendly palette, consistent spacing. */
export const colors = {
  bg: '#0B1220',
  card: '#121C2F',
  cardAlt: '#0F1728',
  border: '#22304C',
  borderLight: '#2C3D61',
  text: '#E9EFFA',
  textDim: '#93A4C3',
  textFaint: '#5F7396',
  primary: '#4F8CFF',
  primaryDim: '#2E5FBF',
  primarySoft: '#18294A',
  success: '#3ECF8E',
  successSoft: '#0E2E23',
  warning: '#F5B94C',
  warningSoft: '#33270D',
  danger: '#F07071',
  dangerSoft: '#3A1618',
  info: '#7FB2FF',
  infoSoft: '#13233F',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const font = {
  title: 24,
  h2: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

/** Status → accent color used by chips across attendance & leave screens. */
export function statusColor(status: string): { fg: string; bg: string } {
  switch (status) {
    case 'PRESENT':
    case 'APPROVED':
      return { fg: colors.success, bg: colors.successSoft };
    case 'LATE':
    case 'HALF_DAY':
    case 'PENDING':
      return { fg: colors.warning, bg: colors.warningSoft };
    case 'INCOMPLETE':
    case 'REJECTED':
      return { fg: colors.danger, bg: colors.dangerSoft };
    case 'ON_LEAVE':
      return { fg: colors.info, bg: colors.infoSoft };
    case 'WEEKLY_OFF':
      return { fg: colors.textDim, bg: colors.cardAlt };
    case 'CANCELLED':
      return { fg: colors.textFaint, bg: colors.cardAlt };
    case 'ABSENT':
      return { fg: colors.danger, bg: colors.dangerSoft };
    default:
      return { fg: colors.textDim, bg: colors.cardAlt };
  }
}
