# SafePlace SerpApi Worker

Worker นี้เป็น proxy สำหรับเว็บไซต์ GitHub Pages: หน้าเว็บส่งพิกัดที่เลือกมาให้ Worker และ Worker เรียก Google Maps Search ผ่าน SerpApi ด้วย Secret ฝั่ง Cloudflare

## เตรียมใช้งาน

1. สร้างหรือหมุนเวียน SerpApi key ใหม่ แล้วเก็บไว้กับตัวเอง อย่านำ key ไปใส่ในหน้าเว็บหรือ Git
2. ติดตั้ง Node.js และเข้าสู่ระบบ Cloudflare จาก PowerShell หรือ terminal:

   ```powershell
   npx.cmd wrangler@4 login
   ```

3. จากโฟลเดอร์ `worker` ใน repository ตั้ง Secret (ระบบจะถามให้พิมพ์ค่าใน terminal):

   ```powershell
   npx.cmd wrangler@4 secret put SERPAPI_KEY
   ```

4. Deploy Worker:

   ```powershell
   npx.cmd wrangler@4 deploy
   ```

5. หน้าเว็บตั้งค่า Worker URL ไว้แล้ว ไม่ต้องกรอก URL ในหน้าเว็บ หลัง deploy ให้เปิดเว็บไซต์และตรวจข้อความสถานะการเชื่อมต่อ

## ข้อควรทราบ

- Worker ยอมรับคำขอจาก `https://pakin2013.github.io` และ localhost สำหรับทดสอบเท่านั้น
- Worker ปัดเศษพิกัดก่อนส่งให้ SerpApi และแสดงผลทั้งหมดที่ Google Maps คืนมาสำหรับคำค้น “ศูนย์พักพิง” โดยไม่จำแนกประเภทสถานที่
- เมื่อเลือกจุดในบริเวณจังหวัดสงขลา Worker จะรวมศูนย์พักพิงที่มีพิกัดภายใน 10 กม. จากบัญชีจังหวัดสงขลาปี 2568 ([ชุดข้อมูล data.go.th](https://data.go.th/dataset/59cca4fd-5bce-42f3-b007-42814a8f0604)); รายการซ้ำใกล้พิกัดเดียวกันจาก Google Maps จะไม่แสดงซ้ำ
- รายการค้นหาอาจไม่ครบและอาจมีสถานที่ที่ไม่เกี่ยวข้องปะปน ผลลัพธ์ไม่ใช่ทะเบียนทางการและไม่ได้ยืนยันสถานะเปิด/ความพร้อม โปรดโทรตรวจสอบกับหน่วยงานก่อนเดินทาง
- บัญชีจังหวัดสงขลาแสดงแผน/ข้อมูลปี 2568 เท่านั้น ไม่ใช่สถานะเปิดรับผู้ประสบภัยแบบเรียลไทม์
- Worker endpoint เป็นสาธารณะ การจำกัด origin ไม่ใช่ระบบยืนยันตัวตน ควรตั้ง Rate limiting/WAF ใน Cloudflare และติดตามโควตา SerpApi ก่อนเปิดใช้กับผู้ใช้ทั่วไป
