# SafePlace SerpApi Worker

Worker นี้เป็น proxy สำหรับเว็บไซต์ GitHub Pages: หน้าเว็บส่งพิกัดที่เลือกมาให้ Worker และ Worker เรียก Google Maps Search ผ่าน SerpApi ด้วย Secret ฝั่ง Cloudflare

## เตรียมใช้งาน

1. สร้างหรือหมุนเวียน SerpApi key ใหม่ แล้วเก็บไว้กับตัวเอง อย่านำ key ไปใส่ในหน้าเว็บหรือ Git
2. ติดตั้ง Node.js และเข้าสู่ระบบ Cloudflare จาก PowerShell หรือ terminal:

   ```powershell
   npx wrangler@4 login
   ```

3. จากโฟลเดอร์ `worker` ใน repository ตั้ง Secret (ระบบจะถามให้พิมพ์ค่าใน terminal):

   ```powershell
   npx wrangler@4 secret put SERPAPI_KEY
   ```

4. Deploy Worker:

   ```powershell
   npx wrangler@4 deploy
   ```

5. คัดลอก URL ที่ Wrangler แสดง ซึ่งมักมีรูปแบบ `https://safeplace-shelter-proxy.<ชื่อบัญชี>.workers.dev` ไปวางในช่อง **URL ของ Worker proxy** บนเว็บไซต์ แล้วกด **เชื่อมต่อ**

## ข้อควรทราบ

- Worker ยอมรับคำขอจาก `https://pakin2013.github.io` และ localhost สำหรับทดสอบเท่านั้น
- Worker ปัดเศษพิกัดก่อนส่งให้ SerpApi จำกัดผลลัพธ์ไว้สูงสุด 5 แห่ง และไม่เปิดเผย Secret ใน response
- คำว่า “ศูนย์พักพิงฉุกเฉิน” ใช้ค้นหา Google Maps; ผลลัพธ์ไม่ใช่ทะเบียนทางการและไม่ได้ยืนยันสถานะเปิด/ความพร้อม โปรดโทรตรวจสอบกับหน่วยงานก่อนเดินทาง
- Worker endpoint เป็นสาธารณะ การจำกัด origin ไม่ใช่ระบบยืนยันตัวตน ควรตั้ง Rate limiting/WAF ใน Cloudflare และติดตามโควตา SerpApi ก่อนเปิดใช้กับผู้ใช้ทั่วไป
