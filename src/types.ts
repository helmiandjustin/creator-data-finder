import type { ImportType, RevenueSource } from './config/constants';

export type Creator = {
  itemId: string;
  date: string;
  creatorId: string;
  tiktok: string;
  email: string;
  normalizedEmail: string;
  normalizedTiktok: string;
  campaigns?: string[];
  // Detail pipeline
  revenue?: number | null;
  itemSold?: number | null;
  followers?: number | null;
  sourceRevenueKol?: RevenueSource | null;
  campaign?: string | null;
  type?: ImportType | null;
  source?: string | null;
};

export type BatchRow = {
  input: string;
  status: 'Found' | 'Not Found' | 'Duplicate Input' | 'Multiple Matches' | 'Invalid Input' | 'Error';
  record?: Creator;
  matches: Creator[];
  campaigns?: string[];
  error?: string;
};

export type CreatorInput = {
  date: string;
  creatorId: string;
  tiktok: string;
  email: string;
  // Detail pipeline (opsional)
  revenue?: number | null;
  itemSold?: number | null;
  followers?: number | null;
  sourceRevenueKol?: RevenueSource | null;
  campaign?: string | null;
  type?: ImportType | null;
  source?: string | null;
};
