import { useState } from 'react'
import { Box, Dialog, IconButton, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { formatVietnamDateTime } from '../../utils/dateFormatting'

const GROUPS = [
  { type: 'Issue', title: 'Ảnh lúc giao linh kiện' },
  { type: 'Return', title: 'Ảnh lúc trả linh kiện' },
]

/**
 * Ảnh nhân viên lab chụp lúc giao (linh kiện kèm thẻ sinh viên) và lúc nhận trả. Bấm ảnh để xem lớn.
 * Không có ảnh nào thì không hiện gì. Có onRemove thì ảnh canRemove(photo) = true có nút ✕ ở góc để gỡ.
 */
export default function HandoverPhotos({ photos, sx, canRemove, onRemove }) {
  const [removingId, setRemovingId] = useState('')
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
                <Box key={photo.photoId} sx={{ position: 'relative' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setViewing(photo)}
                  sx={{ p: 0, width: '100%', border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#f8fafc', cursor: 'zoom-in', textAlign: 'left' }}
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
                {onRemove && canRemove?.(photo) && (
                  <IconButton
                    size="small"
                    aria-label="Gỡ ảnh"
                    title="Gỡ ảnh"
                    disabled={removingId === photo.photoId}
                    onClick={async () => {
                      setRemovingId(photo.photoId)
                      try {
                        await onRemove(photo)
                      } finally {
                        setRemovingId('')
                      }
                    }}
                    sx={{ position: 'absolute', top: 4, right: 4, p: 0.25, bgcolor: 'rgba(15,23,42,0.6)', color: '#fff', '&:hover': { bgcolor: 'rgba(15,23,42,0.8)' } }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
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
