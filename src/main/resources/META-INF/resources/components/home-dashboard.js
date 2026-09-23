import {LitElement, html, css} from 'lit';
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js';
import {PUBLIC_ENDPOINT, ADMIN_ENDPOINT, PROTOCOL, mcpCall, unwrap, callTool, openListen} from './mcp-client.js';

// Relabel the generic MCP result types as user-facing states.
function rtLabel(r) {
    if (r === 'input_required') return 'asks you';
    if (r === 'complete') return 'complete';
    return r || 'result';
}

export class HomeDashboard extends LitElement {

    static properties = {
        version: {type: String, state: true},
        connected: {type: Boolean, state: true},
        serverInfo: {type: Object, state: true},
        caps: {type: Object, state: true},
        toolCount: {type: Number, state: true},
        resCount: {type: Number, state: true},
        promptCount: {type: Number, state: true},
        current: {type: Object, state: true},
        cache: {type: Object, state: true},
        chartData: {type: Array, state: true},
        devices: {type: Array, state: true},
        adminReady: {type: Boolean, state: true},
        adminUser: {type: String, state: true},
        adminBusy: {type: Boolean, state: true},
        compare: {type: Object, state: true},
        history3m: {type: Object, state: true},
        anomalies: {type: Object, state: true},
        diagnostics: {type: String, state: true},
        subOpen: {type: Boolean, state: true},
        feed: {type: Array, state: true},
        activity: {type: Array, state: true},
        trace: {type: Array, state: true},
        busy: {type: Object, state: true},
        progress: {type: Object, state: true},
        demo: {type: Object, state: true},
        devicePrefix: {type: String, state: true},
        completions: {type: Array, state: true},
        chartError: {type: String, state: true},
        _mrtrHtml: {type: Object, state: true},
        _okNotes: {type: Object, state: true},
        _lastErr: {type: String, state: true},
        _pulsed: {type: Object, state: true},
        _tick: {type: Number, state: true},
    };

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            background: var(--main-bg-color);
            padding: 1rem 1rem 3rem;
        }
        .wrap { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }

        .card {
            background: white; border-radius: 12px; padding: 1rem 1.25rem;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06); position: relative;
        }
        .card h3 { margin: 0 0 .25rem; font-size: 1rem; color: #222; display: flex; align-items: center; gap: .5rem; }
        .sub { color: #888; font-size: .8rem; margin: 0 0 .75rem; }
        .feat {
            position: absolute; top: .8rem; right: .9rem; font-size: .68rem; font-weight: 600;
            color: #4a5568; background: #eef2ff; border: 1px solid #dbe3ff; border-radius: 20px;
            padding: .1rem .55rem; letter-spacing: .02em;
        }
        .feat.live { color: #0f6e5a; background: #e6f6f1; border-color: #bfe6db; }
        .feat.lock { color: #7c3aed; background: #f3ecfe; border-color: #ddc9fb; }

        /* status */
        .status-line { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; font-size: .85rem; }
        .dot { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e0; flex-shrink: 0; }
        .dot.ok { background: #22c55e; }
        .dot.warn { background: #f59e0b; }
        .kv { color: #475569; }
        .kv b { color: #111827; font-weight: 600; }

        /* grid */
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }

        /* conditions */
        .temp-row { display: flex; gap: 1.5rem; margin: .4rem 0 .6rem; }
        .temp { }
        .temp .big { font-size: 2.1rem; font-weight: 700; color: #0f172a; line-height: 1; }
        .temp .lbl { font-size: .72rem; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
        .temp .out .big { color: #2563eb; }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5rem; margin-top: .5rem; }
        .metric { background: #f8fafc; border-radius: 8px; padding: .45rem .6rem; font-size: .8rem; }
        .metric .v { font-weight: 600; color: #0f172a; }
        .metric .k { color: #64748b; font-size: .7rem; }

        .chips { display: flex; gap: .5rem; align-items: center; margin-top: .8rem; flex-wrap: wrap; }
        .chip {
            font-size: .74rem; border-radius: 20px; padding: .22rem .6rem; border: 1px solid #e2e8f0;
            background: #f8fafc; color: #334155; display: inline-flex; align-items: center; gap: .35rem;
        }
        .chip .pdot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e0; }
        .chip.fresh .pdot { background: #22c55e; }
        .chip.cached .pdot { background: #f59e0b; }
        .chip.push { animation: push .9s ease; }
        @keyframes push {
            0% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
            70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); }
            100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        .row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-top: .8rem; }
        .btn {
            font-family: inherit; font-size: .82rem; font-weight: 600; padding: .5rem .9rem; border-radius: 8px;
            border: 1px solid #cbd5e1; background: white; color: #1f2937; cursor: pointer; transition: all .15s;
        }
        .btn:hover:not(:disabled) { background: #f1f5f9; border-color: #94a3b8; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn.primary { background: #e5518b; border-color: #e5518b; color: white; }
        .btn.primary:hover:not(:disabled) { background: #d13d78; }
        .btn.ghost { background: transparent; border-color: #e2e8f0; color: #475569; }
        .btn.small { padding: .35rem .7rem; font-size: .78rem; }

        /* chart */
        .chart { width: 100%; height: auto; display: block; }
        .legend { display: flex; gap: 1rem; font-size: .75rem; color: #475569; margin-top: .35rem; }
        .legend span { display: inline-flex; align-items: center; gap: .35rem; }
        .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }

        /* devices */
        .dev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .6rem; margin-top: .5rem; }
        .dev { border: 1px solid #eef1f5; border-radius: 10px; padding: .6rem .7rem; font-size: .82rem; }
        .dev .dn { font-weight: 600; color: #0f172a; }
        .dev .did { font-family: 'Red Hat Mono', monospace; font-size: .72rem; color: #64748b; word-break: break-all; }
        .dev .dtags { display: flex; gap: .3rem; flex-wrap: wrap; margin-top: .4rem; }
        .tag { font-size: .66rem; background: #f1f5f9; color: #475569; border-radius: 6px; padding: .1rem .35rem; }
        .dev .type { font-size: .68rem; color: #94a3b8; margin-top: .25rem; }

        .complete-box { margin-top: .9rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
        .complete-box input {
            font-family: 'Red Hat Mono', monospace; font-size: .78rem; border: 1px solid #cbd5e1; border-radius: 8px;
            padding: .4rem .6rem; width: 150px; outline: none;
        }
        .complete-box input:focus { border-color: #e5518b; }
        .completions { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .4rem; }

        /* progress */
        .progress { margin-top: .7rem; }
        .pbar { height: 6px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
        .pbar > div { height: 100%; background: #22c55e; width: 0; transition: width .2s ease; }
        .ptext { font-size: .72rem; color: #64748b; margin-top: .3rem; }

        /* results */
        .result { margin-top: .7rem; font-size: .82rem; }
        .err { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: .5rem .7rem; }
        .oknote { color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: .5rem .7rem; }
        table.data { border-collapse: collapse; width: 100%; margin-top: .5rem; font-size: .78rem; }
        table.data th, table.data td { border-bottom: 1px solid #eef1f5; padding: .35rem .5rem; text-align: left; }
        table.data th { color: #64748b; font-weight: 600; font-size: .72rem; }
        table.data td.num { font-variant-numeric: tabular-nums; text-align: right; }
        .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 640px) { .cmp-cols { grid-template-columns: 1fr; } }
        .cmp-sum { display: flex; gap: .6rem; margin-top: .5rem; font-size: .78rem; color: #334155; }
        .delta { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: .5rem .7rem; margin-top: .7rem; font-size: .82rem; }

        .finding { border-left: 3px solid #f59e0b; background: #fffbeb; border-radius: 6px; padding: .45rem .7rem; margin-top: .45rem; font-size: .8rem; }
        .finding .sev { font-size: .68rem; font-weight: 700; text-transform: uppercase; color: #b45309; }
        pre.diag { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: .7rem .9rem; font-size: .76rem; overflow-x: auto; margin-top: .6rem; white-space: pre-wrap; font-family: 'Red Hat Mono', monospace; }

        /* feed + activity */
        .feed { max-height: 190px; overflow-y: auto; display: flex; flex-direction: column; gap: .4rem; margin-top: .5rem; }
        .fline { font-size: .76rem; border: 1px solid #eef1f5; border-radius: 8px; padding: .4rem .6rem; background: #fbfdfe; display: flex; gap: .5rem; align-items: baseline; }
        .fline.updated { border-color: #bfe6db; background: #f2fbf8; }
        .fline .fm { font-weight: 600; color: #0f6e5a; font-family: 'Red Hat Mono', monospace; font-size: .72rem; }
        .fline .fts { margin-left: auto; color: #94a3b8; font-size: .68rem; }
        .act-list { display: flex; flex-direction: column; gap: .4rem; margin-top: .5rem; max-height: 190px; overflow-y: auto; }
        .act { font-size: .78rem; display: flex; gap: .5rem; align-items: baseline; border-bottom: 1px dashed #eef1f5; padding-bottom: .35rem; }
        .act .at { font-family: 'Red Hat Mono', monospace; color: #475569; font-size: .72rem; }
        .act .badge-admin { font-size: .62rem; font-weight: 700; color: #7c3aed; background: #f3ecfe; border-radius: 6px; padding: .05rem .35rem; }
        .act .am { color: #334155; }
        .act .ar { color: #94a3b8; font-size: .7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }

        /* trace */
        .trace { display: flex; flex-direction: column; gap: .35rem; margin-top: .5rem; max-height: 260px; overflow-y: auto; }
        .tline { display: grid; grid-template-columns: auto 1fr auto auto; gap: .5rem; align-items: baseline; font-size: .76rem; border-bottom: 1px dashed #eef1f5; padding-bottom: .3rem; }
        .tline .tm { font-family: 'Red Hat Mono', monospace; color: #2563eb; font-weight: 600; font-size: .72rem; }
        .tline .tt { font-family: 'Red Hat Mono', monospace; color: #475569; font-size: .72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tline .tdur { color: #94a3b8; font-size: .7rem; }
        .tline .ttag { font-size: .68rem; color: #475569; }
        .tline.admin .tm { color: #7c3aed; }
        .tline.err .ttag { color: #b91c1c; }

        /* MRTR modal */
        .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { background: white; border-radius: 14px; width: 460px; max-width: 92%; padding: 1.3rem 1.4rem; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
        .modal h4 { margin: 0 0 .3rem; font-size: 1rem; color: #0f172a; }
        .modal .msub { font-size: .8rem; color: #64748b; margin-bottom: .8rem; }
        .mfield { margin: .7rem 0; }
        .mfield label { display: flex; align-items: center; gap: .5rem; font-size: .86rem; color: #1f2937; }
        .mfield input[type=number], .mfield input[type=text] { margin-left: auto; width: 90px; border: 1px solid #cbd5e1; border-radius: 8px; padding: .35rem .5rem; font-family: inherit; }
        .mreq { font-size: .68rem; font-weight: 700; color: #b45309; }
        .mactions { display: flex; gap: .6rem; justify-content: flex-end; margin-top: 1.1rem; }
        .mnote { font-size: .74rem; color: #64748b; background: #f8fafc; border-radius: 8px; padding: .5rem .7rem; margin-top: .6rem; }

        /* demo */
        .demo-step { display: grid; grid-template-columns: auto 1fr; gap: .8rem; align-items: start; margin-top: .7rem; }
        .demo-n { width: 30px; height: 30px; border-radius: 50%; background: #e5518b; color: white; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: .9rem; }
        .demo-n.wait { background: #f59e0b; animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
        .demo-title { font-weight: 600; color: #0f172a; font-size: .92rem; }
        .demo-text { font-size: .82rem; color: #475569; margin-top: .2rem; }
        .demo-bar { display: flex; align-items: center; gap: .5rem; margin-top: .8rem; }
        .highlight { animation: ring 1.1s ease-in-out 2; border-radius: 12px; }
        @keyframes ring { 0%{box-shadow:0 0 0 0 rgba(229,81,139,.0)} 40%{box-shadow:0 0 0 6px rgba(229,81,139,.28)} 100%{box-shadow:0 0 0 0 rgba(229,81,139,0)} }

        .muted { color: #94a3b8; font-size: .8rem; }
        .divider { border: none; border-top: 1px solid #eef1f5; margin: .8rem 0 0; }
    `;

    constructor() {
        super();
        this.version = '';
        this.connected = false;
        this.serverInfo = {};
        this.caps = {};
        this.toolCount = 0; this.resCount = 0; this.promptCount = 0;
        this.current = null; this.cache = null;
        this.chartData = [];
        this.devices = [];
        this.adminReady = false; this.adminUser = ''; this.adminBusy = false;
        this.compare = null; this.history3m = null; this.anomalies = null; this.diagnostics = '';
        this.subOpen = false; this.feed = [];
        this.activity = []; this.trace = [];
        this.busy = {}; this.progress = null;
        this.demo = null;
        this.devicePrefix = ''; this.completions = [];
        this.chartError = null;
        this._pulsed = {}; this._okNotes = {}; this._tick = 0;
        this._cache = {};          // uri -> {result, ts, ttlMs}
        this._poll = null;
        this._activityTimer = null;
        this._completionsTimer = null;
        this._mrtr = null;         // {resolve, formId}
        this._listenAbort = null;
        this._opts = this._wireOpts();
    }

    _wireOpts() {
        return {
            onRequest: (method, body, endpoint, admin) => {
                const name = (body.params && (body.params.name || body.params.uri)) || '';
                this.trace = [{ method, target: name, endpoint: endpoint.split('8091/')[1] || endpoint, admin, t0: performance.now(), ok: null }, ...this.trace].slice(0, 40);
                this.requestUpdate();
            },
            onResponse: (obj) => {
                const last = this.trace[0];
                if (last) {
                    last.ok = obj.error ? ('err ' + obj.error.code) : (obj.result && obj.result.resultType) || 'ok';
                    last.dur = Math.round(performance.now() - last.t0);
                    this.trace = [...this.trace];
                    this.requestUpdate();
                }
            },
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this._init();
        this._poll = setInterval(() => this._pollCurrent(), 15000);
        this._activityTimer = setInterval(() => this._pollActivity(), 2500);
        this._tickTimer = setInterval(() => { this._tick = Date.now(); this._refreshCacheChip(); }, 1000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this._poll);
        clearInterval(this._activityTimer);
        clearInterval(this._tickTimer);
        clearInterval(this._completionsTimer);
        if (this._listenAbort) this._listenAbort.abort();
    }

    async _init() {
        await this._discover();
        await this._loadCurrent(false);
        await this._loadDevices();
        await this._loadChart();
        this._openListen();
        this._pollActivity();
    }

    // ---- server/discover ----
    async _discover() {
        try {
            const resp = await mcpCall(PUBLIC_ENDPOINT, null, 'server/discover', {}, null, null, null, this._opts);
            const r = unwrap(resp, 'server/discover');
            this.serverInfo = r.serverInfo || {};
            this.caps = r.capabilities || {};
            this.version = (r.serverInfo && r.serverInfo.version) || '';
            this.connected = true;
        } catch (e) {
            this.connected = false;
        }
        try {
            const t = unwrap(await mcpCall(PUBLIC_ENDPOINT, null, 'tools/list', {}, null, null, null, this._opts), 'tools/list');
            this.toolCount = (t.tools || []).length;
            window.__dashTools = {};
            (t.tools || []).forEach(x => window.__dashTools[x.name] = x);
            const res = unwrap(await mcpCall(PUBLIC_ENDPOINT, null, 'resources/list', {}, null, null, null, this._opts), 'resources/list');
            this.resCount = (res.resources || []).length;
            try {
                const pr = unwrap(await mcpCall(PUBLIC_ENDPOINT, null, 'prompts/list', {}, null, null, null, this._opts), 'prompts/list');
                this.promptCount = (pr.prompts || []).length;
            } catch (e) { this.promptCount = 0; }
        } catch (e) { /* leave counts at 0 */ }
    }

    // ---- current conditions (resource + TTL cache + push) ----
    _cacheValid(uri) {
        const c = this._cache[uri];
        return c && c.ttlMs > 0 && (Date.now() - c.ts) < c.ttlMs;
    }

    async _loadCurrent(force) {
        const uri = 'weather:///current';
        if (!force && this._cacheValid(uri)) {
            const c = this._cache[uri];
            const ageS = ((Date.now() - c.ts) / 1000).toFixed(0);
            const ttlS = Math.round(c.ttlMs / 1000);
            this.current = this._parseCurrent(c.result.contents);
            this.cache = { source: 'cache', ageS, ttlS, remainingS: Math.max(0, Math.round((c.ttlMs - (Date.now() - c.ts)) / 1000)) };
            return;
        }
        try {
            const resp = await mcpCall(PUBLIC_ENDPOINT, null, 'resources/read', { uri }, null, null, null, this._opts);
            const r = unwrap(resp, 'resources/read');
            const ttlMs = (r.ttlMs != null) ? r.ttlMs : 0;
            this._cache[uri] = { result: r, ts: Date.now(), ttlMs };
            this.current = this._parseCurrent(r.contents);
            this.cache = { source: 'fetch', ttlS: Math.round(ttlMs / 1000), remainingS: Math.round(ttlMs / 1000) };
            if (this.current) this.current._fetched = true;
        } catch (e) {
            this.current = null;
            this.cache = { source: 'error', msg: e.message };
        }
    }

    _parseCurrent(contents) {
        if (!contents || !contents[0] || !contents[0].text) return null;
        try { return JSON.parse(contents[0].text); } catch (e) { return null; }
    }

    async _pollCurrent() {
        await this._loadCurrent(false);
    }

    async _refreshCurrent() {
        this.busy = { ...this.busy, refreshCur: true };
        this.requestUpdate();
        try {
            await this._loadCurrent(true);
            if (this.current) this.current._fetched = true;
            this.cache = this.cache ? Object.assign({}, this.cache, { source: 'fetch' }) : this.cache;
        } finally {
            this.busy = { ...this.busy, refreshCur: false };
        }
    }

    // Recompute the cache chip (age / remaining) every second so the TTL
    // countdown is live. When the countdown reaches 0 the 15s poll refetches,
    // so the chip flips from "served from cache" back to "fetched".
    _refreshCacheChip() {
        const c = this._cache['weather:///current'];
        if (!c || !this.cache || this.cache.source === 'error') return;
        const ageS = ((Date.now() - c.ts) / 1000).toFixed(0);
        const ttlS = Math.round(c.ttlMs / 1000);
        const remainingS = Math.max(0, Math.round((c.ttlMs - (Date.now() - c.ts)) / 1000));
        this.cache = { source: remainingS > 0 ? 'cache' : 'fetch', ageS, ttlS, remainingS };
        this.requestUpdate();
    }

    // ---- week chart (get_historical_weather, 7 days) ----
    _iso(d) { return d.toISOString().slice(0, 10); }

    async _loadChart() {
        const end = new Date();
        const begin = new Date(end.getTime() - 6 * 86400000);
        const tool = (window.__dashTools || {})['get_historical_weather'];
        try {
            const r = await callTool(PUBLIC_ENDPOINT, null, 'get_historical_weather',
                { beginDate: this._iso(begin), endDate: this._iso(end), scale: '1day', sensorTypes: 'min_temp,max_temp' }, tool, this._opts);
            const data = JSON.parse(this._contentText(r));
            this.chartData = (data.values || []).map(v => ({
                t: (v.timestamp || '').slice(5, 10),
                oMax: v.outdoorMaxTemperature, oMin: v.outdoorMinTemperature,
            })).filter(x => x.oMax != null);
            this.chartError = null;
        } catch (e) {
            this.chartError = e.message;
        }
    }

    // ---- devices (tool + completion) ----
    async _loadDevices() {
        try {
            const tool = (window.__dashTools || {})['get_available_devices'];
            const r = await callTool(PUBLIC_ENDPOINT, null, 'get_available_devices', {}, tool, this._opts);
            const txt = (r.content || [{}])[0].text || '[]';
            this.devices = JSON.parse(txt);
        } catch (e) { this.devices = []; }
    }

    _onDeviceInput(e) {
        this.devicePrefix = e.target.value;
        if (this._completionsTimer) clearTimeout(this._completionsTimer);
        this._completionsTimer = setTimeout(() => this._completeDevices(), 300);
    }

    async _completeDevices() {
        try {
            const resp = await mcpCall(PUBLIC_ENDPOINT, null, 'completion/complete', {
                ref: { type: 'ref/prompt', name: 'device_diagnostics' },
                argument: { name: 'deviceId', value: this.devicePrefix }
            }, null, null, null, this._opts);
            const r = unwrap(resp, 'completion/complete');
            this.completions = (r.completion && r.completion.values) || [];
        } catch (e) { this.completions = []; }
    }

    // ---- admin ----
    async _signInAdmin() {
        this.adminBusy = true; this.requestUpdate();
        try {
            const tok = await (await fetch('/dashboard/admin-token')).text();
            if (!tok || tok.startsWith('5') || tok.startsWith('4')) throw new Error(tok.slice(0, 60) || 'no token');
            this._adminToken = tok;
            const r = unwrap(await mcpCall(ADMIN_ENDPOINT, tok, 'server/discover', {}, null, null, null, this._opts), 'server/discover');
            this.adminReady = true;
            this.adminUser = (r.serverInfo && r.serverInfo.name) || 'admin';
            window.__dashAdminTools = {};
            const tl = unwrap(await mcpCall(ADMIN_ENDPOINT, tok, 'tools/list', {}, null, null, null, this._opts), 'tools/list');
            (tl.tools || []).forEach(x => window.__dashAdminTools[x.name] = x);
        } catch (e) {
            this.adminReady = false;
            this._toastErr('Admin sign-in failed: ' + e.message);
        } finally {
            this.adminBusy = false;
        }
    }

    _needAdmin() {
        if (!this.adminReady) {
            this._toastErr('Sign in to unlock admin actions.');
            this._flashCard('admin-card');
            return false;
        }
        return true;
    }

    _lastTwoWeeks() {
        const day = 86400000, now = new Date();
        const p2End = now, p2Start = new Date(now.getTime() - 6 * day);
        const p1End = new Date(now.getTime() - 7 * day), p1Start = new Date(now.getTime() - 13 * day);
        return {
            period1Start: this._iso(p1Start), period1End: this._iso(p1End),
            period2Start: this._iso(p2Start), period2End: this._iso(p2End)
        };
    }

    async _runCompare() {
        if (!this._needAdmin()) return;
        this.busy.compare = true; this.requestUpdate();
        try {
            const tool = (window.__dashAdminTools || {})['compare_periods'];
            const r = await callTool(ADMIN_ENDPOINT, this._adminToken, 'compare_periods', this._lastTwoWeeks(), tool, this._opts);
            this.compare = r.structuredContent || this._contentText(r);
            this._pushOk('compare', 'Compared two weeks via the admin `compare_periods` tool.');
        } catch (e) {
            this._toastErr('Compare failed: ' + e.message);
        } finally {
            this.busy.compare = false;
        }
    }

    async _runAnomaly() {
        if (!this._needAdmin()) return;
        this.busy.anomaly = true; this.requestUpdate();
        try {
            const tool = (window.__dashAdminTools || {})['run_anomaly_scan'];
            const r = await callTool(ADMIN_ENDPOINT, this._adminToken, 'run_anomaly_scan', { days: 14 }, tool, this._opts);
            this.anomalies = r.structuredContent || this._contentText(r);
            this._pushOk('anomaly', 'Anomaly scan complete.');
        } catch (e) {
            this._toastErr('Anomaly scan failed: ' + e.message);
        } finally {
            this.busy.anomaly = false;
        }
    }

    async _runDiagnostics() {
        if (!this._needAdmin()) return;
        this.busy.diag = true; this.requestUpdate();
        try {
            const tool = (window.__dashAdminTools || {})['get_station_diagnostics'];
            const r = await callTool(ADMIN_ENDPOINT, this._adminToken, 'get_station_diagnostics', {}, tool, this._opts);
            this.diagnostics = this._contentText(r);
        } catch (e) {
            this._toastErr('Diagnostics failed: ' + e.message);
        } finally {
            this.busy.diag = false;
        }
    }

    async _runRefresh() {
        if (!this._needAdmin()) return;
        this.busy.refresh = true; this.requestUpdate();
        try {
            const tool = (window.__dashAdminTools || {})['refresh_station_data'];
            await callTool(ADMIN_ENDPOINT, this._adminToken, 'refresh_station_data', {}, tool, this._opts);
            this._pushOk('refresh', 'Station refreshed. Watch the live feed and the conditions card.');
        } catch (e) {
            this._toastErr('Refresh failed: ' + e.message);
        } finally {
            this.busy.refresh = false;
        }
    }

    _contentText(r) {
        const c = (r.content || [{}])[0];
        return c && c.text != null ? c.text : JSON.stringify(r);
    }

    // ---- 3-month history (MRTR) ----
    _fmtMonthsAgo(months) {
        const d = new Date();
        d.setMonth(d.getMonth() - months);
        return d.toISOString().slice(0, 10);
    }

    async _runHistory3m() {
        this.busy.history3m = true; this.requestUpdate();
        try {
            const tool = (window.__dashTools || {})['get_historical_weather'];
            const r = await callTool(PUBLIC_ENDPOINT, null, 'get_historical_weather',
                { beginDate: this._fmtMonthsAgo(3), endDate: this._iso(new Date()), scale: '1day', sensorTypes: 'min_temp,max_temp' },
                tool, {
                    ...this._opts,
                    onProgress: (obj) => this._onProgress(obj),
                    onMrtr: (ctx, result) => this._mrtrPrompt(ctx, result)
                });
            const data = JSON.parse(this._contentText(r));
            this.history3m = {
                dataPoints: data.totalDataPoints || (data.values || []).length,
                begin: data.beginTime || this._fmtMonthsAgo(3),
                end: data.endTime || this._iso(new Date()),
                values: data.values || []
            };
            this._pushOk('history3m', 'Fetched 3 months of history (daily aggregates).');
        } catch (e) {
            if (e.message && e.message.includes('declined')) this._pushOk('history3m', 'You declined. The 3-month fetch was cancelled cleanly.');
            else this._toastErr('History fetch failed: ' + e.message);
        } finally {
            this.busy.history3m = false;
            this.progress = null;
        }
    }

    // Render the MRTR form as a modal; resolves with inputResponses (or null on decline).
    _mrtrPrompt(ctx, result) {
        const formId = 'mrtr-' + Date.now();
        const entries = Object.entries(result.inputRequests || {});
        let fields = '';
        entries.forEach(([key, entry]) => {
            const p = entry.params || {};
            const schema = p.requestedSchema || {};
            const props = schema.properties || {};
            const required = schema.required || [];
            let inputs = '';
            for (const [propName, ps] of Object.entries(props)) {
                const title = ps.title || ps.description || propName;
                const req = required.includes(propName) ? ' <span class="mreq">required</span>' : '';
                if (ps.type === 'boolean') {
                    inputs += `<label class="mfield"><input type="checkbox" data-mrtr="${formId}" data-key="${key}" data-prop="${propName}" data-type="boolean"> ${title}${req}</label>`;
                } else if (ps.type === 'number' || ps.type === 'integer') {
                    inputs += `<label class="mfield">${title}${req}<input type="number" data-mrtr="${formId}" data-key="${key}" data-prop="${propName}" data-type="number"></label>`;
                } else {
                    inputs += `<label class="mfield">${title}${req}<input type="text" data-mrtr="${formId}" data-key="${key}" data-prop="${propName}" data-type="string"></label>`;
                }
            }
            fields += `<div class="mfield"><div style="font-weight:600;color:#0f172a;font-size:.86rem;">${p.message || key}</div>${inputs || '<div class="muted">(no schema properties)</div>'}</div>`;
        });

        const msg = entries.length ? entries[0][1].params.message : 'The server needs a decision before continuing.';
        this._mrtrHtml = {
            formId, fields, msg,
            note: 'This is <b>Multimodal Round-Trip (MRTR)</b>: the tool returned <code>resultType: input_required</code> and is waiting for your answer before it fetches.'
        };
        this.requestUpdate();

        return new Promise((resolve) => {
            this._mrtr = { formId, resolve, requestState: result.requestState };
        });
    }

    _collectMrtr() {
        const { formId } = this._mrtr;
        const inputs = this.shadowRoot.querySelectorAll('[data-mrtr="' + formId + '"]');
        const contentBy = {};
        inputs.forEach(inp => {
            const { key, prop, type } = inp.dataset;
            contentBy[key] = contentBy[key] || {};
            if (type === 'boolean') contentBy[key][prop] = inp.checked;
            else if (type === 'number') contentBy[key][prop] = (inp.value === '' || inp.value == null) ? null : Number(inp.value);
            else contentBy[key][prop] = inp.value;
        });
        return contentBy;
    }

    _resolveMrtr(action) {
        const { resolve, requestState } = this._mrtr;
        this._mrtr = null;
        this._mrtrHtml = null;
        if (action === 'decline') { resolve(null); return; }
        const contentBy = this._collectMrtr();
        const inputResponses = {};
        Object.keys(contentBy).forEach(key => { inputResponses[key] = { action: 'accept', content: contentBy[key] }; });
        resolve(inputResponses);
    }

    _onProgress(obj) {
        const params = obj.params || {};
        const prog = params.progress != null ? params.progress : (params._meta && params._meta.progress);
        if (prog != null) {
            const pct = prog.total ? Math.round((prog.value / prog.total) * 100) : null;
            this.progress = { value: prog.value, total: prog.total, pct, message: obj.params && obj.params.message };
        } else {
            this.progress = { message: (params && (params.message || params.data)) || obj.method };
        }
    }

    // ---- subscriptions/listen (live push) ----
    _openListen() {
        this._listenAbort = openListen(PUBLIC_ENDPOINT, (obj) => this._onLive(obj), ['weather:///current']);
        this.subOpen = true;
        this.requestUpdate();
    }

    _onLive(obj) {
        if (obj.error) { this.subOpen = false; this._pushFeed('listen-error', obj.error, false); return; }
        if (!obj.method) return;
        const m = obj.method;
        if (m === 'notifications/resources/updated') {
            this._pushFeed(m, this._subId(obj), true);
            this._onResourceUpdated();
        } else if (m === 'notifications/subscriptions/acknowledged') {
            this._pushFeed(m, this._subId(obj), false);
        } else if (m === 'notifications/list_changed' || m.endsWith('list_changed') || m === 'notifications/tools/list_changed') {
            this._pushFeed(m, this._subId(obj), false);
        }
    }

    _subId(obj) {
        const meta = (obj.params && obj.params._meta) || obj._meta || {};
        return meta['io.modelcontextprotocol/subscriptionId'] != null ? ('sub #' + meta['io.modelcontextprotocol/subscriptionId']) : '';
    }

    _pushFeed(method, subId, isUpdated) {
        this.feed = [{ method, subId, isUpdated, ts: new Date().toISOString().slice(11, 19) }, ...this.feed].slice(0, 30);
        this.requestUpdate();
    }

    // A resource/updated push arrived: bust the cache, refetch, pulse the card.
    async _onResourceUpdated() {
        delete this._cache['weather:///current'];
        this._pulseCard('current-card');
        await this._loadCurrent(true);
    }

    _pulseCard(id) {
        this._pulsed = { ...this._pulsed, [id]: Date.now() };
        this.requestUpdate();
        setTimeout(() => { this._pulsed = { ...this._pulsed, [id]: 0 }; this.requestUpdate(); }, 1000);
    }

    _flashCard(id) {
        const el = this.shadowRoot.getElementById(id);
        if (el) { el.classList.add('highlight'); setTimeout(() => el.classList.remove('highlight'), 2400); }
    }

    // ---- activity from the AI chat (homebot observers) ----
    async _pollActivity() {
        try {
            const arr = await (await fetch('/dashboard/activity')).json();
            this.activity = (arr || []).slice(-12).reverse().map(s => {
                try { const o = JSON.parse(s); return o; } catch (e) { return { type: 'raw', message: s }; }
            });
            this.requestUpdate();
        } catch (e) { /* ignore */ }
    }

    _pushOk(id, msg) {
        this._okNotes = { ...this._okNotes, [id]: msg };
        this.requestUpdate();
        setTimeout(() => { const n = { ...this._okNotes }; delete n[id]; this._okNotes = n; this.requestUpdate(); }, 6000);
    }

    _toastErr(msg) { this._lastErr = msg; this.requestUpdate(); setTimeout(() => { this._lastErr = null; this.requestUpdate(); }, 6000); }

    // ---- demo mode ----
    _demoSteps() {
        const flash = (id) => this._flashCard(id);
        return [
            { t: 'Connect (stateless)', x: 'There is no "log in to the MCP server". The first thing the browser does is ask for server/discover. Protocol 2026-07-28 is stateless: every request carries the client version and capabilities, no session, no handshake.', run: () => { flash('status-card'); return this._discover(); } },
            { t: 'Live weather', x: 'This card is a read of the MCP resource weather:///current. It declares a 60-second cache (ttlMs) so it does not hammer the station.', run: () => { flash('current-card'); return this._refreshCurrent(); } },
            { t: 'The cache works', x: 'Read the same resource again within the TTL. The browser serves it from its own cache, so the chip says "served from cache".', run: async () => { flash('current-card'); await this._loadCurrent(false); return this._loadCurrent(false); } },
            { t: 'Live push (subscriptions)', x: 'The browser subscribed with subscriptions/listen and is now listening. Press "Refresh station" (next step) and watch this feed receive a resources/updated notification, with the card refetching and pulsing.', run: () => { flash('feed-card'); return Promise.resolve(); } },
            { t: 'MRTR: a tool that asks you', x: 'Asking for 3 months is a lot of data, so the tool stops and asks for confirmation (resultType: input_required). Decide in the dialog.', interactive: 'history3m', run: () => { flash('actions-card'); return this._runHistory3m(); } },
            { t: 'Sign in to unlock admin', x: 'The admin tools are protected by OIDC. One click exchanges the app credentials for a bearer token; the browser then calls the protected /admin/mcp server.', run: () => { flash('admin-card'); return this._signInAdmin(); } },
            { t: 'Compare the last 2 weeks', x: 'A protected admin tool returns structured data; the dashboard renders it as a chart and a day-by-day table with like-for-like deltas.', run: () => { flash('compare-card'); return this._runCompare(); } },
            { t: 'Trigger the live push', x: 'Refresh the station. The server fires a resources/updated notification to every subscriber - watch the live feed and the conditions card pulse.', run: () => { flash('feed-card'); return this._runRefresh(); } },
            { t: 'The AI also speaks MCP', x: 'The AI Chat tab is a second MCP client (via the LangChain4j MCP client). Every tool it runs shows up in the Activity panel here. Chat with it and watch it appear.', run: () => { flash('activity-card'); return Promise.resolve(); } },
        ];
    }

    _startDemo() {
        this.demo = { i: -1, running: true, steps: this._demoSteps(), waiting: false };
        this._demoNext();
    }

    _demoNext() {
        const d = this.demo;
        if (!d) return;
        if (d.i >= d.steps.length - 1) {
            d.running = false;
            d.done = true;
            this.requestUpdate();
            return;
        }
        d.i++;
        const step = d.steps[d.i];
        d.waiting = false;
        d.result = '';
        this.requestUpdate();
        if (step.interactive) {
            d.waiting = true;
            this.requestUpdate();
            setTimeout(() => step.run().catch(() => {}).then(() => this._demoAwaiting()), 350);
        } else {
            step.run().then(() => {
                if (this.demo === d) setTimeout(() => this._demoNext(), 1700);
            }).catch(e => {
                if (this.demo === d) { d.result = 'Note: ' + e.message; setTimeout(() => this._demoNext(), 2500); }
            });
        }
    }

    _stopDemo() { this.demo = null; this.requestUpdate(); }

    _demoAwaiting() {
        // called when the interactive step resolves (MRTR accepted or declined)
        const d = this.demo;
        if (d && d.waiting) { d.waiting = false; this.requestUpdate(); setTimeout(() => this._demoNext(), 1800); }
    }

    // ---- rendering helpers ----
    _chart() {
        const data = this.chartData;
        if (this.chartError) return html`<div class="err">${this.chartError}</div>`;
        if (!data || data.length < 2) return html`<div class="muted">Loading weekly data…</div>`;
        const W = 480, H = 150, padL = 30, padB = 22, padT = 12, padR = 8;
        const all = [];
        data.forEach(d => { if (d.oMax != null) all.push(d.oMax); if (d.oMin != null) all.push(d.oMin); });
        const lo = Math.min(...all) - 1, hi = Math.max(...all) + 1;
        const x = i => padL + (i / (data.length - 1)) * (W - padL - padR);
        const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
        const line = (key) => data.map((d, i) => d[key] != null ? `${x(i)},${y(d[key])}` : null).filter(Boolean).join(' ');
        const grid = [0, .5, 1].map(f => {
            const v = lo + f * (hi - lo);
            return `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" stroke="#eef1f5" stroke-width="1"/><text x="2" y="${y(v) + 3}" font-size="9" fill="#94a3b8">${v.toFixed(0)}°</text>`;
        }).join('');
        const dots = data.map((d, i) => d.oMax != null ? `<circle cx="${x(i)}" cy="${y(d.oMax)}" r="2.5" fill="#2563eb"/><text x="${x(i)}" y="${H - 6}" font-size="8" fill="#94a3b8" text-anchor="middle">${d.t}</text>` : '').join('');
        return html`
            <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
                ${grid}
                <polyline points="${line('oMax')}" fill="none" stroke="#2563eb" stroke-width="2"/>
                <polyline points="${line('oMin')}" fill="none" stroke="#93c5fd" stroke-width="2"/>
                ${dots}
            </svg>
            <div class="legend">
                <span><i class="swatch" style="background:#2563eb"></i> Outdoor high</span>
                <span><i class="swatch" style="background:#93c5fd"></i> Outdoor low</span>
            </div>`;
    }

    _cmpPeriod(p) {
        if (!p) return '';
        return html`
            <div>
                <div style="font-weight:600;color:#0f172a;font-size:.85rem;">${p.label || ''}</div>
                <table class="data">
                    <tr><th>Date</th><th style="text-align:right">Min</th><th style="text-align:right">Max</th></tr>
                    ${(p.days || []).map(d => html`<tr><td>${d.date}</td><td class="num">${d.min != null ? d.min + '°' : '–'}</td><td class="num">${d.max != null ? d.max + '°' : '–'}</td></tr>`)}
                </table>
                <div class="cmp-sum">
                    <span>avg <b>${p.avgMin != null ? p.avgMin : '–'}</b>/<b>${p.avgMax != null ? p.avgMax : '–'}</b></span>
                    <span>range <b>${p.rangeMin != null ? p.rangeMin : '–'}</b>…<b>${p.rangeMax != null ? p.rangeMax : '–'}</b></span>
                </div>
            </div>`;
    }

    render() {
        const c = this.current;
        const cache = this.cache;
        const demo = this.demo;
        const curStep = demo && demo.i >= 0 && demo.i < demo.steps.length ? demo.steps[demo.i] : null;

        return html`
            <div class="wrap">

                ${this._lastErr ? html`<div class="card err" style="border-radius:12px;">${this._lastErr}</div>` : ''}

                <!-- status -->
                <div class="card" id="status-card">
                    <span class="feat">server/discover</span>
                    <h3>MCP connection</h3>
                    <p class="sub">The browser is a stateless MCP client talking to the netatmo server.</p>
                    <div class="status-line">
                        <span class="dot ${this.connected ? 'ok' : 'warn'}"></span>
                        <span class="kv">${this.connected ? 'Connected' : 'Connecting…'}</span>
                        <span class="kv">· protocol <b>${PROTOCOL}</b> (stateless)</span>
                        <span class="kv">· <b>${this.toolCount}</b> tools · <b>${this.resCount}</b> resources · <b>${this.promptCount}</b> prompts</span>
                    </div>
                    <div class="status-line" style="margin-top:.5rem;">
                        <span class="dot ${this.adminReady ? 'ok' : ''}"></span>
                        <span class="kv">${this.adminReady ? 'Admin: ' + this.adminUser + ' (OIDC token)' : 'Admin: signed out'}</span>
                        <span class="dot ${this.subOpen ? 'ok' : ''}" style="margin-left:.6rem;"></span>
                        <span class="kv">${this.subOpen ? 'Live subscription open' : 'Live subscription closed'}</span>
                    </div>
                </div>

                <!-- demo banner -->
                ${demo ? html`
                <div class="card" id="demo-card" style="border:1px solid #f3c9dc;">
                    <h3 style="display:flex;align-items:center;gap:.5rem;">
                        <span style="background:#e5518b;color:white;border-radius:20px;font-size:.68rem;padding:.1rem .55rem;">DEMO</span>
                        ${demo.done ? 'Demo complete' : (curStep ? 'Step ' + (demo.i + 1) + ' / ' + demo.steps.length : '…')}
                        ${!demo.done ? html`<button class="btn small ghost" style="margin-left:auto;" @click=${this._stopDemo}>Stop</button>` : ''}
                    </h3>
                    ${curStep ? html`
                        <div class="demo-step">
                            <div class="demo-n ${demo.waiting ? 'wait' : ''}">${demo.i + 1}</div>
                            <div>
                                <div class="demo-title">${curStep.t}</div>
                                <div class="demo-text">${curStep.x}</div>
                                ${demo.waiting ? html`<div class="muted" style="margin-top:.5rem;">Waiting for you — act on the screen, then continue.</div>` : ''}
                            </div>
                        </div>` : ''}
                    ${demo.done ? html`<div class="demo-text" style="margin-top:.6rem;">That was the whole protocol tour. Everything you saw is the real, stateless 2026-07-28 wire protocol, driven from this page.</div>
                        <div class="row"><button class="btn primary small" @click=${this._startDemo}>Run demo again</button></div>` : ''}
                </div>` : html`
                <div class="card" id="demo-card">
                    <div class="row" style="margin-top:0;">
                        <h3 style="margin:0;">See MCP in action</h3>
                        <button class="btn primary small" style="margin-left:auto;" @click=${this._startDemo}>Run guided demo</button>
                    </div>
                    <p class="sub">A 90-second tour that drives every MCP feature for real: stateless connect, resources + cache, live subscriptions, MRTR, OIDC admin, structured results, and the AI chat.</p>
                </div>`}

                <!-- conditions + chart -->
                <div class="grid">
                    <div class="card" id="current-card">
                        <span class="feat ${this.subOpen ? 'live' : ''}">resource · TTL cache · push</span>
                        <h3>Current conditions</h3>
                        <p class="sub">${c ? c.stationName : '…'}</p>
                        ${c ? html`
                        <div class="temp-row">
                            <div class="temp"><div class="big">${c.indoorTemperature != null ? c.indoorTemperature + '°' : '–'}</div><div class="lbl">Indoor</div></div>
                            <div class="temp out"><div class="big">${c.outdoorTemperature != null ? c.outdoorTemperature + '°' : '–'}</div><div class="lbl">Outdoor</div></div>
                        </div>
                        <div class="metrics">
                            <div class="metric"><div class="v">${c.indoorHumidity != null ? c.indoorHumidity + '%' : '–'}</div><div class="k">Indoor humidity</div></div>
                            <div class="metric"><div class="v">${c.outdoorHumidity != null ? c.outdoorHumidity + '%' : '–'}</div><div class="k">Outdoor humidity</div></div>
                            <div class="metric"><div class="v">${c.pressure != null ? c.pressure + ' hPa' : '–'}</div><div class="k">Pressure</div></div>
                            <div class="metric"><div class="v">${c.co2 != null ? c.co2 + ' ppm' : '–'}</div><div class="k">CO₂</div></div>
                        </div>` : '<div class="muted">Loading…</div>'}
                        <div class="chips">
                            ${cache && cache.source === 'fetch' ? html`<span class="chip fresh ${this._pulsed['current-card'] ? 'push' : ''}"><span class="pdot"></span> fetched · ttl ${cache.ttlS}s</span>` : ''}
                            ${cache && cache.source === 'cache' ? html`<span class="chip cached ${this._pulsed['current-card'] ? 'push' : ''}"><span class="pdot"></span> served from cache · age ${cache.ageS}s${cache.remainingS > 1 ? ' · ' + cache.remainingS + 's left' : ''}</span>` : ''}
                            ${cache && cache.source === 'error' ? html`<span class="chip"><span class="pdot" style="background:#ef4444"></span> error</span>` : ''}
                        </div>
                        <div class="row">
                            <button class="btn small" @click=${this._refreshCurrent} ?disabled=${this.busy.refreshCur}>Refresh now</button>
                            <span class="muted">cacheScope private · refreshed on push</span>
                        </div>
                    </div>

                    <div class="card" id="chart-card">
                        <span class="feat">get_historical_weather</span>
                        <h3>Last 7 days</h3>
                        <p class="sub">Outdoor high / low, daily scale.</p>
                        ${this._chart()}
                    </div>
                </div>

                <!-- devices -->
                <div class="card" id="devices-card">
                    <span class="feat">tool + completion/complete</span>
                    <h3>Devices</h3>
                    <p class="sub">From the <code>get_available_devices</code> tool. Type a device ID below and the server autocompletes it.</p>
                    <div class="dev-grid">
                        ${(this.devices || []).map(d => html`
                            <div class="dev">
                                <div class="dn">${d.name}</div>
                                <div class="did">${d.id}</div>
                                <div class="type">${d.type || ''}</div>
                                <div class="dtags">${(d.dataTypes || []).map(t => html`<span class="tag">${t}</span>`)}</div>
                            </div>`)}
                        ${!this.devices.length ? html`<div class="muted">No devices found.</div>` : ''}
                    </div>
                    <div class="complete-box">
                        <label class="muted" for="devcmp">completion:</label>
                        <input id="devcmp" .value=${this.devicePrefix} @input=${this._onDeviceInput} placeholder="type a device id…">
                        <span class="muted">${this.completions.length ? this.completions.length + ' match(es)' : ''}</span>
                    </div>
                    ${this.completions.length ? html`<div class="completions">${this.completions.map(v => html`<span class="tag">${v}</span>`)}</div>` : ''}
                </div>

                <!-- actions -->
                <div class="card" id="actions-card">
                    <span class="feat lock">MRTR · progress · admin</span>
                    <h3>Actions</h3>
                    <p class="sub">Each button is a real MCP tool call. The 3-month history needs your confirmation (MRTR).</p>
                    <div class="row">
                        <button class="btn primary" @click=${this._runHistory3m} ?disabled=${this.busy.history3m}>3-month history</button>
                        <button class="btn" @click=${this._runCompare} ?disabled=${this.busy.compare}>Compare last 2 weeks</button>
                        <button class="btn" @click=${this._runAnomaly} ?disabled=${this.busy.anomaly}>Scan for anomalies</button>
                        <button class="btn" @click=${this._runDiagnostics} ?disabled=${this.busy.diag}>Diagnostics</button>
                        <button class="btn" @click=${this._runRefresh} ?disabled=${this.busy.refresh}>Refresh station</button>
                    </div>
                    ${this.progress ? html`
                        <div class="progress">
                            ${this.progress.pct != null ? html`<div class="pbar"><div style="width:${this.progress.pct}%"></div></div>` : ''}
                            <div class="ptext">${this.progress.pct != null ? Math.round(this.progress.pct) + '% ' : ''}${this.progress.message || 'Working…'}</div>
                        </div>` : ''}
                </div>

                <!-- compare result -->
                ${this.compare ? html`
                <div class="card" id="compare-card">
                    <span class="feat lock">compare_periods · structured</span>
                    <h3>Last 2 weeks comparison</h3>
                    <p class="sub">Structured result (structuredContent) rendered as a table.</p>
                    <div class="cmp-cols">
                        ${this._cmpPeriod(this.compare.period1)}
                        ${this._cmpPeriod(this.compare.period2)}
                    </div>
                    ${this.compare.deltas ? html`
                    <div class="delta">
                        <b>Deltas (P2 − P1):</b>
                        avg min <b>${this._signed(this.compare.deltas.avgMin)}°</b>, avg max <b>${this._signed(this.compare.deltas.avgMax)}°</b>
                        ${this.compare.summary ? html`<div class="muted" style="margin-top:.35rem;">${this.compare.summary}</div>` : ''}
                    </div>` : ''}
                    ${this._okNotes.compare ? html`<div class="oknote" style="margin-top:.6rem;">${this._okNotes.compare}</div>` : ''}
                </div>` : ''}

                <!-- history 3m result -->
                ${this.history3m ? html`
                <div class="card">
                    <span class="feat">MRTR confirmed</span>
                    <h3>3-month history</h3>
                    <p class="sub">${this.history3m.begin} → ${this.history3m.end} · ${this.history3m.dataPoints} data points (daily aggregates).</p>
                    <table class="data">
                        <tr><th>Date</th><th style="text-align:right">Min</th><th style="text-align:right">Max</th></tr>
                        ${(this.history3m.values || []).slice(0, 12).map(v => html`<tr><td>${(v.timestamp || '').slice(0, 10)}</td><td class="num">${v.outdoorMinTemperature != null ? v.outdoorMinTemperature + '°' : '–'}</td><td class="num">${v.outdoorMaxTemperature != null ? v.outdoorMaxTemperature + '°' : '–'}</td></tr>`)}
                    </table>
                    ${this.history3m.values.length > 12 ? html`<div class="muted" style="margin-top:.4rem;">…and ${(this.history3m.values.length) - 12} more days.</div>` : ''}
                </div>` : ''}

                <!-- anomalies + diagnostics -->
                ${(this.anomalies || this.diagnostics) ? html`
                <div class="grid">
                    <div class="card">
                        <span class="feat lock">run_anomaly_scan · structured</span>
                        <h3>Anomaly scan (14 days)</h3>
                        ${this.anomalies && this.anomalies.findings ? html`
                            <div class="muted">${this.anomalies.dataPoints} data points scanned</div>
                            ${(this.anomalies.findings || []).map(f => html`
                                <div class="finding"><span class="sev">${f.severity}</span> · ${f.type}<div>${f.detail}</div></div>`)}
                            ${(this.anomalies.findings || []).length === 0 ? html`<div class="oknote">No anomalies found.</div>` : ''}
                            ${(this.anomalies.recommendations || []).map(r => html`<div class="muted" style="margin-top:.4rem;">• ${r}</div>`)}
                        ` : (this.anomalies ? html`<pre class="diag">${this.anomalies}</pre>` : '')}
                    </div>
                    <div class="card">
                        <span class="feat lock">get_station_diagnostics</span>
                        <h3>Station diagnostics</h3>
                        ${this.diagnostics ? html`<pre class="diag">${this.diagnostics}</pre>` : html`<div class="muted">Press "Diagnostics" above.</div>`}
                    </div>
                </div>` : ''}

                <!-- admin sign-in -->
                <div class="card" id="admin-card">
                    <span class="feat lock">OIDC admin</span>
                    <h3>Admin access</h3>
                    <p class="sub">The admin tools live on a separate, protected MCP server (/admin/mcp) that requires a bearer token.</p>
                    <div class="row" style="margin-top:0;">
                        ${this.adminReady
                            ? html`<span class="chip fresh"><span class="pdot"></span> signed in as <b>${this.adminUser}</b> (OIDC password grant)</span>`
                            : html`<button class="btn primary" @click=${this._signInAdmin} ?disabled=${this.adminBusy}>${this.adminBusy ? 'Signing in…' : 'Sign in to unlock admin'}</button>`}
                    </div>
                </div>

                <!-- live feed + activity -->
                <div class="grid">
                    <div class="card" id="feed-card">
                        <span class="feat live">subscriptions/listen</span>
                        <h3>Live feed</h3>
                        <p class="sub">Server-pushed notifications on an open SSE subscription.</p>
                        <div class="feed">
                            ${(this.feed || []).map(f => html`
                                <div class="fline ${f.isUpdated ? 'updated' : ''}">
                                    <span class="fm">${f.method}</span>
                                    <span class="muted">${f.subId}</span>
                                    <span class="fts">${f.ts}</span>
                                </div>`)}
                            ${!this.feed.length ? html`<div class="muted">Waiting for notifications… press "Refresh station" to see one.</div>` : ''}
                        </div>
                    </div>
                    <div class="card" id="activity-card">
                        <span class="feat">AI chat activity</span>
                        <h3>AI chat activity</h3>
                        <p class="sub">Tool calls the AI makes in the Chat tab appear here (bridged from the server).</p>
                        <div class="act-list">
                            ${(this.activity || []).map(a => html`
                                <div class="act">
                                    <span class="at">${(a.ts ? new Date(a.ts).toISOString().slice(11, 19) : '')}</span>
                                    ${a.admin ? html`<span class="badge-admin">ADMIN</span>` : ''}
                                    <span class="am">${a.tool || a.type || a.message}</span>
                                    <span class="ar">${a.message || (a.result ? String(a.result).slice(0, 80) : '')}</span>
                                </div>`)}
                            ${!this.activity.length ? html`<div class="muted">No chat activity yet. Go to the AI Chat tab and ask something.</div>` : ''}
                        </div>
                    </div>
                </div>

                <!-- trace -->
                <div class="card" id="trace-card">
                    <span class="feat">the wire</span>
                    <h3>How it worked (live MCP trace)</h3>
                    <p class="sub">Every JSON-RPC call this page made to the MCP server, in order. Purple = admin (bearer token).</p>
                    <div class="trace">
                        ${(this.trace || []).map(t => html`
                            <div class="tline ${t.admin ? 'admin' : ''} ${t.ok && t.ok.startsWith('err') ? 'err' : ''}">
                                <span class="tm">${t.method}</span>
                                <span class="tt">${t.target || '–'}</span>
                                <span class="tdur">${t.dur != null ? t.dur + 'ms' : '…'}</span>
                                <span class="ttag">${t.ok == null ? '…' : rtLabel(t.ok)}</span>
                            </div>`)}
                        ${!this.trace.length ? html`<div class="muted">No calls yet.</div>` : ''}
                    </div>
                </div>

            </div>

            <!-- MRTR modal -->
            ${this._mrtrHtml ? html`
            <div class="modal-backdrop">
                <div class="modal">
                    <h4>The station is asking you</h4>
                    <div class="msub">${this._mrtrHtml.msg}</div>
                    ${unsafeHTML(this._mrtrHtml.fields)}
                    <div class="mnote">${unsafeHTML(this._mrtrHtml.note)}</div>
                    <div class="mactions">
                        <button class="btn ghost" @click=${() => this._resolveMrtr('decline')}>Decline</button>
                        <button class="btn primary" @click=${() => this._resolveMrtr('accept')}>Confirm &amp; fetch</button>
                    </div>
                </div>
            </div>` : ''}
        `;
    }

    _signed(v) { return v == null ? '–' : (v > 0 ? '+' : '') + v + '°'; }
}

customElements.define('home-dashboard', HomeDashboard);
