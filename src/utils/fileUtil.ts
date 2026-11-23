import { dirname } from "node:path";
import { writeFileSync, readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";

export class FileUtil {
	/**
	 * Writes data to a file
	 * @param path The path to the file
	 * @param data The data to write
	 */
	public static write(path: string, data: string) {
		this.ensureDir(dirname(path));
		writeFileSync(path, data);
	}

	/**
	 * Reads data from a file
	 * @param path The path to the file
	 */
	public static read(path: string) {
		return readFileSync(path).toString();
	}

	/**
	 * Appends data to a file
	 * @param path The path to the file
	 * @param data The data to append
	 */
	public static append(path: string, data: string) {
		this.ensureDir(dirname(path));
		appendFileSync(path, data);
	}

	public static readOptional(path: string) {
		return existsSync(path) ? this.read(path) : "";
	}

	/**
	 * Ensures that a directory exists
	 * @param path The path to the directory
	 */
	public static ensureDir(path: string) {
		mkdirSync(path, { recursive: true });
	}
}
