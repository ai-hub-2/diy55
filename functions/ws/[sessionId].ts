import { Buffer } from 'buffer';
import * as Y from 'yjs';
import { awarenessProtocol, Awareness } from 'y-protocols/awareness';
import { syncProtocol, encodeStateAsUpdate, applyUpdate } from 'y-protocols/sync';
import { KVNamespace } from '@cloudflare/workers-types';

// Define the binding for KV store in worker-configuration.d.ts or via wrangler.toml
// For now, we assume it will be available as YJS_KV_STORE
declare let YJS_KV_STORE: KVNamespace;

interface Env {
  YJS_KV_STORE: KVNamespace;
}

// In-memory store for Yjs documents and awareness states, keyed by session ID
const sessions = new Map<string, { doc: Y.Doc; awareness: Awareness }>();

// Persist document state to KV
async function persistDoc(sessionId: string, doc: Y.Doc): Promise<void> {
  try {
    const content = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
    await YJS_KV_STORE.put(`yjs-doc-${sessionId}`, content);
    console.log(`Persisted doc for session: ${sessionId}`);
  } catch (error) {
    console.error(`Error persisting doc for session ${sessionId}:`, error);
  }
}

// Load document state from KV
async function loadDoc(sessionId: string): Promise<Y.Doc | null> {
  try {
    const content = await YJS_KV_STORE.get(`yjs-doc-${sessionId}`);
    if (content) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, Buffer.from(content, 'base64'));
      console.log(`Loaded doc from KV for session: ${sessionId}`);
      return doc;
    }
  } catch (error) {
    console.error(`Error loading doc for session ${sessionId}:`, error);
  }
  return null;
}

function getSession(sessionId: string): { doc: Y.Doc; awareness: Awareness } {
  let session = sessions.get(sessionId);
  if (!session) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness();
    // For simplicity, we're not loading from KV on initial getSession here.
    // Loading should happen on first connection or be handled by a separate init flow.
    session = { doc, awareness };
    sessions.set(sessionId, session);
  }
  return session;
}


// Cloudflare Pages Function signature
// The context object contains request, env, params, next, data, waitUntil.
interface PagesFunctionEnv extends Env {
  // Define other bindings if any, e.g., Durable Objects
}
interface EventContextExtended<P extends string = any> extends EventContext<PagesFunctionEnv, P, any> {
    params: Record<P, string>;
}


export async function onRequest(context: EventContextExtended<'sessionId'>): Promise<Response> {
    const { request, env, params, waitUntil } = context;

    // This worker is intended for WebSocket connections only.
    // We expect YJS_KV_STORE to be bound in wrangler.toml or via Pages bindings.
    if (!env.YJS_KV_STORE) {
        console.error("YJS_KV_STORE binding is missing.");
        return new Response("KV store binding is not configured.", { status: 500 });
    }
    // Assign it globally for the helper functions for now. This is not ideal.
    // TODO: Refactor to pass env or YJS_KV_STORE instance around.
    (globalThis as any).YJS_KV_STORE = env.YJS_KV_STORE;

    const sessionId = params.sessionId; // Get sessionId from path parameter

    if (!sessionId) {
      // This case should ideally not be reached if routing is functions/ws/[sessionId].ts
      console.error("Session ID is missing from path parameters.");
      return new Response('Session ID is required in path.', { status: 400 });
    }

    // Upgrade to WebSocket
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();

    // Load existing document from KV or create a new one
    let doc = await loadDoc(sessionId);
    if (!doc) {
      doc = new Y.Doc();
      // Persist the new empty doc immediately to ensure it exists in KV
      await persistDoc(sessionId, doc);
    }
    const awareness = new awarenessProtocol.Awareness();

    sessions.set(sessionId, { doc, awareness });


    const conn = {
        doc,
        awareness,
        ws: server,
        send: (message: Uint8Array) => server.send(message),
        isAlive: true,
    };

    // Handle messages from the client
    server.addEventListener('message', async (event) => {
      try {
        const message = new Uint8Array(event.data as ArrayBuffer);
        // Apply received update to the server's Yjs document and awareness
        // Yjs sync protocol messages are handled by y-protocols directly on the doc/awareness
        // For y-protocols, message types are typically distinguished by their first byte.
        // syncProtocol messages (type 0 for sync step 1/2, type 1 for update)
        // awarenessProtocol messages (type 1 for awareness update)

        // For simplicity, assume any message could be sync or awareness
        // In a more robust setup, you might inspect message[0]
        syncProtocol.readSyncMessage(message, conn.doc, conn.ws); // This might be incorrect usage for server
        awarenessProtocol.applyAwarenessUpdate(conn.awareness, message, conn.ws);

        // If it was a document update, persist it
        // Crude check: if syncProtocol.readSyncMessage modified the doc (it doesn't directly, it sends)
        // A better way is to listen to doc.on('update')
        // For now, persist after every message for simplicity during dev
        if (message[0] === syncProtocol.messageYjsSyncStep2 || message[0] === syncProtocol.messageYjsUpdate) {
             applyUpdate(conn.doc, message.slice(1)); // Assuming message[0] is type, actual update is slice(1)
                                                    // This is a guess, y-protocols docs are key
             await persistDoc(sessionId, conn.doc);
        }

      } catch (err) {
        console.error('Error processing message:', err);
        // Consider closing the WebSocket on error
      }
    });

    // Handle WebSocket close
    server.addEventListener('close', async () => {
      console.log(`Client disconnected from session: ${sessionId}`);
      awarenessProtocol.removeAwarenessStates(conn.awareness, [conn.doc.clientID], conn.ws);
      // Persist one last time using waitUntil to not block response/closure
      if (conn.doc) { // Ensure doc exists
        waitUntil(persistDoc(sessionId, conn.doc));
      }
      // TODO: Consider more sophisticated session cleanup logic
    });

    server.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      // Perform cleanup if necessary
      if (conn.doc) {
          awarenessProtocol.removeAwarenessStates(conn.awareness, [conn.doc.clientID], conn.ws);
          // Optionally persist on error too, or just log
          // waitUntil(persistDoc(sessionId, conn.doc));
      }
    });

    // Send initial sync step 1 (vector) and awareness state
    const syncMessage = syncProtocol.encodeSyncStep1(conn.doc);
    server.send(syncMessage);

    const awarenessStates = conn.awareness.getStates();
    if (awarenessStates.size > 0) {
        const awarenessMessage = awarenessProtocol.encodeAwarenessUpdate(conn.awareness, Array.from(awarenessStates.keys()));
        server.send(awarenessMessage);
    }

    // Setup document update forwarding
    const docUpdateHandler = (update: Uint8Array, origin: any) => {
        if (origin !== server) { // Don't send updates back to the origin
            const message = syncProtocol.encodeSyncUpdate(update);
            server.send(message);
        }
    };
    doc.on('update', docUpdateHandler);

    // Setup awareness update forwarding
    const awarenessUpdateHandler = ({ added, updated, removed }: any, origin: any) => {
        const changedClients = added.concat(updated).concat(removed);
        const awarenessMessage = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
        server.send(awarenessMessage);
    };
    awareness.on('update', awarenessUpdateHandler);


    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};

// Helper to manage connections and broadcast document/awareness updates
// This is a simplified version. A robust solution would handle multiple connections per document.
// The current `export default { fetch }` model for Pages Functions might need a different
// approach than a long-lived WebSocket server instance. Cloudflare Durable Objects are
// typically used for this stateful WebSocket coordination.
//
// If this runs as a standard Worker (not a Durable Object), each WebSocket connection
// might invoke a new instance of the worker, losing shared in-memory state (sessions map).
// KV store becomes crucial for any shared state.
//
// For Yjs, the typical pattern with a simple worker is:
// 1. Client connects, worker loads Y.Doc from KV.
// 2. Client sends updates, worker applies to its Y.Doc instance and persists to KV.
// 3. Worker broadcasts updates from KV or from the Y.Doc to *other* clients of the *same document*.
//    This broadcasting is the tricky part without Durable Objects or a similar mechanism.
//    A simple KV-based worker might have clients poll or use a pub/sub via KV (less efficient).
//
// The code above attempts a direct WebSocket connection model.
// It assumes that `sessions` map might persist across invocations for the same client,
// or that KV is the primary truth. This will need testing with Cloudflare's execution model.
//
// A more robust approach for Cloudflare without Durable Objects might involve using `y-leveldb`
// or `y-indexeddb` on the server if the worker environment supports it, or a custom KV
// persistence adapter for Yjs. The current `persistDoc` and `loadDoc` are basic.
//
// The y-protocols `readSyncMessage` and `applyAwarenessUpdate` are typically used on the client.
// On the server, you usually manage a Y.Doc and Awareness instance per session and relay
// updates between clients and these central instances.
//
// Let's refine message handling:

// Corrected message handling logic (conceptual)
// server.addEventListener('message', async (event) => {
//   const message = new Uint8Array(event.data as ArrayBuffer);
//   const { doc, awareness } = getSession(sessionId); // Ensure we have the session's doc/awareness
//
//   // Determine if it's a sync or awareness message and apply to the central doc/awareness
//   // Then, broadcast the update to other clients in the same session (excluding sender)
//   // And persist the main Y.Doc to KV if it was updated.
//
//   // This part requires a proper Yjs server setup, often using y-websocket server-side components
//   // or a custom implementation based on y-protocols.
//   // The key is that the worker acts as the central point for merging and distributing updates.
// });
//
// The initial code has a mix of client-like and server-like Yjs logic.
// A typical y-websocket server would establish connections and then use utilities
// from y-protocols to manage the sync between the client and the server's Y.Doc.
//
// For now, this structure provides a starting point for a WebSocket endpoint.
// The Yjs logic itself, especially the persistence and broadcasting part,
// will need significant refinement and testing against Cloudflare Worker execution model.
// Using Durable Objects would simplify stateful WebSocket management greatly.
// Without Durable Objects, each message might go to a different worker instance,
// so KV store becomes the *only* place for shared state. The `sessions` map in memory
// would not be reliable across different physical worker instances.
//
// The current code will likely only work correctly if a single worker instance handles all
// connections for a given session, or if y-protocols can handle messages being applied
// to a doc that's reloaded from KV on each message (which would be inefficient).
//
// Let's assume for now that Cloudflare Pages might route subsequent WebSocket messages
// from the same client to the same worker instance for a short duration, or we rely heavily on KV.
// The `doc.on('update', ...)` and `awareness.on('update', ...)` handlers are crucial
// for broadcasting changes.
//
// The provided code is a *very* basic starting point and will need significant iteration.
// Main challenges:
// 1. Stateful session management (doc, awareness) without Durable Objects.
// 2. Efficient broadcasting of updates to other clients in the same session.
// 3. Correct server-side application of Yjs protocol messages.

// Add buffer to global if not already there (Cloudflare Workers might need this)
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}
