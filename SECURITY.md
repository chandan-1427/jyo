# Security Policy

Jyo is a live application handling real user data — passwords, location, and identity-verification selfies — so security reports are taken seriously.

## Reporting a Vulnerability

Please report security issues privately using GitHub's [private vulnerability reporting](https://github.com/chandan-1427/jyo/security/advisories/new) rather than opening a public issue. This keeps the details out of public view until a fix is out.

If you don't have GitHub or that link doesn't work for you, open an issue asking to be contacted privately and a channel will be arranged — please don't post vulnerability details in a public issue.

Expect an acknowledgment within a few days. Fixes for anything affecting live user data are prioritized and shipped as soon as possible via the CI/CD pipeline described in the [README](./README.md#deployment).

## Supported Versions

Jyo is continuously deployed — the tip of `main` is what's running in production at any given time. There are no older versions to patch separately; security fixes go directly into `main`.
