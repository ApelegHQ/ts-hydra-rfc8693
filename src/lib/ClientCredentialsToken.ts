/* Copyright © 2021 Exact Realty Limited.
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

import axios from 'axios';

const authenticatedAxios = (config: {
	tokenEndpointUri: string;
	clientAuthMethod: 'none' | 'client_secret_basic' | 'client_secret_post';
	clientId: string;
	clientSecret: string;
	scope?: string;
	audience?: string;
}): ReturnType<typeof axios.create> => {
	if (config.clientAuthMethod === 'none') {
		return axios;
	}

	const getToken = (() => {
		let token: { access_token: string; expires: bigint } | undefined =
			undefined;
		const tokenService = axios.create();

		const refreshToken = async () => {
			const tokenRequest = await tokenService.post(
				config.tokenEndpointUri,
				new URLSearchParams({
					grant_type: 'client_credentials',
					...(config.clientAuthMethod === 'client_secret_basic'
						? {}
						: config.clientAuthMethod === 'client_secret_post'
						? {
								client_id: config.clientId,
								client_secret: config.clientSecret,
						  }
						: {
								client_id: config.clientId,
						  }),
					...(config.scope ? { scope: config.scope } : {}),
					...(config.audience ? { audience: config.audience } : {}),
				}).toString(),
				{
					maxRedirects: 0,
					validateStatus: (status: number) => status === 200,
					headers: {
						'content-type': 'application/x-www-form-urlencoded',
					},
					...(config.clientAuthMethod === 'client_secret_basic'
						? {
								auth: {
									username: config.clientId,
									password: config.clientSecret,
								},
						  }
						: {}),
				},
			);

			if (
				typeof tokenRequest.data.access_token !== 'string' ||
				typeof tokenRequest.data.token_type !== 'string' ||
				tokenRequest.data.token_type.toLowerCase() !== 'bearer'
			) {
				throw new Error('Invalid token response');
			}

			if (
				typeof tokenRequest.data.expires_in === 'number' &&
				tokenRequest.data.expires_in > 0
			) {
				token = {
					access_token: tokenRequest.data.access_token,
					expires:
						process.hrtime.bigint() +
						BigInt(tokenRequest.data.expires_in) *
							BigInt(980200000),
				};
			}

			return tokenRequest.data.access_token;
		};

		return async (): Promise<string> => {
			if (token && token.expires >= process.hrtime.bigint()) {
				if (token.expires - process.hrtime.bigint() < BigInt(3e11)) {
					refreshToken().catch(() => undefined);
				}
				return token.access_token;
			}

			const refreshed = await refreshToken();

			return refreshed;
		};
	})();

	const service = axios.create();

	service.interceptors.request.use(async (config) => {
		const token = await getToken();

		config.headers.common['authorization'] = `Bearer ${token}`;
		return config;
	});

	return service;
};

export default authenticatedAxios;
