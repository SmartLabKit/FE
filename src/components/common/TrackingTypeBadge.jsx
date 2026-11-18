import { Chip } from '@mui/material'

const TYPE_STYLES = {
  CONSUMABLE: { borderColor: '#fdba74', color: '#ea580c' },
  REUSABLE: { borderColor: '#93c5fd', color: '#2563eb' },
  HIGH_VALUE: { borderColor: '#d8b4fe', color: '#9333ea' },
}

export default function TrackingTypeBadge({ type }) {
  const normalizedType = String(type || '').trim().toUpperCase()
  const label = normalizedType || '—'

  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      sx={{
        height: 22,
        px: 1.25,
        borderRadius: '9999px',
        bgcolor: '#fff',
        borderColor: TYPE_STYLES[normalizedType]?.borderColor || '#cbd5e1',
        color: TYPE_STYLES[normalizedType]?.color || '#64748b',
        fontSize: 12,
        fontWeight: 500,
        '& .MuiChip-label': { px: 0 },
      }}
    />
  )
}
