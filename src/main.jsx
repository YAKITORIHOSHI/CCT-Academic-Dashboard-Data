import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './neumorphism.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-950 p-5 text-slate-100">
        <section className="w-full max-w-xl rounded-2xl border border-rose-900/60 bg-slate-900 p-6 shadow-2xl">
          <p className="text-xs font-semibold tracking-normal text-amber-400">Application recovery</p>
          <h1 className="mt-2 text-xl font-semibold">The CCT Workspace Could Not Be Rendered.</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Reload the application. If the issue continues, provide the time of the error to the system administrator so it can be correlated with the audit logs.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-11 rounded-xl bg-rose-800 px-5 text-sm font-bold text-white hover:bg-rose-700"
          >
            Reload application
          </button>
          {import.meta.env.DEV && (
            <details className="mt-5 rounded-xl bg-slate-950 p-3 text-sm text-rose-300">
              <summary className="cursor-pointer font-bold">Developer details</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </section>
      </main>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
