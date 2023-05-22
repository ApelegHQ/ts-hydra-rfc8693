#!/usr/bin/env node

/* Copyright © 2023 Exact Realty Limited. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License") with LLVM
 * exceptions; you may not use this file except in compliance with the
 * License.You may obtain a copy of the License at
 *
 * http://llvm.org/foundation/relicensing/LICENSE.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import esbuild from 'esbuild';

const buildOptionsBase = {
	entryPoints: ['./src/index.ts'],
	target: 'es2018',
	outdir: 'dist',
	bundle: true,
	minify: true,
	entryNames: '[name]',
	platform: 'node',
	external: ['esbuild'],
};

const formats = ['cjs', 'esm'];

await Promise.resolve(
	formats.map((format) => {
		return esbuild.build({
			...buildOptionsBase,
			format,
			outExtension: {
				'.js': format === 'esm' ? '.mjs' : '.js',
			},
		});
	}),
);
