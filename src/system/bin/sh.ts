import { env_get } from '../lib/env.js';
import { exec } from '../lib/exec.js';
import { ErrorStrings, readdir } from '../lib/fs.js';
import { print, println, tty } from '../lib/io.js';
import { basename, pwd, parse, resolve } from '../lib/path.js';
import { User, _root, current_user } from '../lib/user.js';

/**
 * The index for which input is being shown
 */
let index: number = -1;

/**
 * The current, uncached input
 */
let currentInput: string = '';

/**
 * array of previous inputs
 */
const inputs: string[] = [];

let input: string = '';

let exit;

let user: User;
try {
	user = await current_user();
} catch (e) {
	user = _root;
	println('Current user lookup failed, defaulting to root.');
}

function prompt(): string {
	return `[${user.name} ${basename(pwd()) || '/'}]${user.uid == 0 ? '#' : '$'} `;
}

function clear(): void {
	print('\x1b[2K\r' + prompt());
}

async function on_data(data: string): Promise<void> {
	if (index == -1) {
		currentInput = input;
	}
	const promptLength = prompt().length;
	const x = tty.buffer.active.cursorX - promptLength;
	switch (data) {
		case '\x1b[D':
		case '\x1b[C':
			print(data);
			break;
		case 'ArrowUp':
		case '\x1b[A':
			clear();
			if (index < inputs.length - 1) {
				input = inputs[++index];
			}
			print(input);
			break;
		case 'ArrowDown':
		case '\x1b[B':
			clear();
			if (index >= 0) {
				input = index-- == 0 ? currentInput : inputs[index];
			}
			print(input);
			break;
		case '\x7f':
			if (x <= 0) {
				return;
			}
			print('\b\x1b[P');
			input = input.slice(0, x - 1) + input.slice(x);
			break;
		case '\r':
			println('');
			if (input != inputs[0]) {
				inputs.unshift(input);
			}
			index = -1;
			await on_line(...input.split(' '));
			input = '';
			clear();
			break;
		default:
			print(data);
			input = input.slice(0, x) + data + input.slice(x);
	}
}

async function on_line(...args: string[]): Promise<number> {
	const command: string = args.shift();

	if (command == 'exit') {
		exit(0);
		return;
	}

	let path: string;

	for (const dir of env_get('PATH').split(':')) {
		try {
			for (const file of await readdir(dir)) {
				if (parse(file).name == command) {
					path = resolve(dir, file);
					break;
				}
			}
		} finally {
			// ignore directories that can't be stated
		}
	}

	if (!path) {
		println('Command does not exist');
		return 1;
	}

	try {
		return await exec(path, ...args);
	} catch (e) {
		println('errno' in e ? ErrorStrings[e.errno] : e.message);
	}
}

export default function main(...args: string[]): Promise<number> {
	tty.write('\x1b[4h');
	tty.focus();
	tty.onData(on_data);
	clear();
	return new Promise(resolve => {
		exit = resolve;
	});
}