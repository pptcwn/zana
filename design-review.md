# Zana — รีวิว ฟังก์ชัน / สี / ดีไซน์ และแนวทางแก้ไข

โปรเจกต์: Next.js 16 + Supabase + Tailwind v4 + shadcn (CRM/E-commerce ภาษาไทย ธีมชมพู)
ขอบเขตที่รีวิว: `app/`, `components/`, `app/globals.css`, หน้า client ทั้งหมด

---

## สรุปภาพรวม (TL;DR)

โครงสร้างโค้ดดี แยก server action / data layer / client ชัดเจน แต่มี **3 ปัญหาใหญ่เชิงระบบ**:

1. **ระบบสี token ตายทั้งระบบ** — `globals.css` นิยาม design token ครบ (`--primary`, `--card` ฯลฯ) แต่ component แทบไม่ใช้เลย ไปฮาร์ดโค้ด `pink-*`, `slate-*` และ hex ตรงๆ แทน → มีสองระบบสีซ้อนกัน
2. **ค่าสี primary ผิด hue** — คอมเมนต์บอก `#EC4899` แต่ค่าจริง `oklch(0.65 0.22 0)` คือ **แดง** ไม่ใช่ชมพู
3. **UX หลังบันทึกข้อมูลใช้ `window.location.reload()`** — รีโหลดทั้งหน้า เสีย state/scroll/filter ทุกครั้ง

จัดลำดับความสำคัญ: 🔴 ควรแก้ก่อน · 🟡 ควรแก้ · 🟢 ปรับปรุงเพิ่มเติม

---

## 1. สี (Color)

### 🔴 1.1 ค่า primary ไม่ใช่ชมพูจริง
`globals.css`:
```css
--primary: oklch(0.65 0.22 0);   /* คอมเมนต์ว่า #EC4899 hot pink — แต่ hue 0 = แดง */
```
ใน OKLCH ชมพู `#EC4899` อยู่ที่ hue ราว **350°** ไม่ใช่ `0`. token สีชมพูทั้งชุด (`--ring`, `--accent`, `--chart-*`) ก็ตั้ง hue 0 หมด → ออกเป็นแดง/แดงอมชมพู
**แก้:** เปลี่ยน hue เป็น ~350 เช่น
```css
--primary: oklch(0.64 0.20 352);
--ring:    oklch(0.75 0.13 352);
```

### 🔴 1.2 สองระบบสีซ้อนกัน — token ไม่ถูกใช้
`globals.css` มี token ครบ แต่ component เขียนแบบนี้แทน:
```tsx
style={{ background: "#FFF0F3" }}          // layout.tsx, protected/layout.tsx, body
style={{ border: "1.5px solid #f9a8d4" }}  // StatCard
className="text-pink-400 ... border-pink-100 ... text-slate-800"
```
ผลคือธีมเปลี่ยนยาก, dark mode พัง, ดูแลลำบาก
**แก้:** ใช้ token แทนทั้งหมด — `bg-background`, `bg-card`, `border-border`, `text-primary`, `text-muted-foreground` ฯลฯ และลบ inline `style` พื้นหลังออก (ตอนนี้ซ้ำ 3 ที่)

### 🟡 1.3 Dark mode เป็นโค้ดตาย
`.dark` ถูกนิยามไว้ (และเป็นสีเทากลางๆ ไม่ใช่ชมพู) แต่ไม่มีที่ไหน toggle `class="dark"` เลย
**แก้:** เพิ่มปุ่มสลับธีม + เก็บค่าใน cookie/localStorage หรือถ้าไม่ใช้ ก็ลบ block `.dark` ทิ้งเพื่อลดความสับสน

### 🟡 1.4 ชมพูล้น ไม่มีสีกลางยึด (pink fatigue)
ชมพูถูกใช้กับ ขอบ + label + ไอคอน + placeholder + หัวตาราง พร้อมกัน ทำให้สายตาล้าและลำดับความสำคัญหาย เช่น `text-pink-400` ใช้เป็น label ทุกอัน
**แก้:** ใช้ชมพูเป็น **accent เฉพาะจุด** (ปุ่มหลัก, สถานะ active, ไฮไลต์) ส่วน label/ขอบ/ข้อความรองใช้สีเทากลาง (`muted-foreground`, `border`)

### 🟡 1.5 Contrast ต่ำกว่ามาตรฐาน (WCAG AA)
- `text-pink-300`, `text-pink-200` บนพื้นขาว (ใช้เป็นวันที่, placeholder, label) — contrast ต่ำกว่า 4.5:1 อ่านยาก
- `placeholder:text-pink-200` แทบมองไม่เห็น
**แก้:** ข้อความสำคัญใช้ `text-slate-600`+ ; placeholder ใช้ `text-muted-foreground`

### 🟢 1.6 กราฟแยกเส้นยาก
Dashboard: Revenue กับ Profit เป็นชมพูทั้งคู่ (`#ec4899` / `#f9a8d4`) และ Platform bar เป็นชมพู 4 เฉด → ดูแยกไม่ออก
**แก้:** ใช้สีคู่ตัดกัน เช่น Revenue ชมพู / Profit เขียวมิ้นต์หรือม่วง; bar chart ใช้ชุดสี categorical จริง

---

## 2. ฟังก์ชันการใช้งาน (Functionality / UX)

### 🔴 2.1 `window.location.reload()` หลังบันทึก
พบใน orders (สร้าง/เปลี่ยนสถานะ) และที่อื่น — รีโหลดทั้งหน้า ทำให้กระพริบ เสีย scroll และ filter ที่ผู้ใช้ตั้งไว้
**แก้:** ใช้ `router.refresh()` (Next.js) ร่วมกับ optimistic update หรือ revalidate จาก server action — ผู้ใช้ admin ที่ทำงานทั้งวันจะรู้สึกต่างชัดเจน

### 🔴 2.2 ไม่มี pagination ในตาราง
orders / customers / crm โหลดและ filter ทุกแถวฝั่ง client — ข้อมูลโตขึ้นจะช้าและกินหน่วยความจำ
**แก้:** ทำ pagination หรือ infinite scroll + ย้าย search/filter ไปทำที่ DB (Supabase query)

### 🟡 2.3 แจ้ง error ไม่สม่ำเสมอ
บางที่ใช้ `alert()` (orders tracking, customers, products), บางที่ใช้ inline `<p className="text-red-...">` ไม่มีระบบ toast กลาง
**แก้:** ใส่ toast component เดียว (เช่น `sonner` หรือ shadcn toast) ใช้ทั้งแอป

### 🟡 2.4 ไม่มี confirm สำหรับ action ที่ทำลายข้อมูล
ลบ ad spend / ยกเลิกออเดอร์ ทำทันทีไม่มีถามยืนยัน
**แก้:** ใส่ confirm dialog ก่อนลบ/ยกเลิก

### 🟡 2.5 ปุ่ม Sign out มีโค้ดซ้อนสับสน
`sidebar.tsx`:
```tsx
<form action="/api/auth/signout" method="POST">
  <button type="button" onClick={...signOut()...}>ออกจากระบบ</button>
</form>
```
`<form>` ใช้งานไม่ได้จริง (ปุ่มเป็น `type="button"` + ทำงานผ่าน onClick) → form เป็น dead code
**แก้:** เลือกทางเดียว — ลบ `<form>` ออก หรือทำเป็น server action จริง

### 🟡 2.6 ไม่ Responsive บนมือถือ
Sidebar กว้างคงที่ 220px ไม่มี hamburger/collapse และตารางหลายคอลัมน์ล้นจอเล็ก (แต่แอดมินขายของออนไลน์มักใช้มือถือ)
**แก้:** sidebar ยุบเป็น drawer บน mobile; ตารางใส่ `overflow-x-auto` หรือเปลี่ยนเป็น card list บนจอเล็ก

### 🟡 2.7 ไม่มี loading / skeleton ระหว่างโหลดหน้า
**แก้:** เพิ่ม `loading.tsx` + skeleton ของตาราง/การ์ด

### 🟢 2.8 ค่าคงที่ฝังในโค้ด
`ProfitCalculator` ใช้ COGS = 38% ตายตัว (`revenue * 0.38`)
**แก้:** ดึงต้นทุนจริงจากสินค้าในออเดอร์ หรือทำเป็นค่าตั้งค่าได้

### 🟢 2.9 ไอคอนสื่อความหมายผิด
CRM ใช้ `MessageCircle` (แชต) ลิงก์ไปที่ `tel:` (โทร)
**แก้:** ใช้ `Phone` สำหรับโทร และทำลิงก์ Line/แชตแยกถ้าต้องการ

---

## 3. ดีไซน์ / เลย์เอาต์ (Design)

### 🔴 3.1 หน้า Login หลุดธีมทั้งหน้า
`login/page.tsx` ใช้ slate/ดำล้วน — `bg-slate-50`, ปุ่ม `bg-slate-900`, `focus:ring-slate-900` ไม่มีชมพูเลย ดูเหมือนคนละแอป
**แก้:** ปรับให้ใช้ธีมชมพูเดียวกับส่วนที่เหลือ (พื้น `#FFF0F3`, ปุ่ม primary ชมพู, โลโก้ 🌸 ZANA)

### 🟡 3.2 ลำดับชั้นตัวอักษรอ่อน
หัวข้อหน้าเป็น `text-base` (16px) — ใหญ่กว่า body แทบไม่ต่าง ทำให้ไม่รู้สึกว่าเป็นหัวข้อ
**แก้:** หัวข้อหน้าใช้ `text-xl`/`text-2xl font-semibold`; กำหนด type scale ให้คงที่ทั้งแอป

### 🟡 3.3 สไตล์การ์ด/ระยะ/ความโค้ง ไม่สม่ำเสมอ
- StatCard ขอบ inline `1.5px #f9a8d4` แต่การ์ดอื่น `border-pink-100`/`200`
- บางหน้า `space-y-5` บาง `space-y-6`; `max-w-5xl` กับ `max-w-4xl` ปนกัน
- `@theme` นิยาม radius ละเอียด (sm→4xl) แต่ component สุ่มใช้ `rounded-lg`/`xl`
**แก้:** ทำ component กลาง `<Card>` `<PageHeader>` `<StatCard>` ใช้ token เดียว แล้วเรียกซ้ำทุกหน้า

### 🟡 3.4 ผสม inline `style` กับ Tailwind
มี `style={{...}}` กระจายปนกับ class จำนวนมาก ดูแลยากและทำให้ override กันเอง
**แก้:** ย้ายทุกอย่างไป Tailwind/token

### 🟢 3.5 Empty state จืด
มีแค่ข้อความเล็ก "ไม่พบรายการ" สีอ่อน
**แก้:** ใส่ไอคอน + คำอธิบาย + ปุ่ม CTA (เช่น "สร้างออเดอร์แรก")

### 🟢 3.6 ไฟล์ขยะที่ root
`ZanaDashboard.jsx` (23KB) และ `ZanaCRMFollowup.jsx` (26KB) อยู่นอก `app/` ดูเหมือน prototype เก่าซ้ำกับหน้าใน app — รก repo
**แก้:** ลบหรือย้ายเข้า `docs/`/archive

### 🟢 3.7 เวอร์ชัน lucide-react น่าสงสัย
`package.json` ระบุ `"lucide-react": "^1.17.0"` — ผิดปกติจากช่วงเวอร์ชันที่ใช้กันทั่วไป ควรเช็กว่าติดตั้งตัวที่ตั้งใจไว้จริง (ไอคอนอาจเพี้ยน)

---

## ลำดับการลงมือ (แนะนำ)

1. แก้ hue สี primary (1.1) + ย้ายไปใช้ token (1.2) — ฐานของทุกอย่าง
2. เปลี่ยน `reload()` → `router.refresh()` (2.1)
3. ปรับหน้า Login ให้เข้าธีม (3.1)
4. ระบบ toast + confirm dialog (2.3, 2.4)
5. Pagination + responsive (2.2, 2.6)
6. ทำ component กลาง + type scale (3.2, 3.3)
7. เก็บกวาด: ลบ dead code, ไฟล์ root, dark mode ที่ไม่ใช้ (2.5, 3.6, 1.3)

---

## ความเสี่ยงด้าน Accessibility (เสริม)
- Modal ไม่มี focus trap / ปิดด้วย Esc / `role="dialog"`
- ปุ่มไอคอนล้วน (X, Trash2, ฯลฯ) ไม่มี `aria-label`
- Contrast ต่ำตามข้อ 1.5
ควรไล่แก้ถ้าจะให้ใช้งานได้ทั่วถึง
