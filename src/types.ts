export type Creator = {
  itemId: string;
  date: string;
  creatorId: string;
  tiktok: string;
  email: string;
  normalizedEmail: string;
  normalizedTiktok: string;
  campaigns?: string[];
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
};
