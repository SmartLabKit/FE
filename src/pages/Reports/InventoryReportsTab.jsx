import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Chip, Grid, MenuItem, TextField } from '@mui/material'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { formatDate, formatMoney, formatNumber, getRows, stockCardPath, toLabel } from './reportFormat'
import { ReportBar, ReportSection, ReportTable, StatTile } from './reportUi'
import { ShareDonut } from './reportCharts'
import { locationLabel } from '../../utils/locationLabel'

const PAGE_SIZE = 10
const MAX_ROOMS = 10

const STOCK_FILTERS = [
  { value: 'Stocked', label: 'Từng có trong kho' },
  { value: 'OutOfStock', label: 'Hết hàng' },
  { value: 'LowStock', label: 'Sắp hết' },
  { value: 'All', label: 'Mọi linh kiện' },
]

function stockChip(row) {
  if (!row.isStocked) return <Chip size="small" variant="outlined" label="Chưa nhập" />
  if (row.available === 0 && row.borrowed > 0) return <Chip size="small" color="info" label="Cho mượn hết" />
  if (row.available === 0) return <Chip size="small" color="error" label="Hết hàng" />
  if (row.isLowStock) return <Chip size="small" color="warning" label="Sắp hết" />
  return <Chip size="small" color="success" label="Còn hàng" />
}

function warrantyChip(daysLeft) {
  const label = daysLeft <= 0 ? 'hôm nay' : `${daysLeft} ngày`
  const color = daysLeft <= 7 ? 'error' : daysLeft <= 30 ? 'warning' : 'default'
  return <Chip size="small" color={color} label={label} />
}

const componentCell = (row) => (
  <>
    <b>{row.componentName}</b>
    <br />
    <Box component="span" sx={{ color: '#0058be', fontSize: 12 }}>{row.componentCode}</Box>
  </>
)

/** Tab "Tồn kho": tồn theo linh kiện, sắp hết, sắp hết bảo hành, giá trị kho (chỉ role xem được tiền). */
export default function InventoryReportsTab({ filters, canSeeMoney }) {
  const { roomId } = filters
  const navigate = useNavigate()
  const openStockCard = (row) => navigate(stockCardPath(row.componentId))

  const [searchParams, setSearchParams] = useSearchParams()
  const status = STOCK_FILTERS.some((item) => item.value === searchParams.get('status')) ? searchParams.get('status') : 'Stocked'
  const [search, setSearch] = useState('')
  const [summaryPage, setSummaryPage] = useState(1)
  const summary = useReport(
    () => reportService.getStockSummary({ roomId, search: search.trim() || undefined, status: status === 'All' ? undefined : status, page: summaryPage, size: PAGE_SIZE }),
    [roomId, search, status, summaryPage],
  )

  const [lowSearch, setLowSearch] = useState('')
  const [lowPage, setLowPage] = useState(1)
  const lowStock = useReport(
    () => reportService.getLowStock({ roomId, search: lowSearch.trim() || undefined, page: lowPage, size: PAGE_SIZE }),
    [roomId, lowSearch, lowPage],
  )

  const [warrantyDays, setWarrantyDays] = useState(30)
  const [warrantyPage, setWarrantyPage] = useState(1)
  const warranty = useReport(
    () => reportService.getWarrantyExpiring({ days: warrantyDays, roomId, page: warrantyPage, size: PAGE_SIZE }),
    [warrantyDays, roomId, warrantyPage],
  )

  const stockValue = useReport(() => reportService.getStockValue({ roomId }), [roomId], canSeeMoney)
  const roomValues = [...(stockValue.data?.byRoom || [])]
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, MAX_ROOMS)

  const [prevRoomId, setPrevRoomId] = useState(roomId)
  if (prevRoomId !== roomId) {
    setPrevRoomId(roomId)
    setSummaryPage(1)
    setLowPage(1)
    setWarrantyPage(1)
  }

  return (
    <>
      {canSeeMoney && (
        <ReportSection title="Giá trị tồn kho" subtitle="Thiết bị theo giá mua, vật tư tiêu hao theo giá nhập gần nhất" loading={stockValue.loading} error={stockValue.error}>
          {stockValue.data && (
            <>
              <Grid container spacing={2} sx={{ p: 2, pb: 0 }}>
                <Grid size={{ xs: 12, sm: 4 }}><StatTile label="Tổng giá trị" value={formatMoney(stockValue.data.totalValue)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><StatTile label="Thiết bị (trong kho và đang mượn)" value={formatMoney(stockValue.data.unitValue)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatTile
                    label="Vật tư tiêu hao"
                    value={formatMoney(stockValue.data.consumableValue)}
                    hint={stockValue.data.unpricedComponents > 0 ? `${stockValue.data.unpricedComponents} vật tư chưa có giá nhập, chưa tính` : undefined}
                  />
                </Grid>
              </Grid>
              <Grid container>
                <Grid size={{ xs: 12, md: 6 }}>
                  <ShareDonut
                    title="Tỉ lệ giá trị theo danh mục"
                    parts={(stockValue.data.byCategory || []).map((group) => ({ name: group.key, value: Number(group.value || 0) }))}
                    format={formatMoney}
                    emptyText="Kho chưa có giá trị."
                  />
                </Grid>
                {!roomId && <Grid size={{ xs: 12, md: 6 }}>
                  <ReportBar
                    title="Giá trị tại từng lab"
                    format={formatMoney}
                    emptyText="Không lab nào có hàng."
                    items={roomValues.map((group) => ({ key: group.key, label: group.key, value: Number(group.value || 0) }))}
                  />
                </Grid>}
              </Grid>
            </>
          )}
        </ReportSection>
      )}

      <ReportSection
        title="Tồn kho theo linh kiện"
        subtitle="Sẵn sàng, đang mượn, mất / thanh lý"
        loading={summary.loading}
        error={summary.error}
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              size="small"
              label="Hiện"
              value={status}
              onChange={(event) => {
                setSearchParams({ tab: 'inventory', status: event.target.value }, { replace: true })
                setSummaryPage(1)
              }}
              sx={{ minWidth: 180 }}
            >
              {STOCK_FILTERS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
            </TextField>
            <TextField
              size="small"
              placeholder="Tìm tên, mã linh kiện..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setSummaryPage(1)
              }}
              sx={{ minWidth: 220 }}
            />
          </Box>
        }
      >
        <ReportTable
          rows={getRows(summary.data)}
          rowKey={(row) => row.componentId}
          onRowClick={openStockCard}
          emptyText="Không có linh kiện nào."
          columns={[
            { key: 'componentName', label: 'Linh kiện', render: componentCell },
            { key: 'categoryName', label: 'Danh mục' },
            { key: 'trackingType', label: 'Loại quản lý', render: (row) => <TrackingTypeBadge type={row.trackingType} /> },
            { key: 'available', label: 'Sẵn sàng', align: 'right', render: (row) => `${formatNumber(row.available)} ${row.unit || ''}` },
            { key: 'borrowed', label: 'Đang mượn', align: 'right', render: (row) => formatNumber(row.borrowed) },
            { key: 'lostOrRetired', label: 'Mất / thanh lý', align: 'right', render: (row) => formatNumber(row.lostOrRetired) },
            { key: 'isLowStock', label: 'Trạng thái', render: stockChip },
          ]}
          pagination={{ page: summaryPage, size: PAGE_SIZE, totalCount: summary.data?.totalCount, onPageChange: setSummaryPage }}
        />
      </ReportSection>

      <ReportSection
        title="Linh kiện sắp hết"
        subtitle="Tồn và đang mượn ở mọi lab cộng lại thấp hơn mức tối thiểu, thiếu nhiều nhất trước"
        loading={lowStock.loading}
        error={lowStock.error}
        action={
          <TextField
            size="small"
            placeholder="Tìm tên, mã linh kiện..."
            value={lowSearch}
            onChange={(event) => {
              setLowSearch(event.target.value)
              setLowPage(1)
            }}
            sx={{ minWidth: 220 }}
          />
        }
      >
        <ReportTable
          rows={getRows(lowStock.data)}
          rowKey={(row) => row.componentId}
          onRowClick={openStockCard}
          emptyText="Không có linh kiện nào dưới mức tối thiểu."
          columns={[
            { key: 'componentName', label: 'Linh kiện', render: componentCell },
            { key: 'categoryName', label: 'Danh mục' },
            { key: 'available', label: roomId || !canSeeMoney ? 'Còn tại lab' : 'Còn trong tủ', align: 'right', render: (row) => `${formatNumber(row.available)} ${row.unit || ''}` },
            { key: 'systemQuantity', label: 'Mọi lab (cả đang mượn)', align: 'right', render: (row) => formatNumber(row.systemQuantity) },
            { key: 'minStock', label: 'Tối thiểu', align: 'right', render: (row) => formatNumber(row.minStock) },
            { key: 'shortage', label: 'Cần mua thêm', align: 'right', render: (row) => <Chip size="small" color="warning" label={formatNumber(row.shortage)} /> },
            ...(canSeeMoney ? [{ key: 'lastUnitPrice', label: 'Giá nhập gần nhất', align: 'right', render: (row) => (row.lastUnitPrice == null ? '—' : formatMoney(row.lastUnitPrice)) }] : []),
          ]}
          pagination={{ page: lowPage, size: PAGE_SIZE, totalCount: lowStock.data?.totalCount, onPageChange: setLowPage }}
        />
      </ReportSection>

      <ReportSection
        title="Sắp hết bảo hành"
        subtitle="Thiết bị giá trị cao, hết hạn sớm nhất trước"
        loading={warranty.loading}
        error={warranty.error}
        action={
          <TextField
            select
            size="small"
            label="Trong vòng"
            value={warrantyDays}
            onChange={(event) => {
              setWarrantyDays(event.target.value)
              setWarrantyPage(1)
            }}
            sx={{ minWidth: 140 }}
          >
            {[7, 30, 60, 90, 180].map((days) => <MenuItem key={days} value={days}>{days} ngày</MenuItem>)}
          </TextField>
        }
      >
        <ReportTable
          rows={getRows(warranty.data)}
          rowKey={(row) => row.itemId}
          emptyText="Không có thiết bị sắp hết bảo hành."
          columns={[
            { key: 'itemCode', label: 'Mã thiết bị', render: (row) => <Box component="span" sx={{ color: '#0058be', fontWeight: 600 }}>{row.itemCode}</Box> },
            { key: 'serialNumber', label: 'Serial' },
            { key: 'componentName', label: 'Linh kiện', render: componentCell },
            { key: 'location', label: 'Vị trí', render: (row) => locationLabel(row.roomCode, row.cabinetCode) },
            { key: 'status', label: 'Trạng thái', render: (row) => toLabel(row.status) },
            { key: 'warrantyExpiresAt', label: 'Hết bảo hành', render: (row) => formatDate(row.warrantyExpiresAt) },
            { key: 'daysLeft', label: 'Còn lại', align: 'right', render: (row) => warrantyChip(row.daysLeft) },
          ]}
          pagination={{ page: warrantyPage, size: PAGE_SIZE, totalCount: warranty.data?.totalCount, onPageChange: setWarrantyPage }}
        />
      </ReportSection>
    </>
  )
}
