/* Copyright © 2023 Apeleg Limited. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License") with LLVM
 * exceptions; you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://llvm.org/foundation/relicensing/LICENSE.txt
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const MAX_BODY_LENGTH = 131072;

const bodyParser = async (req: Readonly<Request>): Promise<URLSearchParams> => {
	if (
		req.headers.has('content-type') &&
		req.headers.get('content-type') !== 'application/x-www-form-urlencoded'
	) {
		throw 415;
	}

	if (!req.body || req.headers.get('content-length')?.match(/^$|[^0-9]/)) {
		throw 400;
	}

	const contentLength = Number(
		req.headers.get('content-length') ?? Number.NaN,
	);

	if (contentLength > MAX_BODY_LENGTH) {
		throw 413;
	}

	const chunks: Uint8Array[] = [];
	let bytesReceived = 0;

	for await (const chunk of req.body as unknown as AsyncIterable<Uint8Array>) {
		bytesReceived += chunk.byteLength;
		if (bytesReceived > contentLength || bytesReceived > MAX_BODY_LENGTH) {
			chunks.length = 0;
			await req.body.cancel();
			throw 413;
		}
		chunks.push(chunk);
	}

	return new URLSearchParams(await new Blob(chunks).text());
};

export default bodyParser;
