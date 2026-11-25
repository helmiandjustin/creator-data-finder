/**
 * Cloudflare Pages Function — proxy read-only ke Edge Function kantor
 * (usee-dashboard). Menyembunyikan URL asli dari frontend, dan menambahkan
 * cache untuk data read-only.
 *
 * Frontend memanggil: /api/v1/usee?__api=<params>
 * Diteruskan ke:      env.USEE_DASHBOARD_URL?__api=<params>
 *
 * Jika env.USEE_DASHBOARD_URL tidak di-set, kembalikan 503 (frontend
 * akan fallback ke URL langsung bila proxy tidak dikonfigurasi).
 */

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;

  const upstreamBase = env.USEE_DASHBOARD_URL;
  if (!upstreamBase) {
    return new Response(JSON.stringify({ error: 'Proxy not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);

  // Hanya terima GET (read-only).
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const target = `${upstreamBase}?${url.searchParams.toString()}`;

  let upstreamRes;
  try {
    upstreamRes = await fetch(target);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await upstreamRes.text();

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  // Cache read-only: 60 detik di CDN, 15 detik di browser.
  // Hanya cache respons sukses.
  if (upstreamRes.ok) {
    headers.set('Cache-Control', 'public, s-maxage=60, max-age=15');
  } else {
    headers.set('Cache-Control', 'no-store');
  }

  return new Response(body, {
    status: upstreamRes.status,
    headers,
  });
}
