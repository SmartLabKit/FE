import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'

/**
 * Linh kiện AI đếm được trong ảnh giao linh kiện, so với đơn. Chỉ để nhắc: không khớp vẫn giao được.
 * detail là aiDetail của ảnh; ảnh cũ không có danh sách linh kiện thì không hiện.
 */
export default function PhotoComponentsCheck({ detail }) {
  const components = detail?.components || []
  if (components.length === 0) return null
  if (!detail.aiAvailable) return <Alert severity="info">AI chưa đếm được linh kiện, vui lòng tự kiểm tra.</Alert>

  const others = detail.otherComponents || []
  const wrong = components.filter((item) => !item.matches).length
  const allGood = wrong === 0 && others.length === 0

  return (
    <Box>
      <Alert severity={allGood ? 'success' : 'warning'} sx={{ mb: 1 }}>
        {allGood
          ? 'AI thấy đủ linh kiện trong ảnh.'
          : 'AI thấy linh kiện trong ảnh chưa khớp đơn. Kiểm tra lại, đúng thì vẫn giao được.'}
      </Alert>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Linh kiện</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700 }}>Cần giao</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700 }}>AI thấy</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {components.map((item) => (
            <TableRow key={item.componentCode}>
              <TableCell>{item.componentName}</TableCell>
              <TableCell align="center">{item.expected} {item.unit}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: item.matches ? '#059669' : '#b45309' }}>
                {item.trackingType === 'CONSUMABLE' ? (item.seen > 0 ? 'Có' : 'Không thấy') : item.seen}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {others.length > 0 && (
        <Typography variant="body2" sx={{ mt: 1, color: '#b45309' }}>
          Không có trong đơn: {others.join(', ')}
        </Typography>
      )}
    </Box>
  )
}
