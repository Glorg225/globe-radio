export interface RawStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  countrycode: string;
  language: string;
  languagecodes: string;
  votes: number;
  clickcount: number;
  lastcheckok: number;
  hls: number;
  geo_lat: number | null;
  geo_long: number | null;
  state: string;
}

export interface Station {
  id: string;
  name: string;
  url: string;
  lat: number;
  lon: number;
  approx: boolean;
  cc: string;
  state: string;
  langs: string[];
  tags: string[];
  votes: number;
  clicks: number;
  favicon: string;
  hls: boolean;
}

export type CompactStation = [
  id: string, name: string, url: string, lat: number, lon: number, approx: 0 | 1, cc: string, state: string,
  langs: string, tags: string, votes: number, clicks: number, favicon: string, hls: 0 | 1,
];

export type Centroids = Record<string, [lat: number, lon: number]>;
