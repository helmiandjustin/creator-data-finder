# Deploy ke Cloudflare Pages (custom domain)

Project ini mengikuti pola yang sama dengan project helmimuharrom.web.id:
**GitHub** = gudang kode + pemicu, **Cloudflare Pages** = build & hosting publik.

## Arsitektur

```
push ke main (GitHub)
   │
   ▼
Cloudflare Pages build (tsc + vite build → dist/)
   │
   ▼
Hosting publik: https://databasehelmiganteng.web.id/
   │
   ▼
Pages Function /api/v1/usee → proxy read-only data kantor (+ cache)
```

## Bagian yang sudah siap di repo

- `functions/api/v1/usee.ts` — Pag Function proxy ke kantor (menyembunyikan URL
  Edge Function, cache read-only).
- `.github/workflows/deploy-cloudflare.yml` — deploy otomatis ke Cloudflare Pages
  saat push ke `main`.
- `src/services/useeView.ts` — memakai proxy bila `VITE_USEE_PROXY_URL` di-set;
  jika tidak, fallback ke URL langsung (perilaku lama tetap sama).

## Langkah manual (di akun Cloudflare)

1. **Tambahkan domain** ke Cloudflare (zone `databasehelmiganteng.web.id`).
2. **Ganti nameserver** di indo.domains ke nameserver dari Cloudflare.
   (Setelah dipindah, DNS dikelola Cloudflare. Tunggu propagasi, biasanya beberapa jam.)
3. **Buat Pages project** bernama `creator-data-finder`, hubungkan ke repo GitHub
   ini (branch `main`).
4. **Set environment variables** di Pages project (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = URL Supabase (justin)
   - `VITE_SUPABASE_ANON_KEY` = anon key Supabase
   - `VITE_USEE_PROXY_URL` = `/api/v1/usee`
   - `USEE_DASHBOARD_URL` = `https://pghfhrbgagplszjymkts.supabase.co/functions/v1/usee-dashboard`
     (variabel runtime untuk Pages Function)
   - `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` (secret, dipakai workflow GitHub)
5. **Tambah custom domain** `databasehelmiganteng.web.id` di Pages project.
6. Push ke `main` → workflow deploy berjalan → site live di domain.

> Catatan: `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` di-set sebagai
> **GitHub repo secrets** (bukan env Cloudflare) karena dipakai oleh workflow.
