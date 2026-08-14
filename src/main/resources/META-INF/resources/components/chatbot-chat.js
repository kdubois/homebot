import {LitElement, html, css} from 'lit';
import {unsafeHTML} from 'lit-html/directives/unsafe-html.js';
import {marked} from 'marked';
import DOMPurify from 'dompurify';

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

        .dots {
            display: flex;
            gap: 5px;
        }

        .dots span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #999;
            animation: pulse 1.4s ease-in-out infinite;
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
            to { opacity: 1; transform: translateY(0); }
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
        marked.setOptions({gfm: true, breaks: true});
    }

    connectedCallback() {
        super.connectedCallback();

        const protocol = (window.location.protocol === 'https:') ? 'wss' : 'ws';
        this._socket = new WebSocket(protocol + '://' + window.location.host + '/chatbot');

        this._socket.onopen = () => {
            this._addMessage('bot', 'How can I help you today?');
        };

        this._socket.onmessage = (event) => {
            if (this._loading) {
                this._loading = false;
                this._addMessage('bot', event.data);
            } else {
                const last = this._messages[this._messages.length - 1];
                if (last && last.role === 'bot') {
                    last.text += event.data;
                    this.requestUpdate();
                    this._scrollToBottom();
                } else {
                    this._addMessage('bot', event.data);
                }
            }
        };

        window.addEventListener('chatbot-send', (e) => {
            this._send(e.detail);
        });
    }

    _addMessage(role, text) {
        this._messages = [...this._messages, {role, text}];
        this.requestUpdate();
        this._scrollToBottom();
    }

    _send(text) {
        if (!text.trim()) return;
        this._addMessage('user', text);
        this._loading = true;
        this.requestUpdate();
        this._socket.send(text);
        this._scrollToBottom();
    }

    _onSubmit(e) {
        e.preventDefault();
        const input = this.shadowRoot.querySelector('input');
        this._send(input.value);
        input.value = '';
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

    render() {
        return html`
            <div class="messages">
                ${this._messages.map(m => html`
                    <div class="message ${m.role}">
                        ${m.role === 'bot' ? this._renderMarkdown(m.text) : m.text}
                    </div>
                `)}
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
