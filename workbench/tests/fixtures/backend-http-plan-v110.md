---
name: backend-http-plan
description: Guidance for authoring HTTP JSON plans from confirmed cases and protocol bindings.
version: 1.1.0
---

# HTTP/JSON plan authoring guidance

Use only the confirmed case, confirmed protocol binding and registered environment for request paths, methods, bodies and business expectations. Map every original case step and expected result to requests and JSON assertions. Status-only and response echo checks do not establish business behavior.

Bind each JSON assertion to the exact response field and expected business value. Compare arrays and collections at the required scope, including membership, length and before/after consistency where the confirmed expectation requires them. Use expected_from only for an earlier response when a baseline comparison is intended.

For a confirmed record-membership expectation, use `array_some_field_equals` on the array with a single own field and literal scalar value; do not assume the record is first. A field-presence obligation needs its own `exists` check. If the supported operators cannot express an obligation, mark it uncovered rather than claiming coverage or changing the request or expected value to obtain a passing result. Changing a frozen expected member to the observed count, or omitting a required result-set comparison, is not a repair. Preserve the failing candidate and evidence; do not report an empty uncovered list while an obligation remains untested.

Use response_ref to assert an earlier HTTP response without sending another request when the supported plan format permits it. Keep request IDs unique and references backward-only.

Respect the registered environment capability: read-only targets permit only scoped GET requests with no setup or cleanup; synthetic namespaces require their registered setup, scoped requests and precise cleanup of this run's data. Do not infer write authority or invent protocol behavior.

Keep failed business assertions and the observed response evidence. A self-test failure is not permission to weaken the case, binding or cleanup obligations. Mark unsupported obligations explicitly for review.
