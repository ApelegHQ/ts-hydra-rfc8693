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

import basicAuthorizationHeader from './lib/basicAuthorizationHeader.js';
import { generateChallenge, generateState } from './lib/pkce.js';

/**
 * Returns a function that constructs a Hydra session
 *
 * @param hydraClientId The client ID for Hydra authentication.
 * @param hydraClientSecret The client secret for Hydra authentication.
 * @param hydraTokenAuthMethod The authentication method for token requests
 *   (e.g., "client_secret_basic").
 * @param hydraClientRedirectUri The redirect URI for the client
 *   application.
 * @param hydraPublicUri The public URI of the Hydra server.
 * @param hydraAdminUri The admin URI of the Hydra server.
 * @param publicFetch The fetch function used for public requests.
 * @param adminFetch The fetch function used for admin requests.
 * @returns A function that constructs a Hydra session.
 */
const hydraSessionConstructorFactory = (
	hydraClientId: Readonly<string>,
	hydraClientSecret: Readonly<string | undefined>,
	hydraTokenAuthMethod: Readonly<string>,
	hydraClientRedirectUri: Readonly<string>,
	hydraPublicUri: Readonly<string>,
	hydraAdminUri: Readonly<string>,
	publicFetch: typeof self.fetch,
	adminFetch: typeof self.fetch,
) => {
	/**
	 * Constructs a Hydra session by initiating the login and consent flow.
	 *
	 * @param requestedScopes The requested scopes for the login.
	 * @param requestedAudiences The requested audiences for the login.
	 * @param subject The subject for the login.
	 * @param sessionAccessTokenClaims Claims for the session access token.
	 * @param sessionIdTokenClaims Claims for the session ID token.
	 * @param acr The Authentication Context Class Reference (ACR).
	 * @param amr The Authentication Methods References (AMR).
	 * @returns A promise that resolves to the fetched token.
	 */
	const hydraPublicOrigin = new URL(hydraPublicUri).origin;

	return async (
		requestedScopes: Readonly<Iterable<string> | undefined>,
		requestedAudiences: Readonly<Iterable<string> | undefined>,
		subject: Readonly<string>,
		sessionAccessTokenClaims: Record<string, unknown> | undefined,
		sessionIdTokenClaims: Record<string, unknown> | undefined,
		acr: Readonly<string | undefined>,
		amr: Readonly<string[] | undefined>,
	) => {
		// The Hydra API doesn't support specifying session claims when using
		// the client credentials flow.
		// This function works around that limitation by initiating an
		// authorization flow with PKCE
		// Doing it this way requires reaching both the admin and the public
		// APIs
		// The steps are as follows:
		//   1. First, initiate an authorization flow by making a request to
		//      `${hydraPublicUri}/oauth2/auth`
		//   2. Intercept the redirect to the authentication frontend and use
		//      the parameters to accept the login request by making a request
		//      to `${hydraAdminUri}/admin/oauth2/auth/requests/login/accept`
		//   3. Make a request to the public Hydra endpoint to obtain the
		//      consent parameters
		//   4. Intercept the redirect to the consent frotend and use the
		//      parameters to accept the loggin request by making a request to
		//      ${hydraAdminUri}/admin/oauth2/auth/requests/consent/accept
		//   5. Make a request to the public Hydra endpoint to obtain the
		//      token parameters
		//   6. Intercept the redirect and make a request to the token endpoint
		//      at `${hydraPublicUri}/oauth2/token` to obtain the token
		// Since this approach requires access to the admin API with the ability
		// to accept login and consent requests, and any arbitrary information
		// could be inserted into the resulting session, this function is only
		// meant to be used in the context of a trusted setup.

		const state = generateState();
		const [code_verifier, code_challenge] = await generateChallenge();

		return Promise.resolve()
			.then(
				/** 1. Initiate an authorization flow */
				async () => {
					const initiatorParams = new URLSearchParams([
						...((requestedAudiences &&
							Array.from(requestedAudiences)
								.sort()
								.map((aud) => ['audience', aud])) ||
							[]),
						['client_id', hydraClientId],
						['code_challenge', code_challenge],
						['code_challenge_method', 'S256'],
						['redirect_uri', hydraClientRedirectUri],
						['response_type', 'code'],
						...((requestedScopes && [
							[
								'scope',
								Array.from(requestedScopes).sort().join(' '),
							],
						]) ||
							[]),
						['state', state],
					]);

					const initiator = await publicFetch(
						`${hydraPublicUri}/oauth2/auth?${initiatorParams}`,
						{
							redirect: 'manual',
						},
					);

					if (
						initiator.status < 300 ||
						initiator.status > 399 ||
						!initiator.headers.has('location')
					) {
						throw new Error(
							'Redirect expected while initiating login request',
						);
					}

					const loginCookies = initiator.headers
						.getSetCookie()
						.map((cookie: string) => cookie.split(';')[0])
						.join('; ');

					const loginChallenge = new URL(
						String(initiator.headers.get('location')),
					).searchParams.get('login_challenge');

					if (!loginChallenge) {
						throw new Error('Invalid login challenge');
					}

					return [loginChallenge, loginCookies];
				},
			)
			.then(
				/** 2. Intercept redirect to the authentication frontend and
				 *     accept the login request
				 */
				async ([loginChallenge, loginCookies]) => {
					const acceptedLoginRequest = await adminFetch(
						`${hydraAdminUri}/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(
							loginChallenge,
						)}`,
						{
							method: 'PUT',
							body: JSON.stringify({
								...(acr && { ['acr']: acr }),
								...(Array.isArray(amr) &&
									!!amr.length && { ['amr']: amr }),
								['subject']: subject,
							}),
							redirect: 'error',
						},
					);

					if (
						acceptedLoginRequest.status !== 200 ||
						!acceptedLoginRequest.headers
							.get('content-type')
							?.toLowerCase()
							.startsWith('application/json')
					) {
						throw new Error(
							'Unexpected response code or content type while accepting login request',
						);
					}

					const acceptedLoginRequestData =
						await acceptedLoginRequest.json();

					const consentDestination = new URL(
						acceptedLoginRequestData['redirect_to'],
					);

					return [
						consentDestination.pathname + consentDestination.search,
						loginCookies,
					];
				},
			)
			.then(
				/** 3. Make a request to the public Hydra endpoint to obtain the
				 *     consent parameters */
				async ([consentDestination, loginCookies]) => {
					const hydraLoginRequest = await publicFetch(
						`${hydraPublicOrigin}${consentDestination}`,
						{
							headers: loginCookies
								? [['cookie', loginCookies]]
								: [],
							redirect: 'manual',
						},
					);

					if (
						hydraLoginRequest.status < 300 ||
						hydraLoginRequest.status > 399 ||
						!hydraLoginRequest.headers.has('location')
					) {
						throw new Error(
							'Redirect expected while accepting consent request',
						);
					}

					const consentCookies = hydraLoginRequest.headers
						.getSetCookie()
						.map((cookie: string) => cookie.split(';')[0])
						.join('; ');

					const consentChallenge = new URL(
						String(hydraLoginRequest.headers.get('location')),
					).searchParams.get('consent_challenge');

					if (!consentChallenge) {
						throw new Error('Invalid consent challenge');
					}

					return [consentChallenge, consentCookies];
				},
			)
			.then(
				/** 4. Intercept redirect to the consent frontend and accept
				 *     the consent request
				 */
				async ([consentChallenge, consentCookies]) => {
					const acceptedConsentRequest = await adminFetch(
						`${hydraAdminUri}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(
							consentChallenge,
						)}`,
						{
							method: 'PUT',
							body: JSON.stringify({
								['grant_access_token_audience']:
									requestedAudiences,
								['grant_scope']: requestedScopes,
								...((sessionAccessTokenClaims ||
									sessionIdTokenClaims) && {
									['session']: {
										...(sessionAccessTokenClaims && {
											['access_token']:
												sessionAccessTokenClaims,
										}),
										...(sessionIdTokenClaims && {
											['id_token']: sessionIdTokenClaims,
										}),
									},
								}),
							}),
							redirect: 'error',
						},
					);

					if (
						acceptedConsentRequest.status !== 200 ||
						!acceptedConsentRequest.headers
							.get('content-type')
							?.toLowerCase()
							.startsWith('application/json')
					) {
						throw new Error(
							'Unexpected response code or content type while accepting consent request',
						);
					}

					const acceptedConsentRequestData =
						await acceptedConsentRequest.json();

					const finalDestination = new URL(
						acceptedConsentRequestData['redirect_to'],
					);

					return [
						finalDestination.pathname + finalDestination.search,
						consentCookies,
					];
				},
			)
			.then(
				/** 5. Make a request to the public Hydra endpoint to obtain the
				 *     token parameters */
				async ([finalDestination, consentCookies]) => {
					const hydraConsentRequest = await publicFetch(
						`${hydraPublicOrigin}${finalDestination}`,
						{
							headers: consentCookies
								? [['cookie', consentCookies]]
								: [],
							redirect: 'manual',
						},
					);

					if (
						hydraConsentRequest.status < 300 ||
						hydraConsentRequest.status > 399 ||
						!hydraConsentRequest.headers.has('location')
					) {
						throw new Error(
							'Redirect expected while accepting consent',
						);
					}

					const clientRedirect = new URL(
						String(hydraConsentRequest.headers.get('location')),
					).searchParams;
					const redirectState = clientRedirect.get('state');
					const code = clientRedirect.get('code');

					if (redirectState !== state) {
						throw new Error('Invalid state');
					}

					if (!code) {
						throw new Error('Invalid code');
					}

					return [code];
				},
			)
			.then(
				/** 6. Intercept the redirect and make a request to the token
				 *     endpoint */
				async ([code]) => {
					const tokenRequest = await publicFetch(
						`${hydraPublicUri}/oauth2/token`,
						{
							method: 'POST',
							body: new URLSearchParams([
								...(hydraTokenAuthMethod ===
								'client_secret_basic'
									? []
									: hydraTokenAuthMethod ===
										  'client_secret_post'
										? [
												['client_id', hydraClientId],
												[
													'client_secret',
													String(hydraClientSecret),
												],
											]
										: [['client_id', hydraClientId]]),
								['code', code],
								['code_verifier', code_verifier],
								['grant_type', 'authorization_code'],
								['redirect_uri', hydraClientRedirectUri],
							]).toString(),
							redirect: 'error',
							headers: [
								...(hydraTokenAuthMethod ===
								'client_secret_basic'
									? [
											basicAuthorizationHeader(
												hydraClientId,
												String(hydraClientSecret),
											),
										]
									: []),
								[
									'content-type',
									'application/x-www-form-urlencoded',
								],
							],
						},
					);

					if (
						tokenRequest.status !== 200 ||
						!tokenRequest.headers
							.get('content-type')
							?.toLowerCase()
							.startsWith('application/json')
					) {
						throw new Error(
							'Unexpected response code or content type while fetching token',
						);
					}

					return tokenRequest.json();
				},
			);
	};
};

export default hydraSessionConstructorFactory;
