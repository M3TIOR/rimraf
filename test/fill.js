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
import { fileURLToPath } from 'url';
import { dirname } from "path";
import fs from "fs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



// if (module === require.main) {
// 	require('tap').pass('yes');
// 	return;
// }

function fill (depth, files, folders, target) {
	mkdirp.sync(target);
	var o = { flag: 'wx' };
	if (process.version.match(/^v0\.8/))
		o = 'utf8';

	for (var f = files; f > 0; f--) {
		fs.writeFileSync(target + '/f-' + depth + '-' + f, '', o);
	}

	// valid symlink
	fs.symlinkSync('f-' + depth + '-1', target + '/link-' + depth + '-good', 'file');

	// invalid symlink
	fs.symlinkSync('does-not-exist', target + '/link-' + depth + '-bad', 'file');

	// file with a name that looks like a glob
	fs.writeFileSync(target + '/[a-z0-9].txt', '', o);

	depth--;
	if (depth <= 0)
		return;

	for (f = folders; f > 0; f--) {
		mkdirp.sync(target + '/folder-' + depth + '-' + f);
		fill(depth, files, folders, target + '/d-' + depth + '-' + f);
	}
}

// This should always pass. Perhaps make separate location for helper files
// so we don't have to explicitly implement a tap call?
tap.pass("yes!");
export default () => fill(4, 10, 2, __dirname + '/target');
