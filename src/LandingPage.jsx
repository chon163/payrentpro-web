import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

// LINE ติดต่อเรา — override ได้จาก env โดยไม่ต้องแก้โค้ด
const SUPPORT_LINE_ID = import.meta.env.VITE_SUPPORT_LINE_ID || '@payrentpro'
const SUPPORT_LINE_URL = `https://line.me/R/ti/p/~${SUPPORT_LINE_ID.replace(/^@/, '')}`

const BEFORE_ITEMS = [
  'นั่งจดยอดทุกเดือน',
  'ทวงเองเขิน ไม่กล้า',
  'ลืมว่าใครจ่ายแล้ว',
  'สลิปหลุดหายในแชท',
]

const AFTER_ITEMS = [
  'ระบบส่งบิลเองทุกเดือน',
  'บอททวงแทน สุภาพแต่สม่ำเสมอ',
  'สลิปเข้าระบบอัตโนมัติ',
  'รู้ทันทีว่าใครค้าง',
]

const FEATURES = [
  { icon: '📨', title: 'ส่งบิลเข้า LINE อัตโนมัติ', desc: 'สร้างบิลจบใน 10 วินาที ผู้เช่าได้รับทันที' },
  { icon: '🔔', title: 'ทวงเงินอัตโนมัติ', desc: 'ทุก 3 หรือ 7 วัน จนกว่าจะจ่าย (หยุดเองเมื่อเกิน 15 วัน)' },
  { icon: '💸', title: 'QR พร้อมเพย์ทุกบิล', desc: 'ผู้เช่าสแกนจ่ายได้จากมือถือเลย' },
  { icon: '🧾', title: 'รับสลิปปิดบิล', desc: 'ผู้เช่าส่งสลิปในกลุ่ม LINE ระบบบันทึกให้เอง' },
  { icon: '📊', title: 'แดชบอร์ดรู้ทันที', desc: 'ใครจ่าย ใครค้าง เหลือเก็บเท่าไหร่ ในหน้าเดียว' },
  { icon: '🏠🚗🛠️', title: 'ทุกธุรกิจให้เช่า', desc: 'หอพัก รถเช่า เครื่องจักร อุปกรณ์ ครบ' },
]

const STEPS = [
  { icon: '✍️', title: 'สมัครฟรี', desc: 'กรอกอีเมลรับลิงก์เข้าสู่ระบบ ไม่ต้องใช้บัตรเครดิต' },
  { icon: '🏠', title: 'เพิ่มห้อง/สินทรัพย์', desc: 'กรอกชื่อห้อง ค่าเช่า วันครบกำหนด จบในไม่กี่นาที' },
  { icon: '🤝', title: 'เชิญบอทเข้ากลุ่ม LINE', desc: 'เพิ่มบอท "เลขาทวงเงิน" เข้ากลุ่มแชทกับผู้เช่าแต่ละห้อง' },
  { icon: '⚙️', title: 'ระบบทำงานเองทุกเดือน', desc: 'ส่งบิล ทวงเงิน รับสลิป ปิดบิล — คุณแค่ดูแดชบอร์ด' },
]

const PLAN_FEATURES = [
  'ส่งบิลเข้า LINE อัตโนมัติ',
  'ทวงเงินอัตโนมัติทุก 3/7 วัน',
  'QR พร้อมเพย์ทุกบิล',
  'รับสลิปและปิดบิลให้เอง',
  'แดชบอร์ดสรุปยอดแบบเรียลไทม์',
]

const PLANS = [
  { name: 'Starter', price: '399', assets: '20 สินทรัพย์', best: false },
  { name: 'Pro', price: '699', assets: '50 สินทรัพย์', best: true },
]

const FAQS = [
  { q: 'ต้องให้ผู้เช่าโหลดแอปไหม?', a: 'ไม่ต้อง ผู้เช่าใช้ LINE ที่มีอยู่แล้ว รับบิลและแจ้งชำระเงินได้จากในแชทเดิม' },
  { q: 'ผู้เช่าไม่มี LINE ล่ะ?', a: 'ยังส่งลิงก์บิลผ่านช่องทางอื่นได้ จ่ายผ่าน QR พร้อมเพย์ได้เหมือนกัน' },
  { q: 'ข้อมูลปลอดภัยไหม?', a: 'แต่ละบัญชีแยกกันด้วยระบบรักษาความปลอดภัยระดับองค์กร (RLS) ระบบเก็บเฉพาะข้อมูลบิล' },
  { q: 'ทดลองฟรีจริงไหม?', a: 'ฟรีเต็มระบบ 30 วัน ไม่ต้องใส่บัตร ไม่ต่ออายุอัตโนมัติ' },
  { q: 'ค่าปรับล่าช้าทำได้ไหม?', a: 'ได้ ตั้งอัตราเองได้ทุกห้อง พร้อมขีดจำกัดสูงสุดกันเผลอคิดเกิน' },
]

function scrollToPricing() {
  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function LogoMark({ className = 'h-9 w-9 text-lg' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 ${className}`}>
      💰
    </span>
  )
}

function GreenCta({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-green-600/30 transition-all hover:bg-green-500 hover:shadow-xl hover:shadow-green-600/30 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  )
}

// ---------- การ์ดจำลองแชท LINE ----------

function BotBubble({ title, lines = [], action, time = '10:24' }) {
  return (
    <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-3 shadow-sm">
      {title ? <p className="text-sm font-bold text-gray-900">{title}</p> : null}
      {lines.map((line) => (
        <p key={line} className="mt-0.5 text-sm leading-relaxed text-gray-700">{line}</p>
      ))}
      {action ? (
        <span className="mt-2.5 block rounded-xl bg-[#06C755] px-3 py-2 text-center text-sm font-bold text-white shadow-sm">
          {action}
        </span>
      ) : null}
      <p className="mt-1.5 text-right text-[10px] text-gray-400">{time}</p>
    </div>
  )
}

function TenantBubble({ children, time = '10:25' }) {
  return (
    <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-lime-200 px-3.5 py-3 shadow-sm">
      <p className="text-sm font-medium text-gray-800">{children}</p>
      <p className="mt-1.5 text-right text-[10px] text-gray-500">
        {time} <span className="font-bold text-[#06C755]">✓✓</span>
      </p>
    </div>
  )
}

function ChatWindow({ caption, children }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/70 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-center gap-2.5 bg-[#06C755] px-4 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-base">🤖</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">เลขาทวงเงิน PayRentPro</p>
        </div>
        <span className="ml-auto text-xs text-white/70">LINE</span>
      </div>
      <div className="flex min-h-[190px] flex-1 flex-col justify-end gap-3 bg-[#eef2f6] p-4">
        {children}
      </div>
      <p className="bg-white px-4 py-2.5 text-center text-xs font-semibold text-gray-500">{caption}</p>
    </div>
  )
}

// ---------- Sections ----------

function PageHeader() {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight text-gray-900">PayRentPro</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={scrollToPricing}
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900 sm:block"
          >
            ดูราคา
          </button>
          <Link
            to="/login"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-500"
          >
            เข้าสู่ระบบ
          </Link>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
          >
            เริ่มใช้ฟรี
          </button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const navigate = useNavigate()
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 top-32 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 md:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm">
            🤖 ผู้ช่วยทวงค่าเช่าบน LINE
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            เบื่อตาม<span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">ค่าเช่า</span>เองทุกเดือนไหม?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
            PayRentPro ส่งบิลเข้า LINE ทวงเงินอัตโนมัติ รับสลิปปิดบิลให้เอง คุณแค่นั่งดูยอดเงินเข้า
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GreenCta onClick={() => navigate('/login')} className="w-full sm:w-auto">
              เริ่มใช้ฟรี 30 วัน
            </GreenCta>
            <button
              type="button"
              onClick={scrollToPricing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:w-auto"
            >
              ดูราคา
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-400">ไม่ต้องใช้บัตรเครดิต · ไม่ต่ออายุอัตโนมัติ · ยกเลิกได้ทุกเวลา</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
          <ChatWindow caption="ส่งบิลพร้อม QR อัตโนมัติทุกงวด">
            <BotBubble
              title="🧾 บิลค่าเช่า งวด ต.ค."
              lines={['ค่าห้อง 4,500 · น้ำ 120 · ไฟ 380', 'ยอดชำระรวม ฿5,000']}
              action="💳 ชำระด้วย QR พร้อมเพย์"
            />
          </ChatWindow>
          <ChatWindow caption="ทวงเงินอัตโนมัติ สุภาพทุกครั้ง">
            <BotBubble
              title="⚠️ แจ้งเตือนค่าเช่า"
              lines={['งวด ก.ย. ฿5,000 ค้าง 3 วัน']}
              action="🔗 เปิดลิงก์ชำระเงิน"
            />
          </ChatWindow>
          <ChatWindow caption="ผู้เช่าส่งสลิป ระบบปิดบิลให้เอง">
            <TenantBubble>📎 สลิปโอนเงิน.jpg</TenantBubble>
            <BotBubble title="✅ ได้รับสลิปแล้ว กำลังตรวจสอบ" lines={['ระบบบันทึกสลิปและแจ้งเจ้าของที่พักทันที']} />
          </ChatWindow>
        </div>
      </div>
    </section>
  )
}

function BeforeAfter() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">ชีวิตเปลี่ยนไปแค่ไหน?</h2>
        <p className="mt-3 text-gray-600">จากงานเอกสารที่ต้องตามเองทุกเดือน สู่ระบบที่ทำแทนคุณทั้งหมด</p>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/60 p-7">
          <h3 className="text-lg font-bold text-rose-700">❌ ชีวิตก่อนใช้</h3>
          <ul className="mt-5 space-y-4">
            {BEFORE_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-600">✗</span>
                <span className="text-base text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-7">
          <h3 className="text-lg font-bold text-emerald-700">✅ หลังใช้ PayRentPro</h3>
          <ul className="mt-5 space-y-4">
            {AFTER_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600">✓</span>
                <span className="text-base text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">ครบทุกงานเกี่ยวกับค่าเช่า</h2>
          <p className="mt-3 text-gray-600">ตั้งแต่ออกบิล ทวงเงิน รับสลิป จนถึงสรุปยอด — ในระบบเดียว</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-2xl">
                {f.icon}
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">เริ่มใช้ง่ายใน 4 ขั้นตอน</h2>
        <p className="mt-3 text-gray-600">ตั้งค่าครั้งเดียว ระบบทำงานต่อให้ทุกเดือน</p>
      </div>
      <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4 md:gap-5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-5xl font-bold leading-none text-transparent">
              {i + 1}
            </p>
            <p className="mt-3 text-3xl">{step.icon}</p>
            <h3 className="mt-3 text-base font-bold text-gray-900">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Pricing() {
  const navigate = useNavigate()
  return (
    <section id="pricing" className="bg-gradient-to-b from-indigo-50/80 to-violet-50/60 py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">ราคาเรียบง่าย โปร่งใส</h2>
          <p className="mt-3 text-gray-600">เริ่มฟรีก่อน ค่อยเลือกแพ็กเกจที่พอดีกับธุรกิจ</p>
        </div>

        {/* การ์ดทดลองใช้ฟรี */}
        <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-indigo-100 bg-white p-8 text-center shadow-xl shadow-indigo-100/70 sm:p-10">
          <h3 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">เริ่มต้นฟรี 30 วัน</h3>
          <p className="mt-2 text-gray-600">ทดลองใช้ครบทุกฟีเจอร์ ไม่ต้องใช้บัตรเครดิต ไม่ต่ออายุอัตโนมัติ</p>
          <GreenCta onClick={() => navigate('/login')} className="mt-6 w-full sm:w-auto">
            เริ่มใช้ฟรีเลย
          </GreenCta>
        </div>

        {/* แพ็กเกจรายเดือน */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.best
                  ? 'relative rounded-3xl border-2 border-indigo-500 bg-white p-8 shadow-xl shadow-indigo-200/60'
                  : 'rounded-3xl border border-gray-200 bg-white p-8 shadow-sm'
              }
            >
              {plan.best && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-indigo-600/30">
                  คุ้มที่สุด
                </span>
              )}
              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <p className="mt-3">
                <span className="text-4xl font-bold tracking-tight text-gray-900">฿{plan.price}</span>
                <span className="ml-1 text-base font-medium text-gray-500">/เดือน</span>
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                {plan.assets}
              </p>
              <p className="mt-1 text-sm text-gray-500">ทุกฟีเจอร์ครบ ไม่มีค่าแอบแฝง</p>
              <ul className="mt-5 space-y-2.5">
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={
                  plan.best
                    ? 'mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500'
                    : 'mt-7 w-full rounded-2xl border border-indigo-200 bg-white px-6 py-3.5 text-base font-bold text-indigo-700 transition-colors hover:bg-indigo-50'
                }
              >
                เริ่มด้วย {plan.name}
              </button>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-gray-500">
          💡 จ่ายราย 3/6/12 เดือน ยิ่งประหยัด — 3 เดือน ฿1,099 · 6 เดือน ฿1,990 · 1 ปี ฿3,990
          <br />
          ยกเลิกได้ทุกเวลา ข้อมูลของคุณไม่หาย
        </p>

        <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-dashed border-indigo-300 bg-white/70 p-5 text-center">
          <p className="text-base font-bold text-gray-900">เกิน 50 สินทรัพย์?</p>
          <p className="mt-1 text-sm text-gray-600">
            อสังหาฯ ขนาดใหญ่ ฟลีตรถ หรือธุรกิจระดับองค์กร — ทัก LINE ของเรา{' '}
            <a href={SUPPORT_LINE_URL} target="_blank" rel="noreferrer" className="font-bold text-[#06C755] underline underline-offset-2 hover:opacity-80">
              {SUPPORT_LINE_ID}
            </a>{' '}
            จัดแพ็กเกจพิเศษให้
          </p>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const [openIndex, setOpenIndex] = useState(0)
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">คำถามที่พบบ่อย</h2>
      </div>
      <div className="mt-10 space-y-3">
        {FAQS.map((item, i) => {
          const open = openIndex === i
          return (
            <div key={item.q} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                aria-expanded={open}
              >
                <span className="text-base font-semibold text-gray-900">{item.q}</span>
                <svg
                  className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {open && <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{item.a}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PageFooter() {
  return (
    <footer className="bg-gradient-to-br from-indigo-900 to-violet-900">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-10 text-center sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight text-white">PayRentPro</span>
        </div>
        <p className="text-sm text-indigo-200">ระบบจัดการและทวงเงินค่าเช่าอัตโนมัติ</p>
        <p className="text-sm text-indigo-200">
          ติดต่อเรา:{' '}
          <a href={SUPPORT_LINE_URL} target="_blank" rel="noreferrer" className="font-bold text-white underline underline-offset-2 hover:text-emerald-300">
            LINE {SUPPORT_LINE_ID}
          </a>
        </p>
        <Link to="/login" className="text-sm text-indigo-300 transition-colors hover:text-white">
          เข้าสู่ระบบ
        </Link>
        <p className="text-xs text-indigo-300/70">© {new Date().getFullYear()} PayRentPro — สงวนลิขสิทธิ์</p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <PageHeader />
      <main>
        <Hero />
        <BeforeAfter />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
      </main>
      <PageFooter />
    </div>
  )
}
