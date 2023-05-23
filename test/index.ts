/* Copyright © 2023 Exact Realty Limited. All rights reserved.
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

import server, { listeners } from '@exact-realty/routemate';
import exchangeTokenEndpoint from '../src/index.js';

const exchangeTokenEndpointHandler = exchangeTokenEndpoint(
	'x', // hydraClientId
	undefined, // hydraClientSecret
	'none', // hydraTokenAuthMethod
	'about:invalid', // hydraClientRedirectUri
	'http://localhost:8846', // hydraPublicUri
	'http://localhost:8847', // hydraAdminUri
	{ ['clientAuthMethod']: 'none' }, // hydraPublicAuthParams
	{ ['clientAuthMethod']: 'none' }, // hydraAdminAuthParams
	(body) => ({
		['subject']: 'alice@example.com',
		['access_token']: {
			['body']: body.toString(),
		},
	}),
	[], // scope
	[], // audience
);

server(listeners.node)
	.listen(5678, '127.0.0.1')
	.then((r) => {
		const timeHandler = () =>
			new Response(null, {
				headers: [
					['cache-control', 'no-store'],
					['date', new Date().toUTCString()],
				],
			});

		r.head('/.well-known/time', timeHandler);
		r.get('/.well-known/time', timeHandler);
		r.post('/token', exchangeTokenEndpointHandler);
	});
