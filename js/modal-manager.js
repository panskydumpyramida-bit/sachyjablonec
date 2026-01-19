/**
 * Modal Manager - Handles global custom modals (Alert, Prompt, Confirm)
 */
if (typeof ModalManager === 'undefined') {
    window.ModalManager = class ModalManager {
        constructor() {
            this.activeModal = null;
            this.injectStyles();
        }

        injectStyles() {
            if (document.getElementById('modal-manager-styles')) return;
            const style = document.createElement('style');
            style.id = 'modal-manager-styles';
            style.textContent = `
                .global-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(5px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }
                .global-modal-overlay.active {
                    opacity: 1;
                    visibility: visible;
                }
                .global-modal {
                    background: var(--surface-color, #1e1e1e);
                    border: 1px solid rgba(212, 175, 55, 0.2);
                    border-radius: 12px;
                    padding: 2rem;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    transform: translateY(20px);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    text-align: center;
                }
                .global-modal-overlay.active .global-modal {
                    transform: translateY(0);
                }
                .global-modal h3 {
                    color: var(--primary-color, #d4af37);
                    margin-bottom: 1rem;
                    font-size: 1.5rem;
                }
                .global-modal p {
                    color: var(--text-color, #e0e0e0);
                    margin-bottom: 1.5rem;
                    line-height: 1.5;
                }
                .global-modal input {
                    width: 100%;
                    padding: 0.8rem;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: white;
                    margin-bottom: 1.5rem;
                    font-family: inherit;
                }
                .global-modal input:focus {
                    outline: none;
                    border-color: var(--primary-color, #d4af37);
                }
                .global-modal-actions {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                }
                .global-modal-btn {
                    padding: 0.6rem 1.5rem;
                    border-radius: 50px;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .global-modal-btn.primary {
                    background: var(--primary-color, #d4af37);
                    color: var(--secondary-color, #1a1a1a);
                }
                .global-modal-btn.primary:hover {
                    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
                    transform: translateY(-2px);
                }
                .global-modal-btn.secondary {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: var(--text-muted, #a0a0a0);
                }
                .global-modal-btn.secondary:hover {
                    border-color: white;
                    color: white;
                }
            `;
            document.head.appendChild(style);
        }

        createOverlay() {
            const overlay = document.createElement('div');
            overlay.className = 'global-modal-overlay';
            overlay.innerHTML = `<div class="global-modal"></div>`;
            document.body.appendChild(overlay);

            // Force reflow
            overlay.offsetHeight;
            overlay.classList.add('active');

            return overlay;
        }

        close(overlay, callback) {
            if (!overlay) return;
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                if (callback) callback();
            }, 300);
        }

        alert(message, title = 'Upozornění') {
            return new Promise(resolve => {
                const overlay = this.createOverlay();
                const modal = overlay.querySelector('.global-modal');

                modal.innerHTML = `
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="global-modal-actions">
                        <button class="global-modal-btn primary">OK</button>
                    </div>
                `;

                const btn = modal.querySelector('button');
                btn.focus();
                btn.onclick = () => {
                    this.close(overlay, resolve);
                };

                // Close on Enter
                const enterHandler = (e) => {
                    if (e.key === 'Enter') {
                        btn.click();
                        document.removeEventListener('keydown', enterHandler);
                    }
                };
                document.addEventListener('keydown', enterHandler);
            });
        }

        confirm(message, title = 'Potvrzení') {
            return new Promise(resolve => {
                const overlay = this.createOverlay();
                const modal = overlay.querySelector('.global-modal');

                modal.innerHTML = `
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="global-modal-actions">
                        <button class="global-modal-btn secondary" id="btn-cancel">Zrušit</button>
                        <button class="global-modal-btn primary" id="btn-confirm">Potvrdit</button>
                    </div>
                `;

                const btnConfirm = modal.querySelector('#btn-confirm');
                const btnCancel = modal.querySelector('#btn-cancel');

                btnConfirm.focus();

                btnConfirm.onclick = () => {
                    this.close(overlay, () => resolve(true));
                };

                btnCancel.onclick = () => {
                    this.close(overlay, () => resolve(false));
                };
            });
        }

        prompt(message, defaultValue = '', title = 'Zadejte hodnotu') {
            return new Promise(resolve => {
                const overlay = this.createOverlay();
                const modal = overlay.querySelector('.global-modal');

                modal.innerHTML = `
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <input type="text" value="${defaultValue}" placeholder="Zadejte text...">
                    <div class="global-modal-actions">
                        <button class="global-modal-btn secondary" id="btn-cancel">Zrušit</button>
                        <button class="global-modal-btn primary" id="btn-confirm">OK</button>
                    </div>
                `;

                const input = modal.querySelector('input');
                const btnConfirm = modal.querySelector('#btn-confirm');
                const btnCancel = modal.querySelector('#btn-cancel');

                input.focus();
                input.select();

                const submit = () => {
                    const val = input.value.trim();
                    this.close(overlay, () => resolve(val || null));
                };

                btnConfirm.onclick = submit;

                btnCancel.onclick = () => {
                    this.close(overlay, () => resolve(null));
                };

                input.onkeydown = (e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') btnCancel.click();
                };
            });
        }
    }
}

// Global instance
if (typeof modal === 'undefined') {
    window.modal = new ModalManager();
}
