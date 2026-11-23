export function requiredEnv(key: string, trim = true): string {
	const raw = process.env[key];
	const value = trim ? raw?.trim() : raw;
	if (!value) throw new Error(`Missing required environment variable: ${key}`);
	return value;
}

export function fontSize(): number {
	const size = Number(requiredEnv("FONT_SIZE"));
	if (!Number.isFinite(size) || size <= 0) throw new Error("FONT_SIZE must be a positive number");
	return size;
}
