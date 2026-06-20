---
description: promote ข้าม env (staging/prod) ตาม promotion rules
---
ทำตาม devops agent + /promote-release: $ARGUMENTS
ยืนยัน pre-condition (prod ต้องผ่าน Staging + G4 sign-off เสมอ ห้ามข้าม) ก่อน; ขออนุมัติ G5 ก่อนขึ้น prod (tag + changelog + rollback)
