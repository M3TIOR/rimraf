/**
 * @author Isaac Z. Schlueter and Contributors
 * @license ISC
 */
"use strict";



// External Imports
import tap from "tap";
import glob from "glob";

// Internal Imports
import { rimraf, rimrafSync } from "../src/rimraf.js";
import fill from "./fill.js";

// Standard Imports
import { fileURLToPath } from 'url';
import { dirname } from "path";
import fs from "fs";


// eslint-disable-next-line 
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



tap.test('initial clean', (tap) => {
	rimrafSync(__dirname + '/target');
	tap.throws(() => fs.statSync(__dirname + '/target'));
	tap.end();
});

tap.test('sync removal', (tap) => {
	fill();
	tap.ok(fs.statSync(__dirname + '/target').isDirectory());

	rimrafSync(__dirname + '/target');
	tap.throws(() => fs.statSync(__dirname + '/target'));
	tap.end();
});

tap.test('async removal', (tap) => {
	fill();
	tap.ok(fs.statSync(__dirname + '/target').isDirectory());

	rimraf(__dirname + '/target', (er) => {
		if (er) throw er;

		tap.throws(() => fs.statSync(__dirname + '/target'));
		tap.end();
	});
});

tap.test('glob', (tap) => {
	tap.plan(2);
	tap.test('async', function (tap) {
		fill();

		const pattern = __dirname + '/target/f-*';
		const before = glob.sync(pattern);
		tap.notEqual(before.length, 0);

		rimraf(pattern, (er) => {
			if (er)
				throw er;

			const after = glob.sync(pattern);
			tap.same(after, []);
			rimrafSync(__dirname + '/target');

			tap.end();
		});
	});
	tap.test('sync', (tap) => {
		fill();

		const pattern = __dirname + '/target/f-*';
		const before = glob.sync(pattern);
		tap.notEqual(before.length, 0);
		rimrafSync(pattern);

		const after = glob.sync(pattern);
		tap.same(after, []);
		rimrafSync(__dirname + '/target');

		tap.end();
	});
});

tap.test('no glob', (tap) => {
	tap.plan(2);
	tap.test('async', (tap) => {
		fill();

		const pattern = __dirname + '/target/f-*';
		const before = glob.sync(pattern);
		tap.notEqual(before.length, 0);

		rimraf(pattern, { glob: false }, function (er) {
			if (er)
				throw er;

			const after = glob.sync(pattern);
			tap.same(after, before);
			rimrafSync(__dirname + '/target');

			tap.end();
		});
	});
	tap.test('sync', (tap) => {
		fill();

		const pattern = __dirname + '/target/f-*';
		const before = glob.sync(pattern);
		tap.notEqual(before.length, 0);
		rimrafSync(pattern, { glob: false });

		const after = glob.sync(pattern);
		tap.same(after, before);
		rimrafSync(__dirname + '/target');

		tap.end();
	});
});

tap.test('verify that cleanup happened', (tap) => {
	tap.throws(fs.statSync.bind(fs, __dirname + '/../target'));
	tap.throws(fs.statSync.bind(fs, __dirname + '/target'));
	tap.end();
});
