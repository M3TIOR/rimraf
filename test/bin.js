/**
 * @author Isaac Z. Schlueter and Contributors
 * @license ISC
 */
"use strict";



// External Imports
import tap from "tap";
import mkdirp from "mkdirp";

// Internal Imports
import { rimrafSync } from "../src/rimraf.js";

// Standard Imports
import { spawn } from "child_process";
import { fileURLToPath } from 'url';
import path from "path";
import fs from "fs";


// eslint-disable-next-line
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bin = path.join(__dirname, "../cli/bin.mjs");
const node = process.execPath;



tap.test('setup', (tap) => {
	rimrafSync(__dirname + '/bintest');
	mkdirp.sync(__dirname + '/bintest');
	process.chdir(__dirname + '/bintest');
	mkdirp.sync('a/b/c');
	mkdirp.sync('x/y/z');
	fs.writeFileSync('a/1.txt', '\n');
	fs.writeFileSync('a/2.txt', '\n');
	fs.writeFileSync('a/3.txt', '\n');
	fs.writeFileSync('a/*.txt', '\n');
	fs.writeFileSync('a/b/1.txt', '\n');
	fs.writeFileSync('a/b/2.txt', '\n');
	fs.writeFileSync('a/b/3.txt', '\n');
	fs.writeFileSync('a/b/*.txt', '\n');
	fs.writeFileSync('a/b/c/1.txt', '\n');
	fs.writeFileSync('a/b/c/2.txt', '\n');
	fs.writeFileSync('a/b/c/3.txt', '\n');
	fs.writeFileSync('a/b/c/*.txt', '\n');
	fs.writeFileSync('x/1.txt', '\n');
	fs.writeFileSync('x/2.txt', '\n');
	fs.writeFileSync('x/3.txt', '\n');
	fs.writeFileSync('x/*.txt', '\n');
	fs.writeFileSync('x/y/1.txt', '\n');
	fs.writeFileSync('x/y/2.txt', '\n');
	fs.writeFileSync('x/y/3.txt', '\n');
	fs.writeFileSync('x/y/*.txt', '\n');
	fs.writeFileSync('x/y/z/1.txt', '\n');
	fs.writeFileSync('x/y/z/2.txt', '\n');
	fs.writeFileSync('x/y/z/3.txt', '\n');
	fs.writeFileSync('x/y/z/*.txt', '\n');
	tap.end();
});

tap.test('help', (tap) => {
	const helps = ['-help', '-h', '--help', '--?'];
	tap.plan(helps.length);

	helps.forEach((h) => tap.test(h, testHelp.bind(null, h)));

	// Function body resolution and scope assignment prior to overhead call.
	const testHelp = (helpArgVariant, tap) => {
		const child = spawn(node, [bin, helpArgVariant]);
		let out = '';
		child.stdout.on('data', (c) => out += c);
		child.on('close', (code, signal) => {
			tap.equal(code, 0);
			tap.equal(signal, null);
			tap.match(out, /^Usage: rimraf <path> \[<path> \.\.\.\]/);
			tap.end();
		});
	};
});

tap.test('glob, but matches', (tap) => {
	const child = spawn(node, [bin, 'x/y/*.txt']);
	child.on('exit', (code) => {
		tap.equal(code, 0);
		tap.throws(fs.statSync.bind(fs, 'x/y/*.txt'));
		tap.doesNotThrow(fs.statSync.bind(fs, 'x/y/1.txt'));
		tap.end();
	});
});

tap.test('--no-glob', (tap) => {
	tap.plan(2);
	tap.test('no glob with *.txt', (tap) => {
		const child = spawn(node, [bin, 'x/y/*.txt', '-G']);
		child.on('exit', (code) => {
			tap.equal(code, 0);
			tap.throws(fs.statSync.bind(fs, 'x/y/*.txt'));
			tap.doesNotThrow(fs.statSync.bind(fs, 'x/y/1.txt'));
			tap.end();
		});
	});
	tap.test('no glob with dir star', (tap) => {
		const child = spawn(node, [bin, '**/*.txt', '-G']);
		child.on('exit', (code) => {
			tap.equal(code, 0);
			tap.throws(fs.statSync.bind(fs, 'x/y/*.txt'));
			tap.doesNotThrow(fs.statSync.bind(fs, 'x/y/1.txt'));
			tap.end();
		});
	});
});

tap.test('glob, but no exact match', (tap) => {
	const child = spawn(node, [bin, 'x/y/*.txt']);
	child.on('exit', (code) => {
		tap.equal(code, 0);
		tap.throws(fs.statSync.bind(fs, 'x/y/1.txt'));
		tap.throws(fs.statSync.bind(fs, 'x/y/2.txt'));
		tap.throws(fs.statSync.bind(fs, 'x/y/3.txt'));
		tap.throws(fs.statSync.bind(fs, 'x/y/*.txt'));
		tap.end();
	});
});

tap.test('cleanup', (tap) => {
	rimrafSync(__dirname + '/bintest');
	tap.end();
});
