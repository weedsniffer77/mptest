
// js/core/ui_manager.js
(function() {
    const UIManager = {
        isMenuOpen: false,
        menuElement: null,
        settingsElement: null,
        confirmElement: null,
        cursorElement: null,
        tooltipElement: null,
        scoreboardElement: null,
        
        // Rebinding State
        listeningForKey: false,
        bindingAction: null,
        
        // Settings State
        tempSettings: {
            sensitivity: 0.002,
            casingsEnabled: true,
            muzzleFlashEnabled: true, 
            bodyEnabled: false, 
            showControls: true,  
            showFPS: true,       
            showNametags: true,  
            maxFPS: 250
        },
        
        init() {
            console.log('UIManager: Initializing...');
            
            // Inject UI HTML
            if (window.TacticalShooter.UIElements) {
                const uiContainer = document.createElement('div');
                uiContainer.id = 'ui-container';
                uiContainer.innerHTML = window.TacticalShooter.UIElements.getHTML();
                document.body.appendChild(uiContainer);
            }
            
            this.menuElement = document.getElementById('esc-menu');
            this.settingsElement = document.getElementById('settings-menu');
            this.confirmElement = document.getElementById('confirm-modal');
            this.cursorElement = document.getElementById('custom-cursor');
            this.tooltipElement = document.getElementById('ui-tooltip');
            this.scoreboardElement = document.getElementById('scoreboard');
            
            this.isMenuOpen = false;
            
            this.initCursor();
            this.updateInstructionsDisplay(); 
            this.applySettingsToDOM(); 
        },
        
        initCursor() {
            document.addEventListener('mousemove', (e) => {
                if (this.cursorElement && !document.pointerLockElement) {
                    this.cursorElement.style.left = `${e.clientX}px`;
                    this.cursorElement.style.top = `${e.clientY}px`;
                }
                
                if (this.tooltipElement && this.tooltipElement.style.display === 'block') {
                    this.tooltipElement.style.left = `${e.clientX}px`;
                    this.tooltipElement.style.top = `${e.clientY}px`;
                }
            });
            
            document.addEventListener('mouseover', (e) => {
                if (e.target.closest('button, input, .toggle-switch, .slider, .keybind-btn')) {
                    this.cursorElement.classList.add('hover');
                }
                
                const tooltipTarget = e.target.closest('[data-tooltip]');
                if (tooltipTarget && this.tooltipElement) {
                    const text = tooltipTarget.getAttribute('data-tooltip');
                    if (text) {
                        this.tooltipElement.textContent = text;
                        this.tooltipElement.style.display = 'block';
                    }
                }
            });
            
            document.addEventListener('mouseout', (e) => {
                if (e.target.closest('button, input, .toggle-switch, .slider, .keybind-btn')) {
                    this.cursorElement.classList.remove('hover');
                }
                
                const tooltipTarget = e.target.closest('[data-tooltip]');
                if (tooltipTarget && this.tooltipElement) {
                    this.tooltipElement.style.display = 'none';
                }
            });
            
            document.addEventListener('pointerlockchange', () => {
                if (document.pointerLockElement) {
                    this.cursorElement.style.display = 'none';
                    if (this.tooltipElement) this.tooltipElement.style.display = 'none';
                } else {
                    this.cursorElement.style.display = 'block';
                }
            });
            
            if (!document.pointerLockElement) {
                this.cursorElement.style.display = 'block';
            }
        },
        
        toggleMenu() {
            if (this.isMenuOpen) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
        },
        
        toggleScoreboard(show) {
            if (!this.scoreboardElement) return;
            
            if (show) {
                this.updateScoreboard();
                this.scoreboardElement.classList.add('active');
            } else {
                this.scoreboardElement.classList.remove('active');
            }
        },
        
        updateScoreboard() {
            const list = document.getElementById('scoreboard-list');
            const modeEl = document.getElementById('sb-mode');
            const mapEl = document.getElementById('sb-map');
            
            if (window.TacticalShooter.MatchState) {
                const state = window.TacticalShooter.MatchState.state;
                if (modeEl) modeEl.textContent = (state.gamemode === 'TDM') ? 'TEAM DEATHMATCH' : 'FREE FOR ALL';
                if (mapEl) mapEl.textContent = 'on ' + (state.mapId === 'TESTING' ? 'TESTING' : state.mapId);
            }

            if (!list) return;
            list.innerHTML = '';
            
            // Collect Players
            const players = [];
            
            // Local
            if (window.TacticalShooter.PlayroomManager && window.TacticalShooter.PlayroomManager.myPlayer) {
                const tm = window.TacticalShooter.TeamManager;
                const myTeamId = tm ? tm.getLocalTeamId() : 0;
                
                players.push({
                    name: window.TacticalShooter.PlayroomManager.localPlayerName,
                    teamId: myTeamId,
                    isLocal: true
                });
            }
            
            // Remote
            if (window.TacticalShooter.RemotePlayerManager) {
                const remotes = window.TacticalShooter.RemotePlayerManager.remotePlayers;
                for (const pid in remotes) {
                    const rp = remotes[pid];
                    let tid = 0;
                    if (rp.player.getState) {
                        tid = rp.player.getState('teamId') || 0;
                    }
                    players.push({
                        name: rp.name,
                        teamId: tid,
                        isLocal: false
                    });
                }
            }
            
            // Group by Team (Default Order 0->3)
            const teams = [[], [], [], []];
            players.forEach(p => {
                if (teams[p.teamId]) teams[p.teamId].push(p);
            });
            
            // Render Teams with Spacers
            teams.forEach((teamPlayers, index) => {
                if (teamPlayers.length === 0) return;
                
                // Add Divider if not first group rendered
                if (list.children.length > 0) {
                    const div = document.createElement('div');
                    div.className = 'sb-divider';
                    list.appendChild(div);
                }
                
                teamPlayers.forEach(p => {
                    const row = document.createElement('div');
                    const teamClass = `team-${p.teamId}`;
                    const localClass = p.isLocal ? 'local' : '';
                    
                    row.className = `sb-row ${teamClass} ${localClass}`;
                    row.innerHTML = `
                        <div class="sb-col-name">${p.name}</div>
                    `;
                    list.appendChild(row);
                });
            });
        },
        
        openMenu() {
            if (!this.menuElement) return;
            
            this.isMenuOpen = true;
            this.menuElement.classList.add('active');
            this.cursorElement.style.display = 'block';
            
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
            
            console.log('UIManager: Menu Opened');
        },
        
        closeMenu() {
            if (!this.menuElement) return;
            
            this.isMenuOpen = false;
            this.listeningForKey = false; 
            
            this.menuElement.classList.remove('active');
            this.settingsElement.classList.remove('active');
            this.confirmElement.classList.remove('active');
            
            if (this.tooltipElement) this.tooltipElement.style.display = 'none';
            
            const canvas = document.getElementById('game-canvas');
            if (canvas) {
                // Only request lock if we are NOT in menu mode (i.e. we are ingame)
                const isMenuMode = window.TacticalShooter.GameManager && window.TacticalShooter.GameManager.isMenuMode;
                // Exception: Lobby (Pre-game) is menu mode but doesn't lock pointer.
                if (!isMenuMode) {
                    canvas.requestPointerLock();
                }
            }
            
            console.log('UIManager: Menu Closed');
        },
        
        confirmLeave() {
            if (this.confirmElement) {
                this.menuElement.classList.remove('active');
                this.confirmElement.classList.add('active');
            }
        },
        
        closeConfirm() {
            if (this.confirmElement) {
                this.confirmElement.classList.remove('active');
                this.menuElement.classList.add('active');
            }
        },
        
        finalizeLeave() {
            console.log('UIManager: Leaving game...');
            if (window.TacticalShooter.PlayroomManager) {
                window.TacticalShooter.PlayroomManager.disconnect();
            }
            // Hard redirect to clear query params and reset state completely
            window.location.href = window.location.origin + window.location.pathname;
        },
        
        showNotification(message, type = 'blue') {
            const container = document.getElementById('notification-area');
            if (!container) return;
            
            const toast = document.createElement('div');
            toast.className = `notification-toast ${type}`;
            toast.innerHTML = `
                <span style="letter-spacing: 1px;">${message}</span>
                <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#666; cursor:none; font-weight:bold; font-size:14px;">×</button>
            `;
            
            container.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.transition = 'opacity 0.5s';
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 500);
                }
            }, 4000);
        },
        
        // --- Settings Menu Logic ---
        
        openSettings() {
            if (!this.settingsElement) return;
            
            this.menuElement.classList.remove('active');
            this.settingsElement.classList.add('active');
            this.cursorElement.style.display = 'block';
            
            // 1. Sync Values
            if (window.TacticalShooter.PlayerCamera) {
                this.tempSettings.sensitivity = window.TacticalShooter.PlayerCamera.config.mouseSensitivity;
                const slider = document.getElementById('sensitivity-slider');
                if (slider) slider.value = this.tempSettings.sensitivity;
                this.updateSensitivityUI(this.tempSettings.sensitivity);
            }
            
            // Sync Checkboxes
            const map = {
                'casings-toggle': this.tempSettings.casingsEnabled,
                'muzzleflash-toggle': this.tempSettings.muzzleFlashEnabled,
                'body-toggle': this.tempSettings.bodyEnabled,
                'controls-toggle': this.tempSettings.showControls,
                'fps-toggle': this.tempSettings.showFPS,
                'nametags-toggle': this.tempSettings.showNametags
            };

            for (const [id, val] of Object.entries(map)) {
                const el = document.getElementById(id);
                if (el) el.checked = val;
            }

            if (window.TacticalShooter.GameManager) {
                this.tempSettings.maxFPS = window.TacticalShooter.GameManager.config.maxFPS;
                const slider = document.getElementById('max-fps-slider');
                if (slider) slider.value = this.tempSettings.maxFPS;
                this.updateMaxFPSUI(this.tempSettings.maxFPS);
            }
            
            this.renderKeybinds();
            this.generateConfigString();
            this.switchTab('controls');
        },
        
        closeSettings() {
            if (!this.settingsElement) return;
            // Fully close menus (return to game or lobby)
            this.closeMenu();
        },

        resetAllSettings() {
            window.TacticalShooter.InputManager.resetBindings();
            
            this.tempSettings = {
                sensitivity: 0.002,
                casingsEnabled: true,
                muzzleFlashEnabled: true,
                bodyEnabled: false,
                showControls: true,
                showFPS: true,
                showNametags: true,
                maxFPS: 250
            };

            const sensSlider = document.getElementById('sensitivity-slider');
            if (sensSlider) sensSlider.value = 0.002;
            this.updateSensitivityUI(0.002);
            
            const fpsSlider = document.getElementById('max-fps-slider');
            if (fpsSlider) fpsSlider.value = 250;
            this.updateMaxFPSUI(250);
            
            const ids = ['casings-toggle', 'muzzleflash-toggle', 'controls-toggle', 'fps-toggle', 'nametags-toggle'];
            ids.forEach(id => { const el = document.getElementById(id); if(el) el.checked = true; });
            const bodyCheck = document.getElementById('body-toggle'); if(bodyCheck) bodyCheck.checked = false;

            this.renderKeybinds();
            this.generateConfigString();
            this.showNotification("SETTINGS RESET", "blue");
        },
        
        switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const activeBtn = document.getElementById(`tab-btn-${tabName}`);
            if (activeBtn) activeBtn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            const activeContent = document.getElementById(`tab-${tabName}`);
            if (activeContent) activeContent.classList.add('active');
        },
        
        // --- Keybind Logic ---
        
        renderKeybinds() {
            const container = document.getElementById('keybinds-list');
            if (!container) return;
            container.innerHTML = '';
            
            const bindings = window.TacticalShooter.InputManager.bindings;
            // Filter out 'Menu' key from being rebound to prevent locking out
            const blacklist = ['Menu']; 

            for (const [action, key] of Object.entries(bindings)) {
                if (blacklist.includes(action)) continue;

                const row = document.createElement('div');
                row.className = 'keybind-row';
                
                const label = document.createElement('span');
                label.className = 'keybind-label';
                // Convert camelCase to Space Case
                label.textContent = action.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
                
                const controlsDiv = document.createElement('div');
                controlsDiv.style.display = 'flex';
                controlsDiv.style.alignItems = 'center';

                const btn = document.createElement('button');
                btn.className = 'keybind-btn';
                
                if (key) {
                    btn.textContent = this.formatKeyName(key);
                } else {
                    btn.textContent = 'UNBOUND!';
                    btn.classList.add('unbound');
                }
                
                btn.onclick = () => this.startRebind(action, btn);
                
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-bind-btn';
                delBtn.textContent = '-';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.unbindAction(action);
                };

                controlsDiv.appendChild(btn);
                controlsDiv.appendChild(delBtn);

                row.appendChild(label);
                row.appendChild(controlsDiv);
                container.appendChild(row);
            }
        },
        
        formatKeyName(code) {
            if (!code) return 'NONE';
            if (code.startsWith('Key')) return code.replace('Key', '');
            if (code.startsWith('Digit')) return code.replace('Digit', '');
            if (code.startsWith('Mouse')) return code.replace('Mouse', 'M');
            if (code === 'Space') return 'SPC';
            if (code === 'ControlLeft') return 'CTRL';
            if (code === 'ShiftLeft') return 'SHFT';
            if (code === 'AltLeft') return 'ALT';
            if (code === 'Escape') return 'ESC';
            if (code === 'Tab') return 'TAB';
            return code.toUpperCase();
        },
        
        startRebind(action, btnElement) {
            if (this.listeningForKey) return;
            
            this.listeningForKey = true;
            this.bindingAction = action;
            btnElement.textContent = '...';
            btnElement.classList.remove('unbound');
            btnElement.classList.add('listening');
        },
        
        handleRebind(keyCode) {
            if (!this.listeningForKey) return;
            
            if (keyCode === 'Escape') {
                this.listeningForKey = false;
                this.renderKeybinds();
                return;
            }
            
            window.TacticalShooter.InputManager.setBinding(this.bindingAction, keyCode);
            this.listeningForKey = false;
            this.renderKeybinds();
            this.updateInstructionsDisplay(); 
            this.generateConfigString(); 
        },

        unbindAction(action) {
            window.TacticalShooter.InputManager.setBinding(action, null);
            this.renderKeybinds();
            this.updateInstructionsDisplay();
            this.generateConfigString();
        },
        
        generateConfigString() {
            const input = document.getElementById('config-string');
            if (!input) return;
            
            const s = this.tempSettings;
            const b = window.TacticalShooter.InputManager.bindings;
            
            const gfx = `${s.casingsEnabled ? 1 : 0},${s.muzzleFlashEnabled ? 1 : 0},${s.maxFPS},${s.bodyEnabled ? 1 : 0}`;
            
            // Serialize bindings
            const keys = Object.values(b).map(k => k || '').join(',');
            
            const str = `[CFG]S:${s.sensitivity}|G:${gfx}|K:${keys}`;
            input.value = str;
        },
        
        importSettingsString(str) {
            if (!str.startsWith('[CFG]')) return;
            
            try {
                const parts = str.replace('[CFG]', '').split('|');
                
                const sensPart = parts.find(p => p.startsWith('S:'));
                if (sensPart) this.updateSensitivity(parseFloat(sensPart.split(':')[1]));
                
                const gfxPart = parts.find(p => p.startsWith('G:'));
                if (gfxPart) {
                    const vals = gfxPart.split(':')[1].split(',');
                    this.tempSettings.casingsEnabled = (vals[0] === '1');
                    this.tempSettings.muzzleFlashEnabled = (vals[1] === '1');
                    this.updateMaxFPS(parseInt(vals[2]));
                    if (vals.length > 3) this.tempSettings.bodyEnabled = (vals[3] === '1');
                    
                    const elC = document.getElementById('casings-toggle'); if(elC) elC.checked = this.tempSettings.casingsEnabled;
                    const elM = document.getElementById('muzzleflash-toggle'); if(elM) elM.checked = this.tempSettings.muzzleFlashEnabled;
                    const elF = document.getElementById('max-fps-slider'); if(elF) elF.value = this.tempSettings.maxFPS;
                    const elB = document.getElementById('body-toggle'); if(elB) elB.checked = this.tempSettings.bodyEnabled;
                }
                
                const keysPart = parts.find(p => p.startsWith('K:'));
                if (keysPart) {
                    const keys = keysPart.split(':')[1].split(',');
                    const actions = Object.keys(window.TacticalShooter.InputManager.bindings);
                    
                    actions.forEach((act, i) => {
                        if (i < keys.length) {
                            const val = keys[i];
                            window.TacticalShooter.InputManager.setBinding(act, val === '' ? null : val);
                        }
                    });
                    this.renderKeybinds();
                    this.updateInstructionsDisplay();
                }
                
                this.showNotification('SETTINGS IMPORTED', 'blue');
            } catch (e) {
                this.showNotification('INVALID CONFIG STRING', 'red');
                console.error(e);
            }
        },
        
        copyConfigString() {
            const input = document.getElementById('config-string');
            if (input) {
                input.select();
                document.execCommand('copy');
                this.showNotification('COPIED TO CLIPBOARD', 'blue');
            }
        },

        updateSensitivity(val) {
            this.tempSettings.sensitivity = parseFloat(val);
            this.updateSensitivityUI(this.tempSettings.sensitivity);
            this.generateConfigString();
        },
        
        updateSensitivityUI(val) {
            const display = document.getElementById('sens-value');
            if (display) display.textContent = parseFloat(val).toFixed(4);
        },

        updateMaxFPS(val) {
            this.tempSettings.maxFPS = parseInt(val);
            this.updateMaxFPSUI(this.tempSettings.maxFPS);
            this.generateConfigString();
        },

        updateMaxFPSUI(val) {
            const display = document.getElementById('max-fps-value');
            if (display) {
                display.textContent = val > 240 ? "UNLIMITED" : val;
            }
        },

        toggleSetting(key, value) {
            this.tempSettings[key] = value;
        },
        
        saveSettings() {
            this.applySettingsToDOM(); 
            
            if (window.TacticalShooter.PlayerCamera) {
                window.TacticalShooter.PlayerCamera.setSensitivity(this.tempSettings.sensitivity);
            }
            if (window.TacticalShooter.ParticleManager) {
                window.TacticalShooter.ParticleManager.casingsEnabled = this.tempSettings.casingsEnabled;
                window.TacticalShooter.ParticleManager.setLightingEnabled(this.tempSettings.muzzleFlashEnabled);
            }
            if (window.TacticalShooter.GunRenderer) {
                window.TacticalShooter.GunRenderer.muzzleFlashEnabled = this.tempSettings.muzzleFlashEnabled;
                window.TacticalShooter.GunRenderer.setUseFullBody(this.tempSettings.bodyEnabled);
            }
            if (window.TacticalShooter.GameManager) {
                window.TacticalShooter.GameManager.config.maxFPS = this.tempSettings.maxFPS;
            }
            
            console.log('UIManager: Settings saved');
            this.closeSettings();
        },
        
        applySettingsToDOM() {
            const instructions = document.getElementById('instructions');
            if (instructions) instructions.style.display = this.tempSettings.showControls ? 'block' : 'none';
            
            const fpsDisplay = document.getElementById('fps-display');
            if (fpsDisplay) fpsDisplay.style.display = this.tempSettings.showFPS ? 'block' : 'none';

            if (window.TacticalShooter.config) {
                window.TacticalShooter.config.showNametags = this.tempSettings.showNametags;
            }
            
            // Force update immediately for menu state
            this.updateInstructionsDisplay();
        },
        
        updateInstructionsDisplay() {
            const el = document.getElementById('instructions');
            if (!el) return;
            
            // Hide if in Menu Mode
            if (window.TacticalShooter.GameManager && window.TacticalShooter.GameManager.isMenuMode) {
                el.style.display = 'none';
                return;
            }
            
            // Check Setting
            if (!this.tempSettings.showControls) {
                el.style.display = 'none';
                return;
            } else {
                el.style.display = 'block';
            }

            const b = window.TacticalShooter.InputManager.bindings;
            const fmt = this.formatKeyName;
            const k = (code) => code ? fmt(code) : '?';

            el.innerHTML = `
                ${k(b.Forward)}${k(b.Left)}${k(b.Backward)}${k(b.Right)} - MOVE | ${k(b.Jump)} - JUMP | ${k(b.Crouch)} - CROUCH | ${k(b.Prone)} - PRONE<br>
                ${k(b.Sprint)} - SPRINT | ${k(b.ADS)} - ADS<br>
                ${k(b.LeanLeft)} / ${k(b.LeanRight)} - LEAN | ${k(b.FreeCursor)} - FREE CURSOR<br>
                ${k(b.Reload)} - RELOAD | ${k(b.Shoot)} - SHOOT | ${k(b.Inspect)} - INSPECT<br>
                ESC - MENU | TAB - SCOREBOARD
            `;
        },
        
        isUIActive() {
            return this.isMenuOpen; 
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.UIManager = UIManager;
})();
