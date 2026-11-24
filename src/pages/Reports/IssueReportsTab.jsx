import { Grid } from '@mui/material'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { CHART_DANGER, formatNumber, toLabel } from './reportFormat'
import { ReportBar, ReportSection, StatTile } from './reportUi'
import { ShareDonut } from './reportCharts'

const TOP_COMPONENTS = 10

const toParts = (groups) => (groups || []).map((group) => ({ name: toLabel(group.key), value: group.count }))
const formatIssues = (value) => `${formatNumber(value)} sự cố`

/** Tab "Sự cố": thống kê báo cáo sự cố tạo trong kỳ (BE tự lọc theo quyền). */
export default function IssueReportsTab({ filters }) {
  const { fromDate, toDate, roomId } = filters
  const issues = useReport(() => reportService.getIssueSummary({ fromDate, toDate, roomId }), [fromDate, toDate, roomId])

  const data = issues.data
  const countOf = (type) => (data?.byType || []).find((group) => group.key === type)?.count || 0

  return (
    <ReportSection title="Thống kê sự cố" subtitle="Sự cố ghi nhận trong kỳ, không tính sự cố bị từ chối hoặc hủy" loading={issues.loading} error={issues.error}>
      {data && (
        <>
          <Grid container spacing={2} sx={{ p: 2, pb: 0 }}>
            <Grid size={{ xs: 6, md: 3 }}><StatTile label="Tổng sự cố" value={formatNumber(data.totalIssues)} /></Grid>
            {['Damaged', 'Burnt', 'Lost'].map((type) => (
              <Grid key={type} size={{ xs: 6, md: 3 }}>
                <StatTile
                  label={toLabel(type)}
                  value={formatNumber(countOf(type))}
                  valueColor={countOf(type) > 0 ? CHART_DANGER : undefined}
                />
              </Grid>
            ))}
          </Grid>
          <Grid container>
            <Grid size={{ xs: 12, md: 6 }}>
              <ShareDonut title="Theo loại" parts={toParts(data.byType)} format={formatIssues} emptyText="Không có sự cố trong kỳ." />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportBar
                title="Linh kiện nhiều sự cố nhất"
                ranked
                format={formatIssues}
                emptyText="Không có sự cố trong kỳ."
                items={(data.topComponents || []).slice(0, TOP_COMPONENTS).map((group) => ({
                  key: group.key,
                  label: group.name || group.key,
                  caption: group.name ? group.key : undefined,
                  value: group.count,
                }))}
              />
            </Grid>
          </Grid>
        </>
      )}
    </ReportSection>
  )
}
