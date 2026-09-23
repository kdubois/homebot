// Shared MCP 2026-07-28 (stateless) wire-protocol client for the dashboard.
// The browser is a first-class MCP client: it talks JSON-RPC directly to the
// netatmo server over Streamable HTTP, no session, no initialize. Adapted from
// netatmo's explorer.html (verified against the live server).

const PROTOCOL_VERSION = '2026-07-28';

// Absolute cross-origin URLs: the dashboard runs on homebot (8080) and the
// MCP server on netatmo (8091). CORS is configured on the server for these.
export const PUBLIC_ENDPOINT = 'http://localhost:8091/mcp';
export const ADMIN_ENDPOINT = 'http://localhost:8091/admin/mcp';
export const PROTOCOL = PROTOCOL_VERSION;

let requestId = 0;
export function nextId() { return ++requestId; }

// Per-request stateless metadata (required on every request).
export function baseMeta(clientName = 'mcp-dashboard') {
    return {
        'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientInfo': { name: clientName, version: '1.0' },
        // elicitation capability required for MRTR (resultType=input_required) tools
        'io.modelcontextprotocol/clientCapabilities': { elicitation: {} },
        'io.modelcontextprotocol/logLevel': 'info'
    };
}

// Stateless wire headers required by the server:
// Mcp-Method (all), Mcp-Name (tools/call, prompts/get -> name; resources/read -> uri),
// Mcp-Param-{x-mcp-header} (tools/call args annotated with x-mcp-header).
export function mcpHeaders(method, params, tool) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Protocol-Version': PROTOCOL_VERSION,
        'Mcp-Method': method
    };
    const name = (params && params.name) || (method === 'resources/read' && params && params.uri);
    if (method === 'tools/call' || method === 'prompts/get') {
        if (name) headers['Mcp-Name'] = name;
        if (method === 'tools/call' && tool && tool.inputSchema && params && params.arguments) {
            for (const [argName, schema] of Object.entries(tool.inputSchema.properties || {})) {
                if (schema && schema['x-mcp-header'] && params.arguments[argName] != null) {
                    headers['Mcp-Param-' + schema['x-mcp-header']] = String(params.arguments[argName]);
                }
            }
        }
    } else if (method === 'resources/read') {
        if (name) headers['Mcp-Name'] = name;
    }
    return headers;
}

export function parseSseFrame(raw) {
    let data = '';
    for (const line of raw.split('\n')) {
        if (line.startsWith('data:')) {
            const chunk = line.slice(5).replace(/^ /, '');
            data += (data ? '\n' : '') + chunk;
        }
    }
    if (!data) return null;
    try { return JSON.parse(data); } catch (e) { return null; }
}

async function readSse(resp, onFrame) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const obj = parseSseFrame(raw);
            if (obj) onFrame(obj);
        }
    }
    const last = parseSseFrame(buf);
    if (last) onFrame(last);
}

// Core JSON-RPC call. Handles application/json and text/event-stream.
// opts.onRequest(method, body) / opts.onResponse(obj) let the UI trace the wire.
export async function mcpCall(endpoint, token, method, params = {}, progressToken = null, onNotification = null, tool = null, opts = {}) {
    const p = { ...params };
    const meta = baseMeta();
    if (progressToken) meta.progressToken = progressToken;
    p._meta = meta;
    const body = { jsonrpc: '2.0', id: nextId(), method, params: p };
    const headers = mcpHeaders(method, p, tool);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (opts.onRequest) opts.onRequest(method, body, endpoint, token != null);

    let resp;
    try {
        resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (e) {
        const err = new Error('Network error: ' + e.message);
        err.network = true;
        throw err;
    }
    if (!resp.ok) {
        let errText = '';
        try { errText = (await resp.text()).slice(0, 200); } catch (e) {}
        const err = new Error('HTTP ' + resp.status + ' ' + resp.statusText + (errText ? ' - ' + errText : ''));
        err.status = resp.status;
        throw err;
    }

    const ct = resp.headers.get('content-type') || '';
    let result = null;
    if (ct.includes('text/event-stream')) {
        await readSse(resp, obj => {
            if (obj.id != null) {
                if (result == null) result = obj;
                if (opts.onResponse) opts.onResponse(obj);
            } else if (obj.method) {
                if (opts.onNotification) opts.onNotification(obj);
                if (onNotification) onNotification(obj);
            }
        });
    } else {
        result = await resp.json();
        if (opts.onResponse) opts.onResponse(result);
    }
    if (result == null) throw new Error('No JSON-RPC result received from ' + method);
    return result;
}

// Interpret a JSON-RPC response: returns the result, or throws with error detail.
export function unwrap(resp, method) {
    if (resp.error) {
        const e = new Error('JSON-RPC ' + resp.error.code + ': ' + resp.error.message);
        e.rpcError = resp.error;
        throw e;
    }
    if (resp.result == null) throw new Error('Empty result from ' + method);
    return resp.result;
}

// Convenience: run a tools/call and return its result (handles MRTR retry loop).
// opts.onMrtr(ctx, result) renders the input form; opts.onProgress(obj) streams progress.
export async function callTool(endpoint, token, name, args, toolDef, opts = {}) {
    const ctx = { name, arguments: args, progressToken: 'prog-' + nextId(), endpoint, token, toolDef };
    for (let round = 0; round < 4; round++) {
        const params = { name, arguments: args };
        if (ctx.inputResponses) params.inputResponses = ctx.inputResponses;
        if (ctx.requestState) params.requestState = ctx.requestState;
        const resp = await mcpCall(endpoint, token, 'tools/call',
            params,
            ctx.progressToken,
            obj => { if (opts.onProgress) opts.onProgress(obj); },
            toolDef, opts);
        const result = unwrap(resp, 'tools/call');
        if (result.resultType === 'input_required') {
            if (opts.onMrtr) {
                const inputResponses = await opts.onMrtr(ctx, result);
                if (inputResponses == null) {
                    throw new Error("User declined the server's input request.");
                }
                ctx.inputResponses = inputResponses;
                ctx.requestState = result.requestState;
                continue;
            }
            throw new Error('Server requested input (MRTR) but the client cannot handle it.');
        }
        return result;
    }
    throw new Error('MRTR did not converge after 4 rounds.');
}

// Open a subscriptions/listen stream (long-lived SSE). onFrame(obj) per notification.
// Returns an AbortController to close the subscription.
export function openListen(endpoint, onFrame, resourceSubscriptions = ['weather:///current']) {
    const params = {
        notifications: {
            toolsListChanged: true,
            promptsListChanged: true,
            resourcesListChanged: true,
            resourceSubscriptions
        }
    };
    const p = { ...params };
    p._meta = baseMeta();
    const body = { jsonrpc: '2.0', id: nextId(), method: 'subscriptions/listen', params: p };
    const abort = new AbortController();
    (async () => {
        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: mcpHeaders('subscriptions/listen', p),
                body: JSON.stringify(body),
                signal: abort.signal
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            await readSse(resp, onFrame);
        } catch (e) {
            if (e.name !== 'AbortError' && onFrame) onFrame({ error: e.message });
        }
    })();
    return abort;
}
