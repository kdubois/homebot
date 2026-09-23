import {LitElement, html, css} from 'lit';
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {PUBLIC_ENDPOINT, mcpCall, unwrap, callTool} from './mcp-client.js';

export class ChatBot extends LitElement {

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            border-radius: 12px;
            background: white;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
            overflow: hidden;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .message {
            max-width: 75%;
            padding: 0.7rem 1rem;
            border-radius: 16px;
            font-size: 0.95rem;
            line-height: 1.4;
            word-wrap: break-word;
            animation: fade-in 0.2s ease;
        }

        .message.bot {
            align-self: flex-start;
            background: rgba(203, 232, 237, 0.7);
            color: #333;
            border-bottom-left-radius: 4px;
            max-width: 85%;
        }

        .message.bot p { margin: 0 0 0.4em; }
        .message.bot p:last-child { margin-bottom: 0; }
        .message.bot ul, .message.bot ol { margin: 0.3em 0; padding-left: 1.3em; }
        .message.bot li { margin-bottom: 0.2em; }
        .message.bot strong { font-weight: 600; }
        .message.bot code { background: rgba(0,0,0,0.06); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
        .message.bot pre { background: rgba(0,0,0,0.06); padding: 0.5em; border-radius: 6px; overflow-x: auto; }
        .message.bot pre code { background: none; padding: 0; }

        .message.user {
            align-self: flex-end;
            background: rgb(157, 238, 244);
            color: #333;
            border-bottom-right-radius: 4px;
        }

        .message.loading {
            align-self: flex-start;
            background: rgba(203, 232, 237, 0.4);
            padding: 0.9rem 1.4rem;
        }

        /* MRTR confirm card */
        .confirm-card {
            align-self: flex-start;
            max-width: 88%;
            width: 100%;
            border: 1px solid rgba(237, 98, 128, 0.4);
            border-left: 4px solid rgba(237, 98, 128);
            border-radius: 10px;
            background: rgba(237, 98, 128, 0.05);
            padding: 0.85rem 1rem;
            animation: fade-in 0.2s ease;
        }
        .confirm-card .cc-title { font-weight: 600; color: #0f172a; font-size: 0.95rem; }
        .confirm-card .cc-range { font-size: 0.9rem; color: #334155; margin: 0.25rem 0 0.4rem; }
        .confirm-card .cc-note {
            font-size: 0.78rem; color: #64748b; line-height: 1.45; margin-bottom: 0.65rem;
        }
        .confirm-card .cc-note code { background: rgba(0,0,0,0.06); padding: 0.05em 0.3em; border-radius: 3px; font-size: 0.95em; }
        .confirm-card .cc-actions { display: flex; gap: 0.5rem; }
        .cc-btn {
            font-family: inherit; font-size: 0.85rem; font-weight: 600;
            border-radius: 18px; padding: 0.45rem 1rem; cursor: pointer; transition: opacity 0.15s;
            border: 1px solid rgba(237, 98, 128, 0.5); background: white; color: #333;
        }
        .cc-btn:hover { opacity: 0.85; }
        .cc-btn.primary { background: rgba(237, 98, 128); color: white; border-color: rgba(237, 98, 128); }
        .cc-btn:disabled { opacity: 0.55; cursor: wait; }
        .cc-status { font-size: 0.85rem; color: #334155; }

        .dots { display: flex; gap: 5px; }
        .dots span {
            width: 6px; height: 6px; border-radius: 50%;
            background: #999; animation: pulse 1.4s ease-in-out infinite;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }

        .input-area {
            display: flex;
            padding: 0.75rem;
            border-top: 1px solid #eee;
            gap: 0.5rem;
        }

        .input-area input {
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 20px;
            padding: 0.6rem 1rem;
            font-size: 0.95rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s;
        }

        .input-area input:focus {
            border-color: rgba(237, 98, 128, 0.6);
        }

        .input-area button {
            background: rgba(237, 98, 128);
            color: white;
            border: none;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s;
        }

        .input-area button:hover { opacity: 0.85; }

        @keyframes fade-in {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.4); }
        }
    `;

    constructor() {
        super();
        this._messages = [];
        this._loading = false;
        this._pendingConfirm = null;   // {tool, args, busy}
        this._admin = false;
        this._tools = {};
        this._openMsg = null;         // the bot message being streamed for the current turn
        this._turnTimer = null;
        marked.setOptions({gfm: true, breaks: true});
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadTools();

        const protocol = (window.location.protocol === 'https:') ? 'wss' : 'ws';
        this._socket = new WebSocket(protocol + '://' + window.location.host + '/chatbot');

        this._socket.onopen = () => {
            this._addMessage('bot', 'How can I help you today?');
        };

        this._socket.onmessage = (event) => {
            this._onMessage(event.data);
        };

        window.addEventListener('chatbot-send', (e) => this._send(e.detail));
        window.addEventListener('chatbot-admin-signin', () => this._adminSignIn());
        window.addEventListener('chatbot-admin-signout', () => this._adminSignOut());
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._turnTimer) clearTimeout(this._turnTimer);
        if (this._socket) this._socket.close();
    }

    // Fetch the public tool list once so the confirm flow can pass a real tool
    // definition to the MCP client (for any x-mcp-header parameters).
    async _loadTools() {
        try {
            const resp = await mcpCall(PUBLIC_ENDPOINT, null, 'tools/list', {}, null, null, null);
            (unwrap(resp, 'tools/list').tools || []).forEach(t => { this._tools[t.name] = t; });
        } catch (e) { /* tools/list is best-effort */ }
    }

    // LLM text arrives as many small WebSocket chunks with no end-of-turn marker.
    // Each burst of chunks is one turn: we accumulate it into a single bot message
    // and, as it builds up, watch for the confirm marker line (it can span chunks).
    // A short silence (or the next user message) ends the turn.
    _onMessage(chunk) {
        if (this._turnTimer) { clearTimeout(this._turnTimer); this._turnTimer = null; }
        if (!this._openMsg) {
            this._messages = [...this._messages, {role: 'bot', text: ''}];
            this._openMsg = this._messages[this._messages.length - 1];
        }
        this._openMsg.text += chunk;
        this.requestUpdate();
        this._scrollToBottom();
        this._turnTimer = setTimeout(() => { this._openMsg = null; this.requestUpdate(); }, 1000);

        if (!this._pendingConfirm) {
            const { text, req } = this._parseConfirm(this._openMsg.text);
            if (req) {
                this._openMsg.text = text;
                this._pendingConfirm = { tool: req.tool, args: req.args, busy: false };
                this.requestUpdate();
            }
        }
    }

    // The LLM signals a needed confirmation with one rigid line:
    //   [RANGE_CONFIRM] beginDate=YYYY-MM-DD endDate=YYYY-MM-DD [/RANGE_CONFIRM]
    // Returns {text, req} — text with the marker removed and req {tool, args},
    // or {text, req: null} when the marker is absent or malformed.
    _parseConfirm(text) {
        // The marker is one (possibly multi-line) block between [RANGE_CONFIRM] and
        // [/RANGE_CONFIRM]. We extract both dates from the block regardless of order,
        // separators, or backticks, so minor LLM formatting drift still parses.
        const block = text.match(/\[RANGE_CONFIRM\]([\s\S]*?)\[\/RANGE_CONFIRM\]/i);
        if (!block) return { text, req: null };
        const inner = block[1];
        const bd = inner.match(/beginDate\s*[:=]\s*`?(\d{4}-\d{2}-\d{2})/i);
        const ed = inner.match(/endDate\s*[:=]\s*`?(\d{4}-\d{2}-\d{2})/i);
        if (!bd || !ed) return { text: text.replace(block[0], '').trim(), req: null };
        return {
            text: text.replace(block[0], '').trim(),
            req: {
                tool: 'get_historical_weather',
                args: {
                    beginDate: bd[1],
                    endDate: ed[1],
                    scale: '1day',
                    sensorTypes: 'min_temp,max_temp'
                }
            }
        };
    }

    _addMessage(role, text) {
        this._messages = [...this._messages, {role, text}];
        this.requestUpdate();
        this._scrollToBottom();
    }

    _send(text) {
        if (!text.trim()) return;
        this._startTurn();
        this._addMessage('user', text);
        this._socket.send(text);
        this._scrollToBottom();
    }

    // Send text to the LLM without showing a user bubble (used by the confirm flow,
    // which shows its own short "Confirmed" bubble separately).
    _sendToLlm(text) {
        this._startTurn();
        this._socket.send(text);
    }

    // Begin a new turn: close any open bot message so the next burst of LLM chunks
    // starts a fresh bubble (not appended to the previous turn's message).
    _startTurn() {
        if (this._turnTimer) { clearTimeout(this._turnTimer); this._turnTimer = null; }
        this._openMsg = null;
        this._loading = true;
        this.requestUpdate();
    }

    _onSubmit(e) {
        e.preventDefault();
        const input = this.shadowRoot.querySelector('input');
        this._send(input.value);
        input.value = '';
    }

    // ---- admin sign-in (mirrors the Dashboard; reuses /dashboard/admin-token) ----
    async _adminSignIn() {
        try {
            const token = (await (await fetch('/dashboard/admin-token')).text()).trim();
            if (!token) throw new Error('no token');
            this._admin = true;
            this._socket.send('ADMIN-SIGNIN');
            this.requestUpdate();
            window.dispatchEvent(new CustomEvent('chatbot-admin-signed'));
        } catch (e) {
            this._addMessage('bot', 'Admin sign-in failed — the station auth service may be down. Please try again.');
        }
    }

    // The title dispatches 'chatbot-admin-signout'; we forward it to the backend so
    // the admin tools lock again for the rest of this chat session.
    _adminSignOut() {
        this._admin = false;
        this.requestUpdate();
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
            this._socket.send('ADMIN-SIGNOUT');
        }
    }

    // ---- MRTR confirm (B): the browser runs the fetch itself ----
    async _confirmRange() {
        const req = this._pendingConfirm;
        if (!req || req.busy) return;
        req.busy = true;
        this.requestUpdate();
        try {
            // The browser is elicitation-capable, so the server answers the re-run with
            // resultType: input_required (the same confirm form). The user's click on
            // this card IS that confirmation, so auto-accept the form and let the
            // round-trip converge to the real data.
            const onMrtr = async (ctx, result) => {
                const keys = Object.keys(result.inputRequests || {});
                if (keys.length !== 1) return null; // not the expected single confirm form
                const key = keys[0];
                return { [key]: { action: 'accept', content: { confirm: true } } };
            };
            const result = await callTool(PUBLIC_ENDPOINT, null, req.tool, req.args, this._tools[req.tool] || null, { onMrtr });
            const content = (result.content || [{}])[0];
            const text = content && content.text != null ? content.text : JSON.stringify(result);
            let data;
            try { data = JSON.parse(text); } catch (e) { data = {}; }
            const values = data.values || [];
            const table = values.slice(0, 12).map(v =>
                `| ${(v.timestamp || '').slice(0, 10)} | ${v.outdoorMinTemperature != null ? v.outdoorMinTemperature : '–'} | ${v.outdoorMaxTemperature != null ? v.outdoorMaxTemperature : '–'} |`
            ).join('\n');
            const note = data.limitedDataPoints
                ? ` (showing the first 12 of ${data.totalDataPoints} daily points — the full range was fetched)`
                : '';
            // Drop any still-streaming tail from the LLM's confirm turn (e.g. a trailing
            // "let me know if you'd like …") so it doesn't land as a stray bubble.
            this._pendingConfirm = null;
            this._openMsg = null;
            this.requestUpdate();
            this._addMessage('user', 'Confirmed the 3-month fetch.');
            this._sendToLlm(
                `I confirmed the fetch and it ran in my browser (the chat UI completed the MRTR round-trip). ` +
                `Here is the returned data — present a readable summary of outdoor min/max for ` +
                `${req.args.beginDate} to ${req.args.endDate}, plus the overall low/high and any notable days:\n` +
                `\`\`\`\ntotalDataPoints: ${data.totalDataPoints || values.length}${note}\n${table}\n\`\`\``);
        } catch (e) {
            this._addMessage('bot', 'The confirmed fetch failed: ' + e.message);
            req.busy = false;
            this.requestUpdate();
            return;
        }
    }

    _cancelConfirm() {
        this._pendingConfirm = null;
        this._openMsg = null;
        this._addMessage('user', 'No thanks — skip the 3-month fetch.');
        this._sendToLlm('No thanks — I declined the long-range fetch.');
    }

    _scrollToBottom() {
        requestAnimationFrame(() => {
            const el = this.shadowRoot?.querySelector('.messages');
            if (el) el.scrollTop = el.scrollHeight;
        });
    }

    _renderMarkdown(text) {
        const rawHtml = marked.parse(text, {breaks: true});
        return unsafeHTML(DOMPurify.sanitize(rawHtml));
    }

    _renderConfirmCard(req) {
        return html`
            <div class="confirm-card">
                <div class="cc-title">Confirm this 3-month fetch</div>
                <div class="cc-range">${req.args.beginDate} → ${req.args.endDate} · daily outdoor min/max</div>
                <div class="cc-note">This is <b>Multimodal Round-Trip (MRTR)</b>: the tool returned
                    <code>resultType: input_required</code> and is waiting for your answer before it fetches.
                    Confirming runs the fetch in <b>your browser</b> (this page is an MCP client).</div>
                ${req.busy
                    ? html`<div class="cc-status">Fetching ${req.args.beginDate} → ${req.args.endDate} in your browser…</div>`
                    : html`<div class="cc-actions">
                        <button class="cc-btn primary" @click=${this._confirmRange}>Confirm &amp; fetch</button>
                        <button class="cc-btn" @click=${this._cancelConfirm}>Cancel</button>
                    </div>`}
            </div>
        `;
    }

    render() {
        return html`
            <div class="messages">
                ${this._messages.map(m => html`
                    <div class="message ${m.role}">
                        ${m.role === 'bot' ? this._renderMarkdown(m.text) : m.text}
                    </div>
                `)}
                ${this._pendingConfirm ? this._renderConfirmCard(this._pendingConfirm) : ''}
                ${this._loading ? html`
                    <div class="message loading">
                        <div class="dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                ` : ''}
            </div>
            <form class="input-area" @submit=${this._onSubmit}>
                <input type="text" placeholder="Type your message..." autocomplete="off">
                <button type="submit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </form>
        `;
    }
}

customElements.define('chatbot-chat', ChatBot);
