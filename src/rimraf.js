/**
 * @author Isaac Z. Schlueter and Contributors
 * @summary Implements the unix "rm -rf [folder]" command as a javascript function.
 * @license ISC
 *   <p><strong>Copyright (c) Isaac Z. Schlueter and Contributors</strong></p>
 *
 *   <p>
 *     Permission to use, copy, modify, and/or distribute this software for any
 *     purpose with or without fee is hereby granted, provided that the above
 *     copyright notice and this permission notice appear in all copies.
 *
 *   <ul style="list-style-type: disc;">
 *     <li>
 *       The above copyright notice and this permission notice shall be included in all
 *       copies or substantial portions of the Software.
 *     </li>
 *
 *     <li>
 *       THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 *       WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 *       MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 *       ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 *       WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 *       ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
 *       IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *     </li>
 *   </ul></p>
 */
"use strict";


// External Imports
import glob from "glob";

// Internal Imports
//...

// Standard Imports
import assert from "assert";
import path from "path";
import fs from "fs";



// Module Globals
const isWindows = (process.platform === "win32");
const fsMethods = [
	// fs methods that can be be overriden by the user.
	'unlink', 'chmod', 'stat', 'lstat', 'rmdir', 'readdir'
];
// for EMFILE handling
let timeout = 0;



/** @internal */
function assignOptionDefaults(options) {
	fsMethods.forEach(m => {
		const mSync = `${m}Sync`;

		options[m] = options[m] || fs[m];
		options[mSync] = options[mSync] || fs[mSync];
	});

	options.maxBusyTries = options.maxBusyTries || 3;
	options.emfileWait = options.emfileWait || 1000;

	if (typeof options.glob === "object") {
		// Otherwise allow options values to override the defautls.
		options.glob = Object.assign({
			nosort: true,
			silent: true
		}, options.glob);
	}
	else if (options.glob || options.glob == null) {
		options.glob = {
			nosort: true,
			silent: true
		};
	}

}

/** @internal */
function _rimraf(p, options, cb) {
	// NOTE:
	//   Two possible strategies.
	//   1. Assume it's a file; unlink it, then do the dir stuff on EPERM or EISDIR
	//   2. Assume it's a directory; readdir, then do the file stuff on ENOTDIR
	//
	//   Both result in an extra syscall when you guess wrong.  However, there
	//   are likely far more normal files in the world than directories.  This
	//   is based on the assumption that a the average number of files per
	//   directory is >= 1.
	//
	//   If anyone ever complains about this, then I guess the strategy could
	//   be made configurable somehow.  But until then, YAGNI.

	assert(p);
	assert(options);
	assert(typeof cb === 'function');

	// sunos lets the root user unlink directories, which is... weird.
	// so we have to lstat here and make sure it's not a dir.
	options.lstat(p, (er, st) => {
		if (er && er.code === "ENOENT")
			return cb(null);

		// Windows can EPERM on stat.  Life is suffering.
		if (er && er.code === "EPERM" && isWindows)
			fixWinEPERM(p, options, er, cb);

		if (st && st.isDirectory())
			return rmdir(p, options, er, cb);

		options.unlink(p, er => {
			if (er) {
				if (er.code === "ENOENT")
					return cb(null);
				if (er.code === "EPERM")
					return (isWindows)
						? fixWinEPERM(p, options, er, cb)
						: rmdir(p, options, er, cb);
				if (er.code === "EISDIR")
					return rmdir(p, options, er, cb);
			}
			return cb(er);
		});
	});
}

/** @internal */
function fixWinEPERM(p, options, er, cb) {
	assert(p);
	assert(options);
	assert(typeof cb === 'function');

	options.chmod(p, 0o666, er2 => {
		if (er2)
			cb(er2.code === "ENOENT" ? null : er);
		else
			options.stat(p, (er3, stats) => {
				if (er3)
					cb(er3.code === "ENOENT" ? null : er);
				else if (stats.isDirectory())
					rmdir(p, options, er, cb);
				else
					options.unlink(p, cb);
			});
	});
}

/** @internal */
function fixWinEPERMSync(p, options, er) {
	assert(p);
	assert(options);

	try {
		options.chmodSync(p, 0o666);
	} catch (er2) {
		if (er2.code === "ENOENT")
			return;
		else
			throw er;
	}

	let stats;
	try {
		stats = options.statSync(p);
	} catch (er3) {
		if (er3.code === "ENOENT")
			return;
		else
			throw er;
	}

	if (stats.isDirectory())
		rmdirSync(p, options, er);
	else
		options.unlinkSync(p);
}

/** @internal */
function rmdir(p, options, originalEr, cb) {
	assert(p);
	assert(options);
	assert(typeof cb === 'function');

	// try to rmdir first, and only readdir on ENOTEMPTY or EEXIST (SunOS)
	// if we guessed wrong, and it's not a directory, then
	// raise the original error.
	options.rmdir(p, er => {
		if (er && (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM"))
			rmkids(p, options, cb);
		else if (er && er.code === "ENOTDIR")
			cb(originalEr);
		else
			cb(er);
	});
}

/** @internal */
function rmkidsSync(p, options) {
	assert(p);
	assert(options);
	options.readdirSync(p).forEach(f => rimrafSync(path.join(p, f), options));

	// We only end up here once we got ENOTEMPTY at least once, and
	// at this point, we are guaranteed to have removed all the kids.
	// So, we know that it won't be ENOENT or ENOTDIR or anything else.
	// try really hard to delete stuff on windows, because it has a
	// PROFOUNDLY annoying habit of not closing handles promptly when
	// files are deleted, resulting in spurious ENOTEMPTY errors.
	const retries = isWindows ? 100 : 1;
	let i = 0;
	do {
		let threw = true;
		try {
			const ret = options.rmdirSync(p, options);
			threw = false;
			return ret;
		} finally {
			if (++i < retries && threw)
				continue; // eslint-disable-line
		}
	} while (true); // eslint-disable-line
}

/** @internal */
function rmkids(p, options, cb) {
	assert(p);
	assert(options);
	assert(typeof cb === 'function');

	options.readdir(p, (er, files) => {
		if (er)
			return cb(er);
		let n = files.length;
		if (n === 0)
			return options.rmdir(p, cb);
		let errState;
		files.forEach(f => {
			rimraf(path.join(p, f), options, er => {
				if (errState)
					return;
				if (er)
					return cb(errState = er);
				if (--n === 0)
					options.rmdir(p, cb);
			});
		});
	});
}

/** @internal */
function rmdirSync(p, options, originalEr) {
	assert(p);
	assert(options);

	try {
		options.rmdirSync(p);
	} catch (er) {
		if (er.code === "ENOENT")
			return;
		if (er.code === "ENOTDIR")
			throw originalEr;
		if (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM")
			rmkidsSync(p, options);
	}
}

/**
 * @callback errorQueryCallback
 * @param err {Error}
 */

/**
 * @param {string} pathOrGlob - The target['s] to be removed by rimraf.
 * @param {(object|Function)} options - Holds the following configuration options;
 * You may also pass native filesystem method replacements into this object
 * and they will be used by rimraf over the their native implementations.
 * Additionally, supply a function as this argument, and it will be treated
 * as the callback option instead; omitting the third argument entierely.
 * @param {(object|boolean)} options.glob - Options passed directly to the glob
 * parser use by rimraf. See (https://www.npmjs.com/package/glob) for more
 * info. To disable glob patterns, pass a falsy value.
 * @param {number} options.maxBusyTries - If an `EBUSY`, `ENOTEMPTY`, or `EPERM`
 * error code is encountered on Windows systems, then rimraf will retry with
 * a linear backoff wait of 100ms longer on each try.
 * The default maxBusyTries is 3.
 * @param {number} options.emfileWait - If an `EMFILE` error is encountered,
 * then rimraf will retry repeatedly with a linear backoff of 1ms longer
 * on each try, until the timeout counter hits this max.
 * The default limit is 1000.
 *
 * If you repeatedly encounter `EMFILE` errors, then consider using
 * (http://npm.im/graceful-fs) in your program.
 * @param {errorQueryCallback} cb - A callback function to pass execution to once
 * rimraf is finished executing, optionally accepting an error code to handle.
 * @returns {undefined}
 */
function rimraf(pathOrGlob, options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	}

	assert(pathOrGlob, 'rimraf: missing path');
	assert.equal(typeof pathOrGlob, 'string', 'rimraf: path should be a string');
	assert.equal(typeof cb, 'function', 'rimraf: callback function required');
	assert(options, 'rimraf: invalid options argument provided');
	assert.equal(typeof options, 'object', 'rimraf: options should be object');

	assignOptionDefaults(options);

	let busyTries = 0;
	let errState = null;
	let n = 0;

	const next = (er) => {
		errState = errState || er;
		if (--n === 0)
			cb(errState);
	};

	const afterGlob = (er, results) => {
		if (er)
			return cb(er);

		n = results.length;
		if (n === 0)
			return cb();

		results.forEach(p => {
			const CB = (er) => {
				if (er) {
					if ((er.code === "EBUSY" || er.code === "ENOTEMPTY" || er.code === "EPERM") &&
              busyTries < options.maxBusyTries) {
						busyTries ++;
						// try again, with the same exact callback as this one.
						return setTimeout(() => _rimraf(p, options, CB), busyTries * 100);
					}

					// this one won't happen if graceful-fs is used.
					if (er.code === "EMFILE" && timeout < options.emfileWait) {
						return setTimeout(() => _rimraf(p, options, CB), timeout ++);
					}

					// already gone
					if (er.code === "ENOENT") er = null;
				}

				timeout = 0;
				next(er);
			};
			_rimraf(p, options, CB);
		});
	};

	if (!options.glob || !glob.hasMagic(pathOrGlob))
		return afterGlob(null, [pathOrGlob]);

	options.lstat(pathOrGlob, (er) => {
		if (!er)
			return afterGlob(null, [pathOrGlob]);

		glob(pathOrGlob, options.glob, afterGlob);
	});

}

// this looks simpler, and is strictly *faster*, but will
// tie up the JavaScript thread and fail on excessively
// deep directory trees.
/**
 * @param {string} pathOrGlob - The target['s] to be removed by rimraf.
 * @param {(object|Function)} options - Holds the following configuration options;
 * You may also pass native filesystem method replacements into this object
 * and they will be used by rimraf over the their native implementations.
 * Additionally, supply a function as this argument, and it will be treated
 * as the callback option instead; omitting the third argument entierely.
 * @param {(object|boolean)} options.glob - Options passed directly to the glob
 * parser use by rimraf. See (https://www.npmjs.com/package/glob) for more
 * info. To disable glob patterns, pass a falsy value.
 * @returns {undefined}
 */
function rimrafSync(pathOrGlob, options) {
	options = options || {};
	assignOptionDefaults(options);

	assert(pathOrGlob, 'rimraf: missing path');
	assert.equal(typeof pathOrGlob, 'string', 'rimraf: path should be a string');
	assert(options, 'rimraf: missing options');
	assert.equal(typeof options, 'object', 'rimraf: options should be object');

	let results;

	if (!options.glob || !glob.hasMagic(pathOrGlob)) {
		results = [pathOrGlob];
	} else {
		try {
			options.lstatSync(pathOrGlob);
			results = [pathOrGlob];
		} catch (er) {
			results = glob.sync(pathOrGlob, options.glob);
		}
	}

	if (!results.length)
		return;

	for (let i = 0; i < results.length; i++) {
		const p = results[i];

		let st;
		try {
			st = options.lstatSync(p);
		} catch (er) {
			if (er.code === "ENOENT")
				return;

			// Windows can EPERM on stat.  Life is suffering.
			if (er.code === "EPERM" && isWindows)
				fixWinEPERMSync(p, options, er);
		}

		try {
			// sunos lets the root user unlink directories, which is... weird.
			if (st && st.isDirectory())
				rmdirSync(p, options, null);
			else
				options.unlinkSync(p);
		} catch (er) {
			if (er.code === "ENOENT")
				return;
			if (er.code === "EPERM")
				return isWindows ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er);
			if (er.code !== "EISDIR")
				throw er;

			rmdirSync(p, options, er);
		}
	}
}



export default rimraf;
export {
	rimraf,
	rimrafSync,
};
