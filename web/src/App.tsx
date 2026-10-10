import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import RoleGate from './components/RoleGate'
import { FullScreenLoader } from './components/ui'
import { homeFor } from './lib/utils'
import BalancesPage from './pages/BalancesPage'
import EmployeesPage from './pages/EmployeesPage'
import EngineerNoticePage from './pages/EngineerNoticePage'
import LeaveQueuePage from './pages/LeaveQueuePage'
import LeaveTypesPage from './pages/LeaveTypesPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PayrollPage from './pages/PayrollPage'
import ReportsPage from './pages/ReportsPage'
import SitesPage from './pages/SitesPage'
import TeamTodayPage from './pages/TeamTodayPage'

/** Auth guard + dashboard chrome for every authenticated non-ENGINEER route. */
function Shell() {
  const { user, ready } = useAuth()
  if (!ready) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'ENGINEER') return <Navigate to="/mobile" replace />
  return <Layout />
}

function Home() {
  const { user, ready } = useAuth()
  if (!ready) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(user.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mobile" element={<EngineerNoticePage />} />

      <Route element={<Shell />}>
        <Route
          path="/team"
          element={
            <RoleGate roles={['MANAGER', 'HR', 'ADMIN']}>
              <TeamTodayPage />
            </RoleGate>
          }
        />
        <Route
          path="/leave"
          element={
            <RoleGate roles={['MANAGER', 'HR', 'ADMIN']}>
              <LeaveQueuePage />
            </RoleGate>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleGate roles={['MANAGER', 'HR', 'ADMIN']}>
              <ReportsPage />
            </RoleGate>
          }
        />
        <Route
          path="/employees"
          element={
            <RoleGate roles={['HR', 'ADMIN']}>
              <EmployeesPage />
            </RoleGate>
          }
        />
        <Route
          path="/sites"
          element={
            <RoleGate roles={['HR', 'ADMIN']}>
              <SitesPage />
            </RoleGate>
          }
        />
        <Route
          path="/leave-types"
          element={
            <RoleGate roles={['HR', 'ADMIN']}>
              <LeaveTypesPage />
            </RoleGate>
          }
        />
        <Route
          path="/balances"
          element={
            <RoleGate roles={['HR', 'ADMIN']}>
              <BalancesPage />
            </RoleGate>
          }
        />
        <Route
          path="/payroll"
          element={
            <RoleGate roles={['HR', 'ADMIN']}>
              <PayrollPage />
            </RoleGate>
          }
        />
      </Route>

      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
