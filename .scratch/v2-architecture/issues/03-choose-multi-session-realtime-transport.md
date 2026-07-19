# Choose multi-Session realtime transport

Type: research
Status: resolved
Blocked by:

## Question

How should one client reliably observe multiple concurrently running Sessions without overbuilding the transport?

## Answer

Commands and queries use REST. Each Vue tab opens one authenticated Gateway-level SSE stream carrying every Session's events in a versioned envelope. A Gateway epoch/sequence is the replay cursor; each execution also has its own sequence for local ordering and gap detection.

Bootstrap returns snapshots plus a captured cursor, after which SSE replays from that cursor. Every client has an independent bounded queue and pump; lagging clients receive reset/lag signals and recover from REST snapshots without blocking Pi or other clients. WebSocket remains out of scope until a real bidirectional or binary requirement such as PTY appears.

Research asset: [Multi-Session realtime transport](../research/multi-session-realtime-transport.md).
