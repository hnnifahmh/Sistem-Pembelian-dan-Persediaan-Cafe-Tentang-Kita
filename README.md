# Tentang Kita Cafe

Sistem sederhana untuk melihat persediaan bahan baku, pembelian, resep menu, dan nilai stok dengan metode FIFO perpetual.

## Isi repository

- `frontend/`: web statis HTML, CSS, dan JavaScript. Dapat dipublikasikan melalui GitHub Pages.
- `backend/`: server Node.js opsional untuk API dan SQL Supabase.

GitHub Pages hanya menjalankan frontend statis. Frontend terhubung langsung ke Supabase untuk membaca data; backend Node.js tidak dijalankan oleh GitHub Pages.

## Siapkan akses aman

1. Di Supabase SQL Editor, jalankan `backend/secure_public_access.sql` pada project yang digunakan aplikasi. Jangan jalankan ulang `backend/schema.sql` pada database yang sudah berisi data karena schema awal berisi perintah DROP TABLE.
2. Di Supabase Authentication, buat akun staf untuk setiap operator. Matikan pendaftaran publik agar pengunjung tidak bisa membuat akun sendiri.
3. Pastikan login email/password diaktifkan pada Supabase Auth.
4. Buka web dan masuk dengan akun staf. Pengunjung tanpa login hanya dapat membaca dashboard.

Migration SQL mempertahankan baca publik dan membatasi perubahan tabel ke pengguna terautentikasi. Terapkan migration terlebih dahulu sebelum menayangkan web.

## Publikasikan dengan GitHub Pages

1. Buka Settings > Pages pada repository ini dan pilih **GitHub Actions** sebagai sumber deployment.
2. Pastikan migration keamanan Supabase dan akun staf telah disiapkan.
3. Buka tab Actions, pilih workflow **Publish site**, lalu pilih **Run workflow** pada branch `main`.
4. Setelah workflow selesai, situs tersedia di `https://hnnifahmh.github.io/Sistem-Pembelian-dan-Persediaan-Cafe-Tentang-Kita/`.

Workflow deployment dibuat manual agar perubahan tidak dipublikasikan sebelum database diamankan.

## Jalankan backend secara lokal

Dengan Node.js terpasang, jalankan:

```powershell
node backend/app.js
```

Kemudian buka `http://localhost:3000`. Jangan pernah menaruh Supabase `service_role` key di frontend atau repository publik.