import {
  Alert, Box, Card, CardActionArea, CardContent, CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Typography,
} from '@mui/material'
import { formatNumber, toLabel } from './reportFormat'


const headCellSx = { fontWeight: 700, color: '#334155' }

/** Khung 1 khối báo cáo: tiêu đề, nút/bộ lọc bên phải, trạng thái tải và lỗi. */
export function ReportSection({ title, subtitle, action, loading, error, children }) {
  return (
    <Paper variant="outlined" sx={{ borderColor: '#d8dced', borderRadius: 1.5, mb: 2, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          borderBottom: '1px solid #eef0f6',
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#182238' }}>{title}</Typography>
          {subtitle && <Typography sx={{ color: '#697386', fontSize: 12 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      {error ? (
        <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
      ) : loading ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={26} />
        </Box>
      ) : (
        children
      )}
    </Paper>
  )
}

/** Ô số liệu (dùng cho Tổng quan và phần tóm tắt từng báo cáo). */
/** Ô số liệu; có onClick thì bấm được (dẫn tới danh sách chi tiết). */
export function StatTile({ label, value, icon, color = '#0865ce', valueColor = '#131b2e', hint, onClick }) {
  const content = (
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon && <Box sx={{ color, display: 'flex' }}>{icon}</Box>}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 21, color: valueColor }}>{value}</Typography>
        {hint && <Typography sx={{ color: '#697386', fontSize: 11 }}>{hint}</Typography>}
      </Box>
    </CardContent>
  )
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: '#d8dced',
        boxShadow: 'none',
        height: '100%',
        transition: 'border-color 0.15s',
        ...(onClick ? { '&:hover': { borderColor: color } } : {}),
      }}
    >
      {onClick ? <CardActionArea onClick={onClick} sx={{ height: '100%' }}>{content}</CardActionArea> : content}
    </Card>
  )
}

/**
 * Bảng báo cáo đơn giản.
 * columns: [{ key, label, align?, render?(row) }]
 * pagination (tùy chọn): { page (bắt đầu từ 1), size, totalCount, onPageChange(page) }
 * onRowClick (tùy chọn): bấm vào dòng để mở trang chi tiết
 */
export function ReportTable({ columns, rows, rowKey, emptyText = 'Không có dữ liệu.', pagination, onRowClick }) {
  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#faf9ff' }}>
              {columns.map((column) => (
                <TableCell key={column.key} align={column.align} sx={headCellSx}>{column.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={rowKey ? rowKey(row) : index}
                hover
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align}>
                    {column.render ? column.render(row) : row[column.key] ?? '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {pagination && (
        <TablePagination
          component="div"
          count={pagination.totalCount || 0}
          page={pagination.page - 1}
          onPageChange={(_, nextPage) => pagination.onPageChange(nextPage + 1)}
          rowsPerPage={pagination.size}
          rowsPerPageOptions={[pagination.size]}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      )}
    </>
  )
}

/** Danh sách nhóm { key, count | value } kèm thanh tỉ lệ (theo trạng thái, theo lab, theo loại...). */
export function GroupBars({ title, groups = [], valueKey = 'count', format = formatNumber, labelOf = toLabel }) {
  const max = Math.max(1, ...groups.map((group) => Number(group[valueKey] || 0)))
  return (
    <Box sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#334155', mb: 1 }}>{title}</Typography>
      {groups.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Không có dữ liệu.</Typography>}
      {groups.map((group) => (
        <Box key={group.key} sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
            <Typography sx={{ fontSize: 13, color: '#424754' }}>{labelOf(group.key)}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{format(group[valueKey])}</Typography>
          </Box>
          <Box sx={{ height: 6, bgcolor: '#eef0f6', borderRadius: 3 }}>
            <Box
              sx={{
                height: '100%',
                width: `${(Number(group[valueKey] || 0) / max) * 100}%`,
                bgcolor: '#0058be',
                borderRadius: 3,
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/**
 * Danh sách thanh ngang (giống ReportBar bên mobile): hạng (tùy chọn), nhãn, thanh dài theo value / max,
 * giá trị bên phải và chú thích nhỏ (tùy chọn).
 * items: [{ key, label, value, display?, caption? }]
 */
export function ReportBar({ title, items = [], ranked = false, format = formatNumber, emptyText = 'Không có dữ liệu.' }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value || 0)))
  return (
    <Box sx={{ p: 2 }}>
      {title && <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#334155', mb: 1 }}>{title}</Typography>}
      {items.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{emptyText}</Typography>}
      {items.map((item, index) => (
        <Box key={item.key} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', mb: 1.25 }}>
          {ranked && (
            <Box
              sx={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor: index === 0 ? '#0058be' : '#eef0f6',
                color: index === 0 ? '#fff' : '#424754',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {index + 1}
            </Box>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.3 }}>
              <Typography sx={{ fontSize: 13, color: '#424754' }} noWrap>{item.label}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{item.display ?? format(item.value)}</Typography>
            </Box>
            <Box sx={{ height: 6, bgcolor: '#eef0f6', borderRadius: 3 }}>
              <Box sx={{ height: '100%', width: `${(Number(item.value || 0) / max) * 100}%`, bgcolor: '#0058be', borderRadius: 3 }} />
            </Box>
            {item.caption && <Typography sx={{ color: '#697386', fontSize: 11, mt: 0.3 }}>{item.caption}</Typography>}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
