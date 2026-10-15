import type { CreatorInput } from '../types';

const cleanHeader = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');
const dateValue = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : value.trim();
};

export function parseCreatorCsv(text: string): CreatorInput[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const separator = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const values = lines.map(line => line.split(separator).map(value => value.trim().replace(/^"|"$/g, '')));
  const headers = values[0].map(cleanHeader);
  const hasHeader = headers.some(value => ['date', 'id', 'creatorid', 'tiktok', 'tiktoklink', 'username', 'email'].includes(value));
  const rows = hasHeader ? values.slice(1) : values;
  const index = (names: string[]) => headers.findIndex(header => names.includes(header));
  const dateIndex = hasHeader ? index(['date']) : 0;
  const idIndex = hasHeader ? index(['id', 'creatorid']) : 1;
  const tiktokIndex = hasHeader ? index(['tiktok', 'tiktoklink', 'username']) : 2;
  const emailIndex = hasHeader ? index(['email']) : 3;
  return rows.map(row => {
    const username = tiktokIndex >= 0 ? row[tiktokIndex] ?? '' : '';
    const isUsername = hasHeader && headers[tiktokIndex] === 'username';
    return { date: dateValue(row[dateIndex] ?? ''), creatorId: idIndex >= 0 ? row[idIndex] ?? '' : '', tiktok: isUsername && username ? `https://www.tiktok.com/@${username.replace(/^@/, '')}` : username, email: emailIndex >= 0 ? row[emailIndex] ?? '' : '' };
  }).filter(row => row.date || row.creatorId || row.tiktok || row.email);
}

export function parseCreatorGrid(text: string): CreatorInput[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const values = lines.map(line => line.split(line.includes('\t') ? '\t' : ';').map(value => value.trim()));
  return values.map(row => ({
    date: dateValue(row[0] ?? ''),
    creatorId: row.length >= 4 ? row[1] ?? '' : '',
    tiktok: row.length >= 4 ? row[2] ?? '' : row[1] ?? '',
    email: row.length >= 4 ? row[3] ?? '' : row[2] ?? ''
  })).filter(row => row.date || row.creatorId || row.tiktok || row.email);
}
