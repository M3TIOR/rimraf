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


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



tap.test('initial clean', function (tap) {
	rimrafSync(__dirname + '/target');
	tap.throws(function () {
		fs.statSync(__dirname + '/target');
	});
	tap.end();
});

tap.test('sync removal', function (tap) {
	fill();
	tap.ok(fs.statSync(__dirname + '/target').isDirectory());

	rimrafSync(__dirname + '/target');
	tap.throws(function () {
		fs.statSync(__dirname + '/target');
	});
	tap.end();
});

tap.test('async removal', function (tap) {
	fill();
	tap.ok(fs.statSync(__dirname + '/target').isDirectory());

	rimraf(__dirname + '/target', function (er) {
		if (er)
			throw er;
		tap.throws(function () {
			fs.statSync(__dirname + '/target');
		});
		tap.end();
	});
});

tap.test('glob', function (tap) {
	tap.plan(2);
	tap.test('async', function (tap) {
		fill();
		var pattern = __dirname + '/target/f-*';
		var before = glob.sync(pattern);
		tap.notEqual(before.length, 0);
		rimraf(pattern, function (er) {
			if (er)
				throw er;
			var after = glob.sync(pattern);
			tap.same(after, []);
			rimrafSync(__dirname + '/target');
			tap.end();
		});
	});
	tap.test('sync', function (tap) {
		fill();
		var pattern = __dirname + '/target/f-*';
		var before = glob.sync(pattern);
		tap.notEqual(before.length, 0);
		rimrafSync(pattern);
		var after = glob.sync(pattern);
		tap.same(after, []);
		rimrafSync(__dirname + '/target');
		tap.end();
	});
});

tap.test('no glob', function (tap) {
	tap.plan(2);
	tap.test('async', function (tap) {
		fill();
		var pattern = __dirname + '/target/f-*';
		var before = glob.sync(pattern);
		tap.notEqual(before.length, 0);
		rimraf(pattern, { disableGlob: true }, function (er) {
			if (er)
				throw er;
			var after = glob.sync(pattern);
			tap.same(after, before);
			rimrafSync(__dirname + '/target');
			tap.end();
		});
	});
	tap.test('sync', function (tap) {
		fill();
		var pattern = __dirname + '/target/f-*';
		var before = glob.sync(pattern);
		tap.notEqual(before.length, 0);
		rimrafSync(pattern, { disableGlob: true });
		var after = glob.sync(pattern);
		tap.same(after, before);
		rimrafSync(__dirname + '/target');
		tap.end();
	});
});

tap.test('verify that cleanup happened', function (tap) {
	tap.throws(fs.statSync.bind(fs, __dirname + '/../target'));
	tap.throws(fs.statSync.bind(fs, __dirname + '/target'));
	tap.end();
});
