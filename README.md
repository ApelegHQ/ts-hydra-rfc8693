# 🐉 hydra-rfc8693 📜

An NPM package for implementing RFC 8693 for Ory Hydra 🚀

 [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_hydra-rfc8693&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_hydra-rfc8693)
 [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_hydra-rfc8693&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_hydra-rfc8693)
 [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_hydra-rfc8693&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_hydra-rfc8693)
 [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_hydra-rfc8693&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_hydra-rfc8693)
 [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Exact-Realty_hydra-rfc8693&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Exact-Realty_hydra-rfc8693)
 ![NPM Downloads](https://img.shields.io/npm/dw/@exact-realty/hydra-rfc8693?style=flat-square)
 [![License](https://img.shields.io/badge/License-Apache%202.0%20with%20llvm%20exception-blue.svg)](https://github.com/Exact-Realty/ts-hydra-rfc8693/blob/master/LICENSE)

## 📖 Introduction

Welcome to **hydra-rfc8693**! This powerful package enables you to supercharge
your OAuth 2.0 and OpenID Connect server with seamless implementation of RFC
8693 for Ory Hydra. Empower your applications with advanced token exchange,
flexible authentication and token transformation capabilities. Boost your
security and scalability while adhering to industry standards. 💪

## ✨ Features

**hydra-rfc8693** empowers you to enhance your OAuth 2.0 and OpenID Connect
server without the burden of additional dependencies. It seamlessly integrates
with Ory Hydra, providing a runtime-agnostic solution that fits into any
JavaScript project effortlessly.

- **Token Exchange Supercharged:** Effortlessly handle token exchange with
powerful capabilities at your fingertips.
- **Transform Tokens on the Fly:** Seamlessly transform token types to adapt to
various scenarios and requirements.
- **OAuth 2.0 and OpenID Connect Compliant:** Ensure interoperability and
compatibility with industry-standard protocols.
- **Deep Integration with Ory Hydra:** Maximise the potential of Ory Hydra by
leveraging the full capabilities of RFC 8693.
- **Scalable and Highly Available:** Built to scale and designed for high
availability to meet the demands of your applications.
- **Flexible Authentication:** Support a wide range of authentication mechanisms
to suit your specific needs.
- **No Dependencies:** The package has no external dependencies, keeping your
project lightweight and hassle-free.
- **Runtime Agnostic:** Utilises standard JavaScript only, making it compatible
with any runtime environment.

## 🚀 Installation

Getting started with **hydra-rfc8693** is as easy as running a simple command:

```sh
npm install "@exact-realty/hydra-rfc8693"
```

## 💡 Usage

Integrating **hydra-rfc8693** into your project is a breeze. Here's a quick
example to get you started:

```js
import server, { listeners } from '@exact-realty/routemate';
import exchangeTokenEndpoint from '@exact-realty/hydra-rfc8693';

const exchangeTokenEndpointHandler = exchangeTokenEndpoint(
  'deadbeef-abba-cafe-affe-123456789012', // hydraClientId
  undefined, // hydraClientSecret
  'none', // hydraTokenAuthMethod
  'about:invalid', // hydraClientRedirectUri
  'http://localhost:4444', // hydraPublicUri
  'http://localhost:4445', // hydraAdminUri
  { ['clientAuthMethod']: 'none' }, // hydraPublicAuthParams
  // NB! Remember to use authentication in production
  { ['clientAuthMethod']: 'none' }, // hydraAdminAuthParams
  (body) => ({
    subject: 'alice@example.com',
    access_token: {
      // Example of a claim in the access token
      original_request: String(body),
    },
    id_token: {
      name: 'Alice',
    }
  }),
  [], // scope. Optional list of scopes
  [], // audience. Optional list of audiences
  [], // subjectTokenType. Optional list of acceptable token types;
      // null or undefined defaults to access tokens
  [], // actorTokenType. Optional list of acceptable token types
      // null or undefined defaults to none
);

server(listeners.node)
  .listen(5678, '127.0.0.1')
  .then((r) => {
    r.post('/token', exchangeTokenEndpointHandler);
  });
```

## 🤝 Contributing

🎉 We appreciate contributions from the community! If you have any ideas,
suggestions or find any issues, feel free to open an issue or submit a pull
request on our
[GitHub repository](https://github.com/Exact-Realty/ts-hydra-rfc8693).

## ❗️ Disclaimer

⚠️ **IMPORTANT**: This software assumes a secure setup and should only be
used for token exchange when the token issuer is trusted. It is essential to
exercise caution and ensure the security of your setup when utilising token
exchange capabilities.

This software is not affiliated with or endorsed by ORY or the developers of
Ory Hydra. It is an independent implementation of RFC 8693 for Ory Hydra and is
provided as-is, without any warranties or guarantees of fitness for a
particular purpose.

## 📄 License

This project is licensed under the Apache 2.0 License with the LLVM exception.
You are free to use this package in compliance with the terms of the license.
For more information, see the `LICENSE` file.
