# Gateway contract versioning and compatibility

## Question

What compatibility policy should a versioned local Gateway use when its bundled SPA normally upgrades with it but future remote clients may not?

## Findings

- GitHub publishes explicit REST API versions, reserves breaking changes for a new API version, and treats added operations, optional parameters, response fields, and event values as additive changes. Unsupported retired versions return `410 Gone`. It reserves exceptional intervention for critical security, data exposure, or severe reliability issues. [GitHub REST API versions](https://docs.github.com/rest/overview/api-versions)
- Stripe separates backward-compatible monthly releases from breaking major releases. Its compatibility guidance treats new resources, optional request fields, response properties, and event types as additive, and explicitly requires consumers to handle unfamiliar event types. Strongly typed SDK versions are aligned with API versions so runtime payloads and static types do not silently diverge. [Stripe API upgrades](https://docs.stripe.com/upgrades) · [Stripe SDK versioning policy](https://docs.stripe.com/sdks/versioning)
- Kubernetes exposes supported resources and operations through a Discovery API and keeps versioned public APIs separate from internal representations. Its compatibility rules prohibit adding required behavior or changing existing field semantics within a stable version and require older clients to handle declared open-ended values safely. [The Kubernetes API](https://kubernetes.io/docs/concepts/overview/kubernetes-api/) · [Kubernetes API change rules](https://github.com/kubernetes/community/blob/main/contributors/devel/sig-architecture/api_changes.md)

## Decision support

For this Gateway:

1. `/api/v1` is the stable semantic boundary; breaking field or behavior changes require `/api/v2`.
2. Compatible additions include optional fields, new endpoints, new event types, and new capability keys.
3. Clients discover optional behavior through `capabilities` rather than inferring it from build numbers.
4. `contractRevision` is diagnostic and testable metadata inside a major version.
5. `minClientRevision` is an exceptional safety floor, not the normal feature rollout mechanism.
6. Request decoders reject unknown input, while response decoders tolerate and discard unknown output fields. Unknown business events advance the replay cursor and are otherwise ignored.
7. Closed state enums such as `RunState` cannot gain values inside v1 unless the original schema defines a safe unknown state; otherwise the change is breaking.
