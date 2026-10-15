# Creator Data Finder

Aplikasi React + TypeScript + Vite dengan Supabase Auth dan Postgres. Tidak memakai Microsoft Entra. Fitur: single search, batch search dengan input/output yang bisa dipilih, tambah record manual, upload CSV, preview, dan verifikasi jumlah record.

## 1. Buat project Supabase

1. Buka https://supabase.com/ dan buat project baru.
2. Di Supabase, buka **SQL Editor**.
3. Buka file `supabase/schema.sql` dari project ini.
4. Copy seluruh isinya ke SQL Editor.
5. Klik **Run**.

SQL tersebut membuat tabel `creators`, index pencarian, dan Row Level Security. Hanya user yang sudah login Supabase yang dapat membaca atau mengubah data.

## 2. Buat user login

Di Supabase buka **Authentication → Users → Add user**.

Buat email dan password untuk belajar. Password tidak perlu ditulis di repository.

## 3. Ambil konfigurasi Supabase

Di Supabase buka **Project Settings → API** dan salin:

- Project URL
- Publishable key atau anon key

Jangan salin `service_role` key ke frontend. Secret key dapat melewati RLS dan hanya boleh berada di server.

## 4. Konfigurasi VS Code

Di terminal VS Code:

```powershell
cd "C:\Users\Yuxi\Documents\ChatGPT\Database Folder"
Copy-Item .env.example .env.local
```

Isi `.env.local`:

```env
VITE_SUPABASE_URL=https://project-id.supabase.co
VITE_SUPABASE_ANON_KEY=publishable-key-atau-anon-key
```

Jalankan:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Buka `http://localhost:5173`, lalu login dengan user Supabase.

## 5. Menambah satu record

1. Buka tab **Add / Upload**.
2. Isi Date, Creator ID, TikTok URL, dan Email.
3. Klik **Save record**.
4. Kembali ke Single Search.
5. Cari Creator ID atau email yang baru dimasukkan.

## 6. Upload CSV harian

Buat CSV dari Excel dengan header berikut:

```csv
Date,ID,TikTok Link,Email
2026-10-10,10000001,https://www.tiktok.com/@creator.one,creator.one@example.com
```

Lalu:

1. Buka **Add / Upload**.
2. Pilih file CSV.
3. Periksa preview.
4. Klik **Import rows**.
5. Tunggu progress selesai.
6. Lihat jumlah `records` di kanan atas.
7. Cari satu ID atau email untuk memastikan data masuk.

Import dikirim dalam batch 500 row. Untuk sekitar 3.000 row per hari, alur ini tidak mengirim satu request per row.

## 7. Batch Search dengan output pilihan

Contoh mencari email lalu mengambil username TikTok:

1. Buka **Batch Search**.
2. `Search by`: Email.
3. `Return`: TikTok username.
4. Paste satu email per baris.
5. Klik **Search batch**.
6. Klik **Copy output** untuk menyalin hasil.

Contoh lain:

- Creator ID → Email
- Email → TikTok URL
- TikTok username → Creator ID
- TikTok URL → Date

## 8. Cara mengecek hasil

- Jumlah database terlihat di kanan atas.
- Single Search mengecek satu record secara langsung.
- Batch Search menunjukkan `Found`, `Not Found`, `Duplicate Input`, atau `Multiple Matches`.
- `Match count` menunjukkan apakah satu input memiliki lebih dari satu record.
- Supabase Table Editor dapat dipakai untuk audit data secara langsung.

## Catatan data

Versi ini memakai Supabase sebagai cloud database, bukan SharePoint. Supabase tidak membutuhkan Entra, tetapi tetap membutuhkan login Supabase agar data tidak terbuka untuk publik. Jangan gunakan `service_role` key di browser. Untuk data produksi, tambahkan backup, role admin, dan proses duplicate review sebelum mengizinkan semua user melakukan delete.

## 9. Publish online dengan GitHub Pages

GitHub Pages hanya menyajikan frontend. Database tetap berada di Supabase. GitHub Pages tersedia untuk repository public pada GitHub Free; repository private membutuhkan plan GitHub yang mendukung Pages. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

1. Buat repository GitHub baru bernama `creator-data-finder`.
2. Jangan upload `.env.local`, karena file tersebut masuk `.gitignore`.
3. Dari terminal project jalankan:

```powershell
git init
git branch -M main
git add .
git commit -m "Initial Creator Data Finder"
git remote add origin https://github.com/USERNAME/creator-data-finder.git
git push -u origin main
```

Ganti `USERNAME` dengan username GitHub Anda.

4. Di repository GitHub buka **Settings → Secrets and variables → Actions**.
5. Tambahkan repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Gunakan nilai yang sama dengan `.env.local`. Key publishable boleh dipakai untuk browser; jangan gunakan secret/service role key. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

6. Buka **Settings → Pages**.
7. Pada **Build and deployment → Source**, pilih **GitHub Actions**.
8. Buka tab **Actions** dan tunggu workflow `Build and deploy` selesai.
9. URL website akan tampil di **Settings → Pages**, biasanya:

```text
https://USERNAME.github.io/creator-data-finder/
```

Jika Supabase email confirmation atau reset password digunakan, tambahkan URL tersebut di **Supabase → Authentication → URL Configuration → Redirect URLs**.

Setiap perubahan berikutnya cukup dilakukan dengan:

```powershell
git add .
git commit -m "Update creator search"
git push
```

GitHub Actions akan build dan deploy ulang otomatis. Workflow deploy memakai pola GitHub resmi: checkout, setup Node, build, upload artifact, lalu deploy Pages. [GitHub custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows)
