import generatePayload from 'promptpay-qr'
import QRCode from 'qrcode'

export async function createPromptpayQR(number, amount) {
  const target = String(number ?? '').replace(/[^0-9]/g, '')
  const value = Number(amount)
  const payload = generatePayload(target, { amount: Number.isFinite(value) && value > 0 ? value : undefined })
  return QRCode.toDataURL(payload, { width: 512, margin: 1 })
}
