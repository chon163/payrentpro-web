#!/bin/bash
cd "$(dirname "$0")" || exit 1

while true; do
  if [ -f DONE.md ]; then echo "✅ งานเสร็จแล้ว จบสคริปต์"; break; fi

  claude -p --dangerously-skip-permissions --continue \
    "อ่าน PLAN.md และ PROGRESS.md แล้วทำงานต่อจากที่ค้างจนครบทุก phase แล้วสร้าง DONE.md" \
    || claude -p --dangerously-skip-permissions \
    "อ่าน PLAN.md ในโฟลเดอร์นี้แล้วเริ่มทำตามแผนทันทีจนครบ แล้วสร้าง DONE.md"

  echo "session จบลง รอ 2 นาทีแล้วรันต่อ..."
  sleep 120
done