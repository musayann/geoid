export interface Level {
  label: string;
  name: string;
}

export interface Place {
  title: string;
  subtitle: string;
  levels: Level[];
}

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  altitude: number | null;
  altSource: string | null;
  place: Place | null;
  updatedAt: number;
}

export type Phase = 'acquiring' | 'live' | 'offline' | 'denied' | 'error' | 'unsupported';

export type CoordFormat = 'dd' | 'dms';
