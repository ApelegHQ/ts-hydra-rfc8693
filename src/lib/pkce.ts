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

const textEncoder = new TextEncoder();

const bbtoa = (b: Uint8Array) =>
	btoa(String.fromCharCode.apply(null, Array.from(b)))
		.split('+')
		.join('-')
		.split('/')
		.join('_')
		.replace(/={1,2}$/, '');

const generateRandomB64U = (l: number) => {
	const buf = new Uint8Array(l);
	globalThis.crypto.getRandomValues(buf);

	return bbtoa(buf);
};

const generateState = () => generateRandomB64U(6);

const generateChallenge = async (): Promise<[string, string]> => {
	const verifier = generateRandomB64U(33);

	const challenge = bbtoa(
		new Uint8Array(
			await globalThis.crypto.subtle.digest(
				{ ['name']: 'SHA-256' },
				textEncoder.encode(verifier),
			),
		),
	);

	return [verifier, challenge];
};

export { generateState, generateChallenge };
