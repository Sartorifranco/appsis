import { RenovacionesWidget } from '@/components/RenovacionesWidget'
import { TicketsWidget } from '@/components/TicketsWidget'
import { NetworkDashboard } from '@/modules/Infra/NetworkDashboard'

export function DashboardPage() {
  return (
    <div>
      {/* ── Topología de red Omada (sección principal) ── */}
      <NetworkDashboard />

      {/* ── Widgets de alertas y tickets ── */}
      <div className="grid gap-6 px-6 pb-6 lg:grid-cols-2">
        <RenovacionesWidget alertDays={5} />
        <TicketsWidget />
      </div>
    </div>
  )
}
