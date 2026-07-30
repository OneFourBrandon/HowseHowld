import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { AppShell } from './components/AppShell'
import { HouseholdGate } from './components/HouseholdGate'
import { AppDataProvider } from './state/AppDataContext'

const TodayPage = lazy(() =>
  import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })),
)
const ChoresPage = lazy(() =>
  import('./pages/ChoresPage').then((module) => ({ default: module.ChoresPage })),
)
const MoneyPage = lazy(() =>
  import('./pages/MoneyPage').then((module) => ({ default: module.MoneyPage })),
)
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })),
)
const DrivewayPage = lazy(() =>
  import('./pages/DrivewayPage').then((module) => ({ default: module.DrivewayPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)

export default function App() {
  return (
    <AuthGate>
      <AppDataProvider>
        <HouseholdGate>
          <Suspense fallback={<div className="route-loading">Opening your house…</div>}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<TodayPage />} />
                <Route path="chores" element={<ChoresPage />} />
                <Route path="money" element={<MoneyPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="driveway" element={<DrivewayPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </HouseholdGate>
      </AppDataProvider>
    </AuthGate>
  )
}
