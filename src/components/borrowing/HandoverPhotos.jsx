import { useState } from 'react'
import { Box, Dialog, IconButton, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { formatVietnamDateTime } from '../../utils/dateFormatting'

const GROUPS = [
  { type: 'Issue', title: 'Ảnh lúc giao đồ' },
  { type: 'Return', title: 'Ảnh lúc trả đồ' },
]

/**
 * Ảnh nhân viên lab chụp lúc giao (linh kiện kèm thẻ sinh viên) và lúc nhận trả. Bấm ảnh để xem lớn.
 * Không có ảnh nào thì không hiện gì.
 */
export default function HandoverPhotos({ photos, sx }) {
  const [viewing, setViewing] = useState(null)
  const list = Array.isArray(photos) ? photos : []
  if (list.length === 0) return null

  return (
    <Box sx={sx}>
      {GROUPS.map((group) => {
        const shown = list.filter((photo) => photo.photoType === group.type)
        if (shown.length === 0) return null
        return (
          <Box key={group.type} sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{group.title}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.25 }}>
              {shown.map((photo) => (
                <Box
                  key={photo.photoId}
                  component="button"
                  type="button"
                  onClick={() => setViewing(photo)}
                  sx={{ p: 0, border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#f8fafc', cursor: 'zoom-in', textAlign: 'left' }}
                >
                  <Box
                    component="img"
                    src={photo.photoUrl}
                    alt={group.title}
                    loading="lazy"
                    sx={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                  />
                  <Typography sx={{ fontSize: 11, color: '#64748b', px: 1, py: 0.5 }}>
                    {formatVietnamDateTime(photo.takenAt)}
                    {photo.takenByName && ` · ${photo.takenByName}`}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )
      })}

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} maxWidth="md">
        <Box sx={{ position: 'relative', bgcolor: '#0f172a' }}>
          <IconButton
            aria-label="Đóng"
            onClick={() => setViewing(null)}
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)' }}
          >
            <CloseIcon />
          </IconButton>
          {viewing && (
            <Box component="img" src={viewing.photoUrl} alt="Ảnh giao nhận" sx={{ display: 'block', maxWidth: '100%', maxHeight: '85vh', mx: 'auto' }} />
          )}
        </Box>
      </Dialog>
    </Box>
  )
}
