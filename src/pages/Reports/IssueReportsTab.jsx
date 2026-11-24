import { Grid } from '@mui/material'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { CHART_DANGER, formatDuration, formatNumber, toLabel } from './reportFormat'
import { ReportBar, ReportSection, StatTile } from './reportUi'
import { ShareDonut } from './reportCharts'

const TOP_COMPONENTS = 10

const toParts = (groups) => (groups || []).map((group) => ({ name: toLabel(group.key), value: group.count }))
const formatIssues = (value) => `${formatNumber(value)} sự cố`

/** Tab "Sự cố": thống kê báo cáo sự cố tạo trong kỳ (BE tự lọc theo quyền). */
export default function IssueReportsTab({ filters }) {
  const { fromDate, toDate } = filters
  const issues = useReport(() => reportService.getIssueSummary({ fromDate, toDate }), [fromDate, toDate])

  const data = issues.data
  const openCount = (data?.byStatus || []).find((group) => group.key === 'Open')?.count || 0

  return (
    <ReportSection title="Thống kê sự cố" subtitle="Sự cố tạo trong kỳ" loading={issues.loading} error={issues.error}>
      {data && (
        <>
          <Grid container spacing={2} sx={{ p: 2, pb: 0 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatTile label="Sự cố" value={formatNumber(data.totalIssues)} valueColor="#ef6c00" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatTile
                label="Chưa xử lý"
                value={formatNumber(openCount)}
                valueColor={openCount > 0 ? CHART_DANGER : '#2e7d32'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatTile
                label="Thời gian xử lý trung bình"
                value={formatDuration(data.averageResolveHours)}
                hint="Từ lúc báo đến lúc được xử lý, chỉ tính các sự cố đã xử lý trong kỳ."
              />
            </Grid>
          </Grid>
          <Grid container>
            <Grid size={{ xs: 12, md: 4 }}>
              <ShareDonut title="Theo trạng thái" parts={toParts(data.byStatus)} format={formatIssues} emptyText="Không có sự cố trong kỳ." />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ShareDonut title="Theo loại" parts={toParts(data.byType)} format={formatIssues} emptyText="Không có sự cố trong kỳ." />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReportBar
                title="Linh kiện nhiều sự cố nhất"
                ranked
                format={formatIssues}
                emptyText="Không có sự cố trong kỳ."
                items={(data.topComponents || []).slice(0, TOP_COMPONENTS).map((group) => ({
                  key: group.key,
                  label: group.key,
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
