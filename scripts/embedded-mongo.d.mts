export function isEmbeddedUrl(url: string, port: number): boolean;
export function embeddedUrl(port: number, dbName: string): string;
export function startEmbeddedMongo(opts: { port: number; dbPath: string; fresh?: boolean; log?: (msg: string) => void }): Promise<{ stop: () => Promise<void> }>;
export function hasUsers(url: string): Promise<boolean>;
