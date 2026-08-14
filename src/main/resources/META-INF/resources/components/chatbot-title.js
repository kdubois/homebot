import {LitElement, html, css} from 'lit';
import '@vaadin/icon';
import '@vaadin/button';
import '@vaadin/text-field';
import '@vaadin/text-area';
import '@vaadin/form-layout';
import '@vaadin/progress-bar';
import '@vaadin/checkbox';
import '@vaadin/grid';
import '@vaadin/grid/vaadin-grid-sort-column.js';

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
    `

    _sendSuggestion(message) {
        window.dispatchEvent(new CustomEvent('chatbot-send', { detail: message }));
    }

    render() {
        return html`
            <div class="title">
                <h2>HomeBot</h2>
            </div>
            <div class="explanation">
                <p>Your AI-powered home weather assistant. Ask me anything, or try:</p>
                <div class="suggestions">
                    <button class="suggestion-btn" @click=${() => this._sendSuggestion('Give me a weather summary for all my devices')}>
                        Weather Summary
                    </button>
                    <button class="suggestion-btn" @click=${() => this._sendSuggestion('Compare the weather from the last 2 weeks')}>
                        Compare Last 2 Weeks
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
