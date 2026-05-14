// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <Routes>
        <Route path="/"         element={<Dashboard />} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
