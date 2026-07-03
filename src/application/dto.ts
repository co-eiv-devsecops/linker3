export interface ShortenRequest {
  url: string;
  alias?: string | null;
}

export interface ShortenResult {
  code: string;
}
