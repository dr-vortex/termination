import { mkdir } from '../lib/fs.js';
import { println } from '../lib/io.js';

export async function main(_: string, dir: string): Promise<number> {
	if (!dir) {
		println('No directory specified');
		return 1;
	}
	await mkdir(dir);
	return 0;
}
