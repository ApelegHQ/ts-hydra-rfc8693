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

// Object.freeze(Object.prototype);
// Object.freeze(Object);

import { AdminApi, Configuration } from '@ory/hydra-client';
import axios from 'axios';
import config from 'config';
import crypto from 'crypto';
import http from 'http';
import { URLSearchParams } from 'url';
import authenticatedAxios from './lib/ClientCredentialsToken';
import { log } from './lib/Logger';

const generateState = () => {
	return crypto
		.randomBytes(6)
		.toString('base64')
		.split('+')
		.join('-')
		.split('/')
		.join('_');
};

const generateChallenge = (): [string, string] => {
	const verifier = crypto
		.randomBytes(33)
		.toString('base64')
		.split('+')
		.join('-')
		.split('/')
		.join('_')
		.split('=')
		.join('');

	const challenge = crypto
		.createHash('sha256')
		.update(verifier)
		.digest()
		.toString('base64')
		.split('+')
		.join('-')
		.split('/')
		.join('_')
		.split('=')
		.join('');

	return [verifier, challenge];
};

const getOrigin = (uri?: string | null): string | null => {
	if (!uri) {
		return null;
	}

	try {
		const url = new URL(uri);
		return url.origin;
	} catch {
		return null;
	}
};

const configDump = config.util.extendDeep(config.util.toObject(), {
	server: {
		oauth2: {
			client: {
				secret: '***',
			},
		},
	},
	hydra: {
		client: {
			secret: '***',
		},
	},
});

log.info({ config: JSON.stringify(configDump) });

const originLookupUri = String(config.get('originLookup.uri') ?? '');
const originLookupParameter = String(
	config.get('originLookup.parameter') ?? '',
);

const hydraPublicUri = String(config.get('hydra.public') ?? '');
const hydraTokenAuthMethod = String(
	config.get('hydra.client.tokenAuthMethod') ?? 'client_secret_basic',
);
const hydraClientId = String(config.get('hydra.client.id') ?? '');
const hydraClientSecret = String(config.get('hydra.client.secret') ?? '');
const hydraClientRedirectUri = String(
	config.get('hydra.client.redirectUri') ?? 'about:invalid',
);
const hydraScope = String(config.get('hydra.scope') ?? '')
	.split(' ')
	.filter((v) => v.length);
const hydraAudience = config.get('hydra.audience');
const hydraSessionAccessTokenExtra = config.get(
	'hydra.sessionAccessTokenExtra',
);

if (!originLookupUri || !getOrigin(originLookupUri)) {
	log.fatal({ hydraPublicUri }, 'Invalid origin lookup URI');
	process.exit(1);
}

if (!originLookupParameter) {
	log.fatal({ hydraPublicUri }, 'Invalid origin lookup parameter');
	process.exit(1);
}

if (!hydraPublicUri || !getOrigin(hydraPublicUri)) {
	log.fatal({ hydraPublicUri }, 'Invalid Hydra public URI');
	process.exit(1);
}

if (
	!['client_secret_basic', 'client_secret_post', 'none'].includes(
		hydraTokenAuthMethod,
	)
) {
	log.fatal(
		{ hydraTokenAuthMethod },
		'Invalid Hydra token endpoint auth method',
	);
	process.exit(1);
}

if (!hydraClientId) {
	log.fatal({ hydraClientId }, 'Invalid Hydra client ID');
	process.exit(1);
}

if (hydraTokenAuthMethod === 'none' && hydraClientSecret) {
	log.fatal('Invalid Hydra secret (must be empty for public clients)');
}

if (hydraTokenAuthMethod !== 'none' && !hydraClientSecret) {
	log.fatal(
		'Invalid Hydra secret (must not be empty for confidential clients)',
	);
	process.exit(1);
}

if (!hydraClientRedirectUri || !getOrigin(hydraClientRedirectUri)) {
	log.fatal({ hydraClientRedirectUri }, 'Invalid Hydra client redirect URI');
	process.exit(1);
}

if (
	!Array.isArray(hydraAudience) ||
	!hydraAudience.reduce((acc, cv) => acc && typeof cv === 'string', true)
) {
	log.fatal({ hydraClientAudience: hydraAudience }, 'Invalid Hydra audience');
	process.exit(1);
}

if (typeof hydraSessionAccessTokenExtra !== 'object') {
	log.fatal(
		{ hydraSessionAccessTokenExtra },
		'Invalid Hydra session access token extra',
	);
	process.exit(1);
}

const oauth2Client = {
	tokenEndpointUri: String(
		config.get('server.oauth2.client.tokenEndpoint') ?? '',
	),
	clientAuthMethod: String(
		config.get('server.oauth2.client.tokenAuthMethod') ?? '',
	),
	clientId: String(config.get('server.oauth2.client.id') ?? ''),
	clientSecret: String(config.get('server.oauth2.client.secret') ?? ''),
	scope: String(config.get('server.oauth2.client.scope') ?? ''),
	audience: String(config.get('server.oauth2.client.audience') ?? ''),
};

if (
	['client_secret_basic', 'client_secret_post'].includes(
		oauth2Client.clientAuthMethod,
	)
) {
	if (!oauth2Client.clientId) {
		log.fatal(
			{ clientId: oauth2Client.clientId },
			'OAuth2 client id required',
		);
		process.exit(1);
	}

	if (!oauth2Client.clientSecret) {
		log.fatal('OAuth2 client secret required');
		process.exit(1);
	}

	if (
		!oauth2Client.tokenEndpointUri ||
		!getOrigin(oauth2Client.tokenEndpointUri)
	) {
		log.fatal(
			{ tokenEndpointUri: oauth2Client.tokenEndpointUri },
			'OAuth2 token endpoint required',
		);
		process.exit(1);
	}
}

const authedClient = authenticatedAxios({
	...oauth2Client,
	clientAuthMethod: ['client_secret_basic', 'client_secret_post'].includes(
		oauth2Client.clientAuthMethod,
	)
		? (oauth2Client.clientAuthMethod as
				| 'client_secret_basic'
				| 'client_secret_post')
		: 'none',
});

const hydra = new AdminApi(
	new Configuration({
		basePath: String(config.get('hydra.admin')),
	}),
	undefined,
	authedClient,
);

class ResponseError extends Error {
	information: { error: string; error_description?: string };

	constructor(information: { error: string; error_description?: string }) {
		super();
		this.name = this.constructor.name;
		this.information = information;
	}
}

const bodyParser = (req: http.IncomingMessage): Promise<URLSearchParams> => {
	if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
		throw 415;
	}

	return new Promise((resolve, reject) => {
		try {
			const chunks: Buffer[] = [];
			req.on('data', (chunk: Buffer) => {
				chunks.push(chunk);
			});
			req.on('end', () => {
				resolve(
					new URLSearchParams(
						Buffer.concat(chunks).toString('utf-8'),
					),
				);
			});
		} catch (e) {
			reject(e);
		}
	});
};

const app = http.createServer((req, res) => {
	if (req.method === 'GET' && req.url === '/.well-known/time') {
		res.writeHead(204, {
			'cache-control': 'no-store',
			date: new Date().toUTCString(),
		});
		res.end();
		return;
	} else if (req.method === 'POST' && req.url === '/token') {
		bodyParser(req)
			.then(async (body) => {
				if (
					body.get('grant_type') !==
					'urn:ietf:params:oauth:grant-type:token-exchange'
				) {
					throw new ResponseError({
						error: 'unsupported_grant_type',
					});
				}

				if (
					body.get('subject_token_type') !==
					'urn:ietf:params:oauth:token-type:access_token'
				) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid subject_token_type',
					});
				}

				if (body.get('actor_token')) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'actor_token not supported',
					});
				}

				if (body.get('actor_token_type')) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'actor_token_type not supported',
					});
				}

				if (
					body.get('requested_token_type') &&
					body.get('requested_token_type') !==
						'urn:ietf:params:oauth:token-type:access_token'
				) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid requested_token_type',
					});
				}

				const requestedScope =
					typeof body.get('scope') !== 'undefined'
						? typeof body.get('scope') === 'string'
							? String(body.get('scope') ?? '')
									.split(' ')
									.filter((v) => v.length)
							: null
						: [];

				if (
					requestedScope === null ||
					!requestedScope.reduce(
						(acc, cv) => acc && hydraScope.includes(cv),
						true,
					)
				) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid scope',
					});
				}

				const requestedAudience = body.getAll('audience');

				if (
					requestedAudience === null ||
					!requestedAudience.reduce(
						(acc, cv) => acc && hydraAudience.includes(cv),
						true,
					)
				) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid audience',
					});
				}

				const resource = getOrigin(body.get('resource'));

				if (!resource) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid resource',
					});
				}

				const establishmentInfo = await authedClient.get(
					`${originLookupUri}?${new URLSearchParams({
						[originLookupParameter]: resource,
					})}`,
					{
						headers: {
							accept: 'application/vnd.pgrst.object+json',
						},
						validateStatus: (status) => [200, 406].includes(status),
					},
				);

				if (
					establishmentInfo.status !== 200 ||
					typeof establishmentInfo.data !== 'object' ||
					typeof establishmentInfo.data.establishment_id !==
						'string' ||
					!establishmentInfo.data.userinfo_endpoint ||
					typeof establishmentInfo.data.userinfo_endpoint !==
						'string' ||
					getOrigin(establishmentInfo.data.userinfo_endpoint) === null
				) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid origin',
					});
				}

				const userinfo = await axios.get(
					establishmentInfo.data.userinfo_endpoint,
					{
						headers: {
							authorization: `Bearer ${body.get(
								'subject_token',
							)}`,
						},
						validateStatus: (status) =>
							[200, 400, 401].includes(status),
					},
				);

				if (userinfo.status !== 200) {
					throw new ResponseError({
						error: 'invalid_request',
						error_description: 'invalid subject_token',
					});
				}

				const state = generateState();
				const [code_verifier, code_challenge] = generateChallenge();

				const initiatorParams = new URLSearchParams({
					response_type: 'code',
					client_id: hydraClientId,
					redirect_uri: hydraClientRedirectUri,
					state: state,
					code_challenge: code_challenge,
					code_challenge_method: 'S256',
					...(requestedScope
						? { scope: requestedScope.join(' ') }
						: {}),
				});
				requestedAudience.forEach((v) => {
					initiatorParams.append('audience', v);
				});

				const initiator = await axios.get(
					`${hydraPublicUri}/oauth2/auth?${initiatorParams}`,
					{
						maxRedirects: 0,
						validateStatus: (s: number) => s >= 300 && s <= 399,
					},
				);

				const loginCookies = (initiator.headers['set-cookie'] ?? [])
					.map((cookie: string) => cookie.split(';')[0])
					.join('; ');

				const loginChallenge = new URL(
					initiator.headers['location'],
				).searchParams.get('login_challenge');

				if (!loginChallenge) {
					throw new Error('Invalid login challenge');
				}

				const acceptedLoginRequest = await hydra.acceptLoginRequest(
					loginChallenge,
					{
						subject: `${establishmentInfo.data.establishment_id}/${userinfo.data['sub']}`,
					},
				);

				const consentDestination = new URL(
					acceptedLoginRequest.data.redirect_to,
				);

				const hydraLoginRequest = await axios.get(
					`${hydraPublicUri}${consentDestination.pathname}${consentDestination.search}`,
					{
						headers: {
							...(loginCookies ? { cookie: loginCookies } : {}),
						},
						maxRedirects: 0,
						validateStatus: (status: number) =>
							status >= 300 && status <= 399,
					},
				);
				const consentCookies = (
					hydraLoginRequest.headers['set-cookie'] ?? []
				)
					.map((cookie: string) => cookie.split(';')[0])
					.join('; ');

				const consentChallenge = new URL(
					hydraLoginRequest.headers['location'],
				).searchParams.get('consent_challenge');

				if (!consentChallenge) {
					throw new Error('Invalid consent challenge');
				}

				// TODO Set groups, etc.
				const acceptedConsentRequest = await hydra.acceptConsentRequest(
					consentChallenge,
					{
						grant_access_token_audience: requestedAudience,
						grant_scope: requestedScope,
						session: {
							access_token: {
								...hydraSessionAccessTokenExtra,
								'urn:oid:1.2.826.0.1.12982883:tilauksesi:params:oauth:claims:establishment_id':
									establishmentInfo.data.establishment_id,
							},
						},
					},
				);

				const finalDestination = new URL(
					acceptedConsentRequest.data.redirect_to,
				);

				const hydraConsentRequest = await axios.get(
					[
						`${hydraPublicUri}`,
						finalDestination.pathname,
						finalDestination.search,
					].join(''),
					{
						headers: {
							...(consentCookies
								? { cookie: consentCookies }
								: {}),
						},
						maxRedirects: 0,
						validateStatus: (status: number) =>
							status >= 300 && status <= 399,
					},
				);

				const clientRedirect = new URL(
					hydraConsentRequest.headers['location'],
				).searchParams;
				const redirectState = clientRedirect.get('state');
				const code = clientRedirect.get('code');

				if (redirectState !== state) {
					throw new Error('Invalid state');
				}

				if (!code) {
					throw new Error('Invalid code');
				}

				const tokenRequest = await axios.post(
					`${hydraPublicUri}/oauth2/token`,
					new URLSearchParams({
						grant_type: 'authorization_code',
						redirect_uri: hydraClientRedirectUri,
						code: code,
						code_verifier: code_verifier,
						...(hydraTokenAuthMethod === 'client_secret_basic'
							? {}
							: hydraTokenAuthMethod === 'client_secret_post'
							? {
									client_id: hydraClientId,
									client_secret: hydraClientSecret,
							  }
							: {
									client_id: hydraClientId,
							  }),
					}).toString(),
					{
						maxRedirects: 0,
						validateStatus: (status: number) => status === 200,
						headers: {
							'content-type': 'application/x-www-form-urlencoded',
						},
						...(hydraTokenAuthMethod === 'client_secret_basic'
							? {
									auth: {
										username: hydraClientId,
										password: hydraClientSecret,
									},
							  }
							: {}),
					},
				);

				res.writeHead(200, { 'content-type': 'application/json' });
				res.write(
					JSON.stringify({
						access_token: tokenRequest.data.access_token,
						issued_token_type:
							'urn:ietf:params:oauth:token-type:access_token',
						token_type: tokenRequest.data.token_type,
						expires_in: tokenRequest.data.expires_in,
						scope: tokenRequest.data.scope,
					}),
				);
			})
			.catch((e) => {
				if (typeof e === 'number') {
					res.writeHead(e);
					return;
				} else if (e instanceof ResponseError) {
					res.writeHead(400, { 'content-type': 'application/json' });
					res.write(JSON.stringify(e.information));
					return;
				}

				log.warn(
					{ message: e.message, stack: e.stack },
					'Unexpected error',
				);
				res.writeHead(500);
			})
			.finally(() => res.end());
		return;
	}

	res.writeHead(501);
	res.end();
});

app.listen(config.get('server.port'), () => {
	log.info('Listening');
});
