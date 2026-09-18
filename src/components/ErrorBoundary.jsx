import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-900/20 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40">
              <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">เกิดข้อผิดพลาด</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {this.state.error?.message?.includes('bill_day') ||
               this.state.error?.message?.includes('penalty_day') ||
               this.state.error?.message?.includes('min_water_charge')
                ? 'ฐานข้อมูลขาดคอลัมน์ที่จำเป็น กรุณาตรวจสอบว่า bill_day, penalty_day, min_water_charge มีใน rentals table'
                : 'ไม่สามารถแสดงหน้านี้ได้ กรุณาลองใหม่อีกครั้ง'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-500"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
