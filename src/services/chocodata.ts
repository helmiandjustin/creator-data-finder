const API_URL = 'https://api.chocodata.com/api/v1/tiktok/email';

export type ChocoResult = {
  username: string;
  email: string;
  status: 'Found' | 'Not Found' | 'Auth Error' | 'Error';
};

export const cleanTikTokUsername = (value: string) => value.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].toLowerCase();

export async function lookupChocodata(value: string, apiKey: string): Promise<ChocoResult> {
  const username = cleanTikTokUsername(value);
  if (!username) return { username: value, email: '', status: 'Error' };
  if (!apiKey.trim()) throw new Error('Masukkan API key Chocodata terlebih dahulu.');
  const params = new URLSearchParams({ api_key: apiKey.trim(), username, url: `https://www.tiktok.com/@${username}`, country: 'us' });
  const response = await fetch(`${API_URL}?${params}`);
  if (response.status === 401 || response.status === 403) return { username, email: '', status: 'Auth Error' };
  if (!response.ok) return { username, email: '', status: 'Error' };
  const data = await response.json();
  const email = JSON.stringify(data).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i)?.[0]?.toLowerCase() ?? '';
  return { username, email, status: email ? 'Found' : 'Not Found' };
}
