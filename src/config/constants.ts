// Konstanta konfigurasi untuk pipeline import.
// Daftar PIC resign: data mereka boleh diambil (tidak di-exclude).
// PIC lain (aktif) yang ketemu di kantor => EXCLUDE.
export const RESIGNED_PICS = ['Ichwan', 'Safaa', 'Endah', 'Shafira'];

// Edge Function antor (usee-dashboard) — sumber data duplikat kantor.
export const USEE_DASHBOARD_URL = 'https://pghfhrbgagplszjymkts.supabase.co/functions/v1/usee-dashboard';

// Mode import yang diizinkan.
export const IMPORT_TYPES = ['Listing', 'Hijack'] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

// Sumber revenue KOL.
export const REVENUE_SOURCES = ['live', 'videos'] as const;
export type RevenueSource = (typeof REVENUE_SOURCES)[number];
