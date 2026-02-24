# Security Policy

## Scope

Voltron is an AI agent governance platform that handles sensitive operational data including file system events, risk assessments, and execution control states. Security is a core design principle, not an afterthought.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Voltron, **please report it responsibly**.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities.
2. Send a detailed report to the project maintainers via GitHub private vulnerability reporting.
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if applicable)

### Response Timeline

- **Acknowledgement**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix**: Dependent on severity (critical issues are prioritized)

## Security Architecture

### Design Principles

- **Defense in depth**: Multiple layers of validation and protection
- **Least privilege**: Components operate with minimal required permissions
- **Append-only audit**: Action logs cannot be modified or deleted
- **Self-protection**: Voltron's own files are in a hardcoded protection zone

### Key Security Measures

| Measure | Implementation |
|---------|---------------|
| Input validation | Zod schemas at all entry points (REST + WebSocket) |
| SQL injection prevention | Prepared statements for all database queries |
| Path traversal protection | Normalized path validation on file serving endpoints |
| WebSocket authentication | Token-based interceptor authentication |
| Rate limiting | Per-client rate limiting (100 msg/sec) + circuit breaker |
| Event deduplication | UUID + sequence number tracking |
| Protection zones | Hardcoded non-configurable system path protection |
| Hash chain integrity | Cryptographic hash chain for event ordering verification |

### Protection Zones

The following paths are protected by default and cannot be modified through the platform:

- `/etc/nginx/**` &mdash; Web server configuration
- `/etc/systemd/**` &mdash; System service definitions
- `/etc/letsencrypt/**` &mdash; SSL certificates
- Voltron's own installation directory
- Database files (`*.db`, `*.db-wal`, `*.db-shm`)

## Best Practices for Deployment

- Always set a strong `VOLTRON_INTERCEPTOR_SECRET` in production
- Use HTTPS (TLS) for all connections
- Run behind a reverse proxy (nginx) with appropriate headers
- Restrict network access to the API and WebSocket endpoints
- Regularly review the action log for anomalous patterns
- Keep Node.js and all dependencies up to date

## Acknowledgements

We appreciate the security research community. Contributors who responsibly disclose vulnerabilities will be acknowledged (with their permission) in release notes.
