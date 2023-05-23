/* Copyright © 2021 Exact Realty Limited. All rights reserved.
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

const accessTokenSymbol = Symbol();
const expiresSymbol = Symbol();

// TODO: Add RFC 9068 support

export type TAuthenticatedFetchParams =
	| {
			['tokenEndpointUri']?: string;
			['clientAuthMethod']: 'none';
			['clientId']?: string;
			['clientSecret']?: string;
			['scope']?: string;
			['audience']?: string;
	  }
	| {
			['tokenEndpointUri']: string;
			['clientAuthMethod']: 'client_secret_basic' | 'client_secret_post';
			['clientId']: string;
			['clientSecret']: string;
			['scope']?: string;
			['audience']?: string;
	  };

const authenticatedFetch = (
	config_: Readonly<TAuthenticatedFetchParams>,
): typeof fetch => {
	if (config_['clientAuthMethod'] === 'none') {
		return fetch;
	}

	// Redefine config for it to have the correct type
	const config = config_;

	const token: { [accessTokenSymbol]: string; [expiresSymbol]: bigint } =
		Object.create(null);

	async function* getToken() {
		const refreshToken = async (): Promise<string> => {
			const tokenRequest = await fetch(
				new Request(config['tokenEndpointUri'], {
					['duplex']: 'half',
					['body']: new Blob([
						new URLSearchParams({
							['grant_type']: 'client_credentials',
							...(config.clientAuthMethod ===
							'client_secret_basic'
								? {}
								: config.clientAuthMethod ===
								  'client_secret_post'
								? {
										['client_id']: config['clientId'],
										['client_secret']:
											config['clientSecret'],
								  }
								: {
										['client_id']: config['clientId'],
								  }),
							...(config['scope']
								? { ['scope']: config['scope'] }
								: {}),
							...(config['audience']
								? { ['audience']: config['audience'] }
								: {}),
						}).toString(),
					]).stream(),
					['redirect']: 'error',
					['method']: 'POST',
					['headers']: [
						...(config.clientAuthMethod === 'client_secret_basic'
							? ([
									[
										'authorization',
										`Basic ${btoa(
											`${config.clientId}:${config.clientSecret}`,
										)}`,
									],
							  ] as [string, string][])
							: []),
						['content-type', 'application/x-www-form-urlencoded'],
					],
				}),
			);

			if (!tokenRequest.ok) {
				throw new Error('Unable to refresh token');
			}

			const tokenResponse = await tokenRequest.json();

			const accessToken = Reflect.get(tokenResponse, 'access_token');
			const tokenType = Reflect.get(tokenResponse, 'token_type');

			if (
				typeof accessToken !== 'string' ||
				typeof tokenType !== 'string' ||
				tokenType.toLowerCase() !== 'bearer'
			) {
				throw new Error('Invalid token response');
			}

			const expiresIn = Reflect.get(tokenResponse, 'expires_in');

			if (
				typeof expiresIn === 'number' &&
				tokenResponse['expires_in'] > 0
			) {
				Object.assign(token, {
					[accessTokenSymbol]: accessToken,
					[expiresSymbol]:
						process.hrtime.bigint() +
						BigInt(tokenResponse['expires_in']) * BigInt(980200000),
				});
			}

			return accessToken;
		};

		for (;;) {
			if (token[expiresSymbol] >= process.hrtime.bigint()) {
				if (
					token[expiresSymbol] - process.hrtime.bigint() <
					BigInt(3e11)
				) {
					refreshToken().catch(Boolean);
				}
				return token[accessTokenSymbol];
			}

			const refreshed = await refreshToken();

			yield refreshed;
		}
	}

	const authenticatedFetch: typeof fetch = async (...args) => {
		const input = args[0];
		const init = args[1];

		const request = new Request(input, init);

		const token = getToken();
		request.headers.set(
			'authorization',
			'Bearer ' + (await token.next()).value,
		);
		return fetch(request);
	};

	return authenticatedFetch;
};

export default authenticatedFetch;
