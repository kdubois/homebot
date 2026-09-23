import {LitElement, html, css} from 'lit';

export class ChatBotTitle extends LitElement {

    static styles = css`
      h2 {
        font-family: "Red Hat Mono", monospace;
        font-size: 42px;
        font-style: normal;
        font-variant: normal;
        font-weight: 700;
        line-height: 1.2;
        margin: 0.3em 0 0.2em;
        color: var(--main-highlight-text-color);
      }

      .title {
        text-align: center;
        padding: 0.3em;
        background: var(--main-bg-color);
      }
      
      .explanation {
        margin-left: auto;
        margin-right: auto;
        width: 560px;
        max-width: 90%;
        text-align: center;
        font-size: 16px;
      }
      
      .explanation img {
        max-width: 60%;
        display: block;
        float:left;
        margin-right: 2em;
        margin-top: 1em;
      }

      .suggestions {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1.5rem;
      }

      .suggestion-btn {
        padding: 0.6rem 1.2rem;
        border: 1px solid rgba(237, 98, 128, 0.4);
        border-radius: 20px;
        background: white;
        color: #333;
        font-size: 0.9rem;
        font-family: 'Red Hat Text', sans-serif;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .suggestion-btn:hover {
        background: rgba(237, 98, 128, 0.1);
        border-color: rgba(237, 98, 128, 0.8);
        transform: translateY(-1px);
      }

      .admin-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.5rem;
        margin: 0.75rem 0 0;
        width: 560px;
        max-width: 90%;
        margin-left: auto;
        margin-right: auto;
      }

      .admin-status {
        font-size: 0.8rem;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .admin-status .dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #cbd5e1; display: inline-block;
      }

      .admin-status.on { color: #047857; }
      .admin-status.on .dot { background: #10b981; }

      .admin-btn {
        padding: 0.45rem 1rem;
        border: 1px solid rgba(100, 116, 139, 0.4);
        border-radius: 18px;
        background: white;
        color: #334155;
        font-size: 0.82rem;
        font-family: 'Red Hat Text', sans-serif;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .admin-btn:hover {
        background: rgba(100, 116, 139, 0.1);
        border-color: rgba(100, 116, 139, 0.7);
      }
    `

    static properties = {
        admin: { type: Boolean, state: true }
    }

    constructor() {
        super();
        this.admin = false;
    }

    connectedCallback() {
        super.connectedCallback();
        // The chat component performs the /dashboard/admin-token exchange and the
        // ADMIN-SIGNIN websocket message. It reports the outcome back here so the
        // button reflects the real state (not an optimistic click).
        window.addEventListener('chatbot-admin-signed', () => { this.admin = true; });
        window.addEventListener('chatbot-admin-signout', () => { this.admin = false; });
    }

    _sendSuggestion(message) {
        window.dispatchEvent(new CustomEvent('chatbot-send', { detail: message }));
    }

    _adminSignIn() {
        // Ask the chat to perform the sign-in; it reports back via 'chatbot-admin-signed'.
        window.dispatchEvent(new CustomEvent('chatbot-admin-signin'));
    }

    _adminSignOut() {
        window.dispatchEvent(new CustomEvent('chatbot-admin-signout'));
    }

    _fmtDate(d) {
        return d.toISOString().slice(0, 10);
    }

    // Resolve the two most recent 7-day windows and ask the bot to compare
    // them via the admin `compare_periods` tool (OIDC-secured, like the
    // "Admin: Refresh Station" button).
    _compareLastTwoWeeks() {
        const day = 86400000;
        const today = new Date();
        const period2End = today;
        const period2Start = new Date(today.getTime() - 6 * day);
        const period1End = new Date(today.getTime() - 7 * day);
        const period1Start = new Date(today.getTime() - 13 * day);

        this._sendSuggestion(
            `Compare outdoor temperatures for these two 7-day periods using the compare_periods tool: ` +
            `period 1 from ${this._fmtDate(period1Start)} to ${this._fmtDate(period1End)}, ` +
            `period 2 from ${this._fmtDate(period2Start)} to ${this._fmtDate(period2End)}. ` +
            `Show a day-by-day min/max table for each week and the key differences.`
        );
    }

    render() {
        return html`
            <div class="title">
                <h2>HomeBot</h2>
            </div>
            <div class="admin-row">
                ${this.admin
                    ? html`
                        <span class="admin-status on"><span class="dot"></span> Admin tools unlocked</span>
                        <button class="admin-btn" @click=${() => this._adminSignOut()}>Sign out</button>
                    `
                    : html`
                        <span class="admin-status"><span class="dot"></span> Admin tools locked</span>
                        <button class="admin-btn" @click=${() => this._adminSignIn()}>Sign in as admin</button>
                    `}
            </div>
            <div class="explanation">
                <p>Your AI-powered home weather assistant. Ask me anything, or try:</p>
                <div class="suggestions">
                    <button class="suggestion-btn" @click=${() => this._sendSuggestion('Give me a weather summary for all my devices')}>
                        Weather Summary
                    </button>
                    <button class="suggestion-btn" @click=${() => this._compareLastTwoWeeks()}>
                        Compare Last 2 Weeks
                    </button>
                    <button class="suggestion-btn" @click=${() => this._sendSuggestion('Show me the last 3 months of outdoor temperatures')}>
                        3-Month History
                    </button>
                    <button class="suggestion-btn" @click=${() => this._sendSuggestion('Run diagnostics on my weather station devices')}>
                        Device Diagnostics
                    </button>
                    <button class="suggestion-btn" @click=${() => this._sendSuggestion('Refresh the station data and show me station diagnostics')}>
                        Admin: Refresh Station
                    </button>
                </div>
            </div>
        `
    }

}

customElements.define('chatbot-title', ChatBotTitle);
