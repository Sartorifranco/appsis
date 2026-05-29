import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/modules/Auth/LoginPage'
import { DashboardPage } from '@/modules/Dashboard'
import { CamarasPage } from '@/modules/Camaras'
import { DocsPage } from '@/modules/Docs'
import { FinanzasPage } from '@/modules/Finanzas'
import { TicketsPage } from '@/modules/Tickets'
import { CredencialesPage } from '@/modules/Credenciales'
import { EquipoPage } from '@/modules/Equipo'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Guard: redirige a /login si no hay sesión */}
          <Route element={<ProtectedRoute />}>
            {/* Layout con sidebar */}
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/camaras" element={<CamarasPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/gastos" element={<FinanzasPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/credenciales" element={<CredencialesPage />} />
              <Route path="/equipo" element={<EquipoPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
