import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Camera,
  FileText,
  CreditCard,
  Ticket,
  Key,
  Users,
  ChevronLeft,
  ChevronRight,
  Activity,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard Infra (Omada)' },
  { to: '/camaras', icon: Camera, label: 'Cámaras & NVR' },
  { to: '/docs', icon: FileText, label: 'Documentación' },
  { to: '/gastos', icon: CreditCard, label: 'Gestión de Gastos' },
  { to: '/tickets', icon: Ticket, label: 'Sistema de Tickets' },
  { to: '/credenciales', icon: Key, label: 'Credenciales' },
  { to: '/equipo', icon: Users, label: 'Directorio de Equipo' },
] as const

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[52px]' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center border-b border-border px-3">
        {!collapsed && (
          <span className="flex items-center gap-2 truncate text-sm font-semibold">
            <Activity className="h-5 w-5 shrink-0 text-primary" />
            IT Ops Hub
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer: usuario + logout */}
      <div className="border-t border-border p-2">
        {!collapsed && user && (
          <p
            className="truncate px-3 py-1 text-xs text-muted-foreground"
            title={user.email ?? ''}
          >
            {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={() => logout()}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            collapsed && 'justify-center'
          )}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}
