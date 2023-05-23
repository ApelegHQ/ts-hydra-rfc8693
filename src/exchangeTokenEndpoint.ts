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

import hydraSessionConstructorFactory from './hydraSessionConstructorFactory.js';
import ResponseError from './lib/ResponseError.js';
import type { TAuthenticatedFetchParams } from './lib/authenticatedFetch.js';
import authenticatedFetch from './lib/authenticatedFetch.js';
import bodyParser from './lib/bodyParser.js';
import getOrigin from './lib/getOrigin.js';

export type TSessionInfo = {
	['subject']: string;
	['id_token']?: Record<string, unknown> | undefined;
	['access_token']?: Record<string, unknown> | undefined;
	['acr']?: string;
	['amr']?: string[] | undefined;
};

const exchangeTokenEndpoint = (
	hydraClientId: Readonly<string>,
	hydraClientSecret: Readonly<string | undefined>,
	hydraTokenAuthMethod: Readonly<string>,
	hydraClientRedirectUri: Readonly<string>,
	hydraPublicUri: Readonly<string>,
	hydraAdminUri: Readonly<string>,
	hydraScope: Readonly<string[]>,
	hydraAudience: Readonly<string[]>,
	hydraPublicAuthParams: Readonly<TAuthenticatedFetchParams>,
	hydraAdminAuthParams: Readonly<TAuthenticatedFetchParams>,
	userinfo: (body: URLSearchParams) => Promise<TSessionInfo> | TSessionInfo,
) => {
	if (!hydraPublicUri || !getOrigin(hydraPublicUri)) {
		throw new Error('Invalid Hydra public URI: ' + hydraPublicUri);
	}

	if (!hydraAdminUri || !getOrigin(hydraAdminUri)) {
		throw new Error('Invalid Hydra admin URI: ' + hydraAdminUri);
	}

	if (
		!['client_secret_basic', 'client_secret_post', 'none'].includes(
			hydraTokenAuthMethod,
		)
	) {
		throw new Error(
			'Invalid Hydra token endpoint auth method: ' + hydraTokenAuthMethod,
		);
	}

	if (!hydraClientId) {
		throw new Error('Invalid Hydra client ID');
	}

	if (hydraTokenAuthMethod === 'none' && hydraClientSecret) {
		throw new Error(
			'Invalid Hydra secret (must be empty for public clients)',
		);
	}

	if (hydraTokenAuthMethod !== 'none' && !hydraClientSecret) {
		throw new Error(
			'Invalid Hydra secret (must not be empty for confidential clients)',
		);
	}

	if (!hydraClientRedirectUri || !getOrigin(hydraClientRedirectUri)) {
		throw new Error(
			'Invalid Hydra client redirect URI: ' + hydraClientRedirectUri,
		);
	}

	if (
		!Array.isArray(hydraAudience) ||
		!hydraAudience.reduce((acc, cv) => acc && typeof cv === 'string', true)
	) {
		throw new Error('Invalid Hydra audience: ' + hydraAudience);
	}

	const hydraSessionConstructor = hydraSessionConstructorFactory(
		hydraClientId,
		hydraClientSecret,
		hydraTokenAuthMethod,
		hydraClientRedirectUri,
		hydraPublicUri,
		hydraAdminUri,
		authenticatedFetch(hydraPublicAuthParams),
		authenticatedFetch(hydraAdminAuthParams),
	);

	return async (req: Request) => {
		try {
			const body = await bodyParser(req);

			// REQUIRED
			if (!body.has('subject_token')) {
				throw new ResponseError({
					['error']: 'invalid_request',
					['error_description']: 'missing subject_token',
				});
			}

			// REQUIRED
			if (
				body.get('subject_token_type') !==
				'urn:ietf:params:oauth:token-type:access_token'
			) {
				throw new ResponseError({
					['error']: 'invalid_request',
					['error_description']: 'invalid subject_token_type',
				});
			}

			// OPTIONAL
			if (
				body.get('grant_type') !==
				'urn:ietf:params:oauth:grant-type:token-exchange'
			) {
				throw new ResponseError({
					['error']: 'unsupported_grant_type',
				});
			}

			// OPTIONAL but only access_token supported
			if (
				body.get('requested_token_type') &&
				body.get('requested_token_type') !==
					'urn:ietf:params:oauth:token-type:access_token'
			) {
				throw new ResponseError({
					['error']: 'invalid_request',
					['error_description']: 'invalid requested_token_type',
				});
			}

			const requestedScope = String(body.get('scope') ?? '')
				.split(' ')
				.filter((v) => v.length);

			// OPTIONAL
			if (
				!requestedScope.reduce(
					(acc, cv) => acc && hydraScope.includes(cv),
					true,
				)
			) {
				throw new ResponseError({
					['error']: 'invalid_scope',
				});
			}

			const requestedAudience = body.getAll('audience');

			// OPTIONAL
			if (
				!requestedAudience.reduce(
					(acc, cv) => acc && hydraAudience.includes(cv),
					true,
				)
			) {
				throw new ResponseError({
					['error']: 'invalid_request',
					['error_description']: 'invalid audience',
				});
			}

			const resource = body.get('resource');

			// OPTIONAL, but must be a valid URL
			if (resource && getOrigin(resource) === null) {
				throw new ResponseError({
					['error']: 'invalid_request',
					['error_description']: 'invalid resource',
				});
			}

			// OPTIONAL
			if (body.has('actor_token') && !body.has('actor_token_type')) {
				throw new ResponseError({
					['error']: 'invalid_request',
					['error_description']: 'missing actor_token_type',
				});
			}

			const sessionInformation = await userinfo(body);

			const tokenRequestData = await hydraSessionConstructor(
				requestedScope,
				requestedAudience,
				sessionInformation['subject'],
				sessionInformation['access_token'],
				sessionInformation['id_token'],
				sessionInformation['acr'],
				sessionInformation['amr'],
			);

			return new Response(
				JSON.stringify({
					['access_token']: tokenRequestData['access_token'],
					['issued_token_type']:
						'urn:ietf:params:oauth:token-type:access_token',
					['token_type']: tokenRequestData['token_type'],
					['expires_in']: tokenRequestData['expires_in'],
					['scope']: tokenRequestData['scope'],
				}),
				{
					status: 200,
					headers: { ['content-type']: 'application/json' },
				},
			);
		} catch (e) {
			if (typeof e === 'number') {
				return new Response(null, { status: e });
			} else if (e instanceof ResponseError) {
				return new Response(
					JSON.stringify({
						['error']: e.information.error,
						['error_description']: e.information.error_description,
					}),
					{
						status: e.information.status ?? 400,
						headers: {
							['content-type']: 'application/json',
						},
					},
				);
			}
		}
		return new Response(null, { status: 500 });
	};
};

export default exchangeTokenEndpoint;
