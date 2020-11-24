/**
 * @author Isaac Z. Schlueter and Contributors
 * @license ISC
 */
"use strict";



// External Imports
import tap from "tap";
import mkdirp from "mkdirp";

// Internal Imports
import { rimraf, rimrafSync } from "../src/rimraf.js";

// Standard Imports
import { spawn } from "child_process";
import { fileURLToPath } from 'url';
import path from "path";
import fs from "fs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



process.chdir(__dirname);

// track that all the things happened
let keepDirs = {};
let intercepted = {};

function intercept (method, path) {
	intercepted[method] = intercepted[method] || [];
	intercepted[method].push(path);
	intercepted[method] = intercepted[method].sort();
	intercepted._saved = intercepted._saved.sort();
	intercepted._removed = intercepted._removed.sort();
}

const expectAsync = {
	_removed: [
		'a',
		'a/x',
		'a/x/some-file.txt',
		'a/y',
		'a/y/some-file.txt',
		'a/z',
		'a/z/some-file.txt'
	],
	_saved: [
		'a',
		'a/x',
		'a/x/keep.txt',
		'a/y',
		'a/y/keep.txt',
		'a/z',
		'a/z/keep.txt'
	],
	_keepDirs: { 'a/x': true, 'a/y': true, 'a/z': true, a: true, '.': true },
	rmdir: [
		'a',
		'a',
		'a/x',
		'a/x',
		'a/y',
		'a/y',
		'a/z',
		'a/z'
	],
	unlink: [
		'a/x/keep.txt',
		'a/x/some-file.txt',
		'a/y/keep.txt',
		'a/y/some-file.txt',
		'a/z/keep.txt',
		'a/z/some-file.txt'
	]
};

const expectSync = {
	_removed: [
		'a',
		'a/x',
		'a/x/some-file.txt',
		'a/y',
		'a/y/some-file.txt',
		'a/z',
		'a/z/some-file.txt'
	],
	_saved: [
		'a',
		'a/x',
		'a/x/keep.txt',
		'a/y',
		'a/y/keep.txt',
		'a/z',
		'a/z/keep.txt'
	],
	_keepDirs: { 'a/x': true, a: true, 'a/y': true, 'a/z': true, '.': true },
	rmdirSync: [
		'a',
		'a',
		'a/x',
		'a/x',
		'a/y',
		'a/y',
		'a/z',
		'a/z'
	],
	unlinkSync: [
		'a/x/keep.txt',
		'a/x/some-file.txt',
		'a/y/keep.txt',
		'a/y/some-file.txt',
		'a/z/keep.txt',
		'a/z/some-file.txt'
	]
};


function shouldRemove (file) {
	if (file.match(/keep.txt$/) || keepDirs[file]) {
		// add the parent dir to keeps, to avoid ENOTEMPTY
		intercepted._saved.push(file);
		intercepted._saved = intercepted._saved.sort();
		keepDirs[path.dirname(file)] = true;
		return false;
	} else {
		intercepted._removed.push(file);
		intercepted._removed = intercepted._removed.sort();
		return true;
	}
}

var myFs = {
	unlink: function (file, cb) {
		intercept('unlink', file);
		if (shouldRemove(file)) {
			return fs.unlink(file, cb);
		} else {
			return cb();
		}
	},
	unlinkSync: function (file) {
		intercept('unlinkSync', file);
		if (shouldRemove(file)) {
			return fs.unlinkSync(file);
		}
	},
	rmdir: function (file, cb) {
		intercept('rmdir', file);
		if (shouldRemove(file)) {
			return fs.rmdir(file, cb);
		} else {
			return cb();
		}
	},
	rmdirSync: function (file) {
		intercept('rmdirSync', file);
		if (shouldRemove(file)) {
			return fs.rmdirSync(file);
		}
	}
};

function create () {
	intercepted = {};
	intercepted._removed = [];
	intercepted._saved = [];
	intercepted._keepDirs = keepDirs = {};
	mkdirp.sync('a')
	;['x', 'y', 'z'].forEach(function (j) {
		mkdirp.sync('a/' + j);
		fs.writeFileSync('a/' + j + '/some-file.txt', 'test\n');
		fs.writeFileSync('a/' + j + '/keep.txt', 'test\n');
	});
}

tap.test('setup', function (tap) {
	create();
	tap.end();
});

tap.test('rimraf with interceptor', function (tap) {
	rimraf('a', myFs, function (er) {
		if (er) {
			throw er;
		}
		tap.strictSame(intercepted, expectAsync);
		create();
		tap.end();
	});
});

tap.test('rimrafSync with interceptor', function (tap) {
	create();
	rimrafSync('a', myFs);
	tap.strictSame(intercepted, expectSync);
	create();
	tap.end();
});

tap.test('cleanup', function (tap) {
	rimrafSync('a');
	tap.throws(fs.statSync.bind(fs, 'a'));
	tap.end();
});
