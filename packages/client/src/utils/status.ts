export type StatusCategory = 'active' | 'warning' | 'inactive'

const normalize = (value: string | undefined) => value?.toLowerCase().trim() ?? ''

export const categorizeStatus = (status: string): StatusCategory => {
  const normalized = normalize(status)
  if (!normalized) {
    return 'warning'
  }
  if (normalized.includes('decay') || normalized.includes('de-orbit') || normalized.includes('fail')) {
    return 'inactive'
  }
  if (normalized.includes('drift') || normalized.includes('risk') || normalized.includes('command')) {
    return 'warning'
  }
  return 'active'
}

export const STATUS_META: Record<
  StatusCategory,
  {label: string; description: string; color: string; accent: string}
> = {
  active: {
    label: 'Active link',
    description: 'Operational or standby',
    color: '#22c55e',
    accent: '#064e3b'
  },
  warning: {
    label: 'Watch',
    description: 'Drift or pending maneuver',
    color: '#facc15',
    accent: '#713f12'
  },
  inactive: {
    label: 'Offline',
    description: 'Decay, de-orbit, or failed',
    color: '#fb7185',
    accent: '#7f1d1d'
  }
}
