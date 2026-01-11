
// js/multiplayer/multiplayer_ui.js
(function() {
    const MultiplayerUI = {
        overlayId: 'multiplayer-menu',
        
        init() {
            console.log('MultiplayerUI: Initializing Interface...');
            this.createOverlay();
            
            // Ensure HUD is hidden at start
            this.setHUDVisible(false);
            
            // Ensure Menu Camera is active
            if (window.TacticalShooter.GameManager) {
                // We use standard menu mode for the connection screen
                window.TacticalShooter.GameManager.setMenuMode(true);
            }
        },

        createOverlay() {
            const existing = document.getElementById(this.overlayId);
            if (existing) existing.remove();

            // Retrieve saved name
            const savedName = localStorage.getItem('ts_username') || '';
            const safeName = savedName.replace(/"/g, '&quot;');

            const overlay = document.createElement('div');
            overlay.id = this.overlayId;
            overlay.className = 'overlay active';
            overlay.style.zIndex = '3000';
            overlay.style.background = 'transparent'; 
            overlay.innerHTML = `
                <!-- Settings Button (Top Left) -->
                <button id="main-menu-settings-btn" class="menu-btn" style="position: absolute; top: 20px; left: 20px; width: 50px; height: 50px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 2px solid #333; background: #0a0a0a; z-index: 3001;">
                    ⚙
                </button>
            
                <div class="overlay-panel" style="min-width: 450px; background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(10px);">
                    <div class="overlay-content" style="padding: 30px;">
                        <div style="margin-bottom: 25px;">
                            <input type="text" id="player-name-input" 
                                   placeholder="ENTER USERNAME" 
                                   value="${safeName}"
                                   maxlength="16"
                                   autocomplete="off"
                                   style="width: 100%; padding: 8px 12px; background: #111; border: 2px solid #333; color: #fff; font-family: 'Courier New', monospace; font-size: 16px; text-align: center; letter-spacing: 2px; cursor: text;">
                        </div>
                        <button class="menu-btn" id="btn-host" style="margin-bottom: 25px;">
                            HOST GAME
                        </button>
                        <div style="margin-bottom: 10px;">
                            <input type="text" id="room-code-input" 
                                   placeholder="JOIN CODE" 
                                   maxlength="4"
                                   autocomplete="off"
                                   style="width: 100%; padding: 8px 12px; background: #111; border: 2px solid #333; color: #fff; font-family: 'Courier New', monospace; font-size: 16px; text-align: center; text-transform: uppercase; letter-spacing: 4px; cursor: text;">
                        </div>
                        <button class="menu-btn" id="btn-join">
                            JOIN GAME
                        </button>
                    </div>
                    <div style="padding: 15px 40px; color: #666; font-size: 11px; text-align: center; border-top: 1px solid #333;">
                        <div style="color: #888;">Powered by Playroom.kit</div>
                        <div style="margin-top: 2px; color: #444; font-size: 10px;">Up to 16 players</div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            // Event Listeners
            document.getElementById('btn-host').onclick = () => this.handleHost();
            document.getElementById('btn-join').onclick = () => this.handleJoin();
            document.getElementById('main-menu-settings-btn').onclick = () => {
                if (window.TacticalShooter.UIManager) {
                    window.TacticalShooter.UIManager.openSettings();
                }
            };
            
            document.getElementById('player-name-input').onkeypress = (e) => {
                if (e.key === 'Enter') this.handleHost();
            };
            
            const codeInput = document.getElementById('room-code-input');
            codeInput.onkeypress = (e) => {
                if (e.key === 'Enter') this.handleJoin();
            };
            codeInput.oninput = (e) => {
                e.target.value = e.target.value.toUpperCase();
            };
            
            // Auto-focus logic: Focus name if empty, otherwise focus nothing (let user choose)
            setTimeout(() => {
                const nameEl = document.getElementById('player-name-input');
                if (nameEl && nameEl.value.length === 0) {
                    nameEl.focus();
                }
            }, 200);
        },

        async handleHost() {
            const name = this.getNameInput();
            if (!name) return;
            
            // Save Name
            localStorage.setItem('ts_username', name);
            
            this.setLoading(true);
            try {
                await window.TacticalShooter.PlayroomManager.createRoom(name);
            } catch (e) {
                this.showError(e.message);
                this.setLoading(false);
            }
        },

        async handleJoin() {
            const name = this.getNameInput();
            if (!name) return;
            
            // Save Name
            localStorage.setItem('ts_username', name);
            
            const code = document.getElementById('room-code-input').value.trim();
            if (!code || code.length !== 4) {
                this.showNotification('ENTER 4-LETTER ROOM CODE', 'red');
                return;
            }
            
            this.setLoading(true);
            try {
                await window.TacticalShooter.PlayroomManager.joinRoom(name, code);
            } catch (e) {
                let msg = e.message;
                if (msg === 'ROOM_LIMIT_EXCEEDED') msg = 'ROOM IS FULL';
                this.showError(msg);
                this.setLoading(false);
            }
        },

        getNameInput() {
            const val = document.getElementById('player-name-input').value.trim();
            if (!val) {
                this.showNotification('PLEASE ENTER USERNAME', 'red');
                return null;
            }
            return val;
        },

        setLoading(loading) {
            const overlay = document.getElementById(this.overlayId);
            if (!overlay) return;
            const btns = overlay.querySelectorAll('button');
            btns.forEach(b => b.disabled = loading);
            if (loading) document.body.style.cursor = 'wait';
            else document.body.style.cursor = 'default';
        },

        // Called by PlayroomManager when connection is successful
        onGameStarted(roomCode, isHost) {
            // Ensure internal menu state is closed
            if (window.TacticalShooter.UIManager) {
                window.TacticalShooter.UIManager.closeMenu();
            }

            // Hide the Host/Join Menu
            const menu = document.getElementById(this.overlayId);
            if (menu) menu.style.display = 'none';
            
            // NOTE: We do NOT show HUD or start game loop yet.
            // GameManager has transitioned to LOBBY state, which handles the new UI.
            
            // Update Room Code Display (Ready for when HUD is shown later)
            const rcDisplay = document.getElementById('room-code-display');
            if (rcDisplay) {
                const val = document.getElementById('room-code-value');
                if (val) val.textContent = roomCode;
            }
            
            // Notification
            if (!isHost) this.showNotification(`✓ JOINED ${roomCode}`, 'blue');
        },

        setHUDVisible(visible) {
            const display = visible ? 'block' : 'none';
            ['hud', 'instructions', 'crosshair'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = display;
            });
            // Also enable the room code display if HUD is active
            const rc = document.getElementById('room-code-display');
            if (rc) rc.style.display = visible ? 'flex' : 'none';

            if (!visible) {
                const pl = document.getElementById('pointer-lock-overlay');
                if (pl) pl.classList.add('hidden');
            }
        },

        showNotification(msg, type = 'blue') {
            if (window.TacticalShooter.UIManager) {
                window.TacticalShooter.UIManager.showNotification(msg, type);
            } else {
                alert(msg);
            }
        },
        
        showError(msg) {
            this.showNotification(msg, 'red');
        },

        requestPointerLock() {
            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                canvas.requestPointerLock();
                // Backup Click
                const clicker = () => {
                    if (!document.pointerLockElement && document.getElementById(this.overlayId).style.display === 'none') {
                        canvas.requestPointerLock();
                    }
                };
                document.addEventListener('click', clicker, { once: true });
            }
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.MultiplayerUI = MultiplayerUI;
})();
