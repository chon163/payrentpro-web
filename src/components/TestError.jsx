import { useState } from 'react'

export default function TestError() {
  const [shouldThrow, setShouldThrow] = useState(false)

  if (shouldThrow) {
    throw new Error('ทดสอบ Error Boundary: จำลอง error ใน component')
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      background: '#fee',
      border: '2px solid #c00',
      borderRadius: '8px',
      padding: '8px 12px'
    }}>
      <button
        onClick={() => setShouldThrow(true)}
        style={{
          background: '#c00',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
      >
        🧪 ทดสอบ Error Boundary
      </button>
    </div>
  )
}
