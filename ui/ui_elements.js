
// js/ui/ui_elements.js
(function() {
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.UIElements = {
        getHTML() {
            return `
    <div id="custom-cursor"></div>
    <div id="ui-tooltip"></div>
    
    <div id="crosshair">
        <div class="crosshair-line crosshair-h"></div>
        <div class="crosshair-line crosshair-v"></div>
    </div>
    
    <div id="hud">
        <div id="ammo-display">15/15 (∞)</div>
        
        <!-- Player Status (Bottom Left) -->
        <div id="player-status">
            <div id="player-name-display">OPERATOR</div>
            <div id="health-track">
                <!-- NEW: Damage Trail (Behind Fill) -->
                <div id="health-damage"></div>
                <div id="health-fill"></div>
                <!-- Segments -->
                <div class="health-segment" style="left: 25%"></div>
                <div class="health-segment" style="left: 50%"></div>
                <div class="health-segment" style="left: 75%"></div>
            </div>
        </div>
    </div>
    
    <div id="room-code-display" style="display:none;">
        <span class="code-label">CODE:</span> <span class="code-value" id="room-code-value">----</span>
    </div>

    <!-- Scoreboard (Hidden by default, shown via Tab) -->
    <div id="scoreboard">
        <div class="scoreboard-info">
            <div id="sb-mode">GAME MODE</div>
            <div id="sb-map">on MAP NAME</div>
        </div>
        
        <div id="sb-status-container">
            <!-- Space for future timer/score -->
        </div>

        <div class="sb-row header">
            <div class="sb-col-name">PLAYER</div>
        </div>
        <div id="scoreboard-list">
            <!-- Populated via JS -->
        </div>
    </div>

    <div id="fps-display">FPS: 0</div>
    
    <div id="notification-area"></div>
    
    <div id="instructions">
        <!-- Will be populated dynamically -->
    </div>
    
    <!-- Click to Start Overlay -->
    <div id="pointer-lock-overlay">
        Click to Start
    </div>

    <!-- Respawn Overlay -->
    <div id="respawn-overlay" class="overlay" style="background: rgba(20, 0, 0, 0.6);">
        <div class="overlay-panel" style="border-color: #800; min-width: 300px; text-align: center;">
            <div class="overlay-header" style="border-bottom-color: #500;">
                <span class="overlay-title" style="color: #f55; font-size: 42px;">K.I.A.</span>
            </div>
            <div class="overlay-content">
                <div id="killer-display" style="margin-bottom: 20px; color: #aaa; font-family: 'Rajdhani', sans-serif; font-size: 18px;">
                    KILLED BY <span id="killer-name" style="color: #fff; font-weight: 700; font-size: 22px;">UNKNOWN</span>
                </div>
                <button class="menu-btn" id="btn-respawn" onclick="window.TacticalShooter.PlayerState.respawn()" style="border-color: #800; background: #300; color: #fff;">
                    DEPLOY
                </button>
            </div>
        </div>
    </div>

    <!-- ESC Menu Overlay -->
    <div id="esc-menu" class="overlay">
        <div class="overlay-panel">
            <div class="overlay-header">
                <span class="overlay-title">MENU</span>
            </div>
            <div class="overlay-content">
                <button class="menu-btn" onclick="window.TacticalShooter.UIManager.closeMenu()">BACK TO GAME</button>
                <button class="menu-btn" onclick="window.TacticalShooter.UIManager.openSettings()">SETTINGS</button>
                <button class="menu-btn" onclick="window.TacticalShooter.UIManager.confirmLeave()">LEAVE GAME</button>
            </div>
        </div>
    </div>

    <!-- Confirmation Modal (Ribbon Style) -->
    <div id="confirm-modal" class="overlay" style="z-index: 5000;">
        <div class="confirm-ribbon-panel">
            <div class="confirm-text">LEAVE GAME AND RETURN TO MENU?</div>
            <div class="confirm-actions">
                <button class="menu-btn small" onclick="window.TacticalShooter.UIManager.closeConfirm()">CANCEL</button>
                <button class="menu-btn small danger" onclick="window.TacticalShooter.UIManager.finalizeLeave()">DISCONNECT</button>
            </div>
        </div>
    </div>

    <!-- Settings Overlay -->
    <div id="settings-menu" class="overlay" style="z-index: 2001;">
        <div class="settings-panel">
            <div class="settings-header">
                <div class="back-arrow" onclick="window.TacticalShooter.UIManager.closeSettings()">&#8592;</div>
                <div class="settings-tabs">
                    <button id="tab-btn-controls" class="tab-btn active" onclick="window.TacticalShooter.UIManager.switchTab('controls')">CONTROLS</button>
                    <button id="tab-btn-graphics" class="tab-btn" onclick="window.TacticalShooter.UIManager.switchTab('graphics')">GRAPHICS</button>
                    <button id="tab-btn-hud" class="tab-btn" onclick="window.TacticalShooter.UIManager.switchTab('hud')">HUD</button>
                </div>
                <button class="reset-settings-btn" onclick="window.TacticalShooter.UIManager.resetAllSettings()">RESET DEFAULTS</button>
            </div>
            
            <div class="settings-content">
                <!-- CONTROLS TAB -->
                <div id="tab-controls" class="tab-content active" style="height:100%;">
                    <div class="split-view">
                        <div class="split-left">
                            <div class="control-group">
                                <label>
                                    MOUSE SENSITIVITY 
                                    <span id="sens-value" style="color: #fff;">0.002</span>
                                </label>
                                <input type="range" min="0.0005" max="0.01" step="0.0001" value="0.002" class="slider" id="sensitivity-slider" oninput="window.TacticalShooter.UIManager.updateSensitivity(this.value)">
                            </div>
                        </div>
                        <div class="split-divider"></div>
                        <div class="split-right">
                            <div class="keybinds-header">KEYBINDS</div>
                            <div id="keybinds-list" class="keybinds-container">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- GRAPHICS TAB -->
                <div id="tab-graphics" class="tab-content">
                    <div class="split-view">
                        <div class="split-left">
                            <!-- Switches -->
                            <div class="control-group">
                                <label>
                                    BULLET CASINGS
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="casings-toggle" onchange="window.TacticalShooter.UIManager.toggleSetting('casingsEnabled', this.checked)">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </label>
                            </div>

                            <div class="control-group" data-tooltip="affects muzzle flash and hit particles">
                                <label>
                                    DYNAMIC WEAPON LIGHTING
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="muzzleflash-toggle" onchange="window.TacticalShooter.UIManager.toggleSetting('muzzleFlashEnabled', this.checked)">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </label>
                            </div>

                            <div class="control-group" data-tooltip="shows own player model, may affect gun visuals">
                                <label>
                                    PLAYER MODEL
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="body-toggle" onchange="window.TacticalShooter.UIManager.toggleSetting('bodyEnabled', this.checked)">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </label>
                            </div>
                        </div>
                        
                        <div class="split-divider"></div>
                        
                        <div class="split-right">
                            <!-- Sliders -->
                            <div class="control-group" data-tooltip="limited by browser refresh rate">
                                <label>
                                    <span>
                                        MAX FRAMERATE
                                        <span style="font-size: 10px; color: #555; margin-left: 5px; text-transform: none;">(refresh rate dependent)</span>
                                    </span>
                                    <span id="max-fps-value" style="color: #fff;">UNLIMITED</span>
                                </label>
                                <input type="range" min="30" max="250" step="10" value="250" class="slider" id="max-fps-slider" oninput="window.TacticalShooter.UIManager.updateMaxFPS(this.value)">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- HUD TAB -->
                <div id="tab-hud" class="tab-content">
                    <div style="max-width: 500px;">
                        <div class="control-group">
                            <label>
                                SHOW CONTROLS HELP
                                <label class="toggle-switch">
                                    <input type="checkbox" id="controls-toggle" onchange="window.TacticalShooter.UIManager.toggleSetting('showControls', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </label>
                        </div>
                        
                        <div class="control-group">
                            <label>
                                SHOW FPS COUNTER
                                <label class="toggle-switch">
                                    <input type="checkbox" id="fps-toggle" onchange="window.TacticalShooter.UIManager.toggleSetting('showFPS', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </label>
                        </div>

                        <div class="control-group">
                            <label>
                                SHOW NAMETAGS
                                <label class="toggle-switch">
                                    <input type="checkbox" id="nametags-toggle" onchange="window.TacticalShooter.UIManager.toggleSetting('showNametags', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-footer">
                <div class="config-io-container">
                    <input type="text" id="config-string" placeholder="CONFIG STRING" onchange="window.TacticalShooter.UIManager.importSettingsString(this.value)">
                    <button class="footer-btn" onclick="window.TacticalShooter.UIManager.copyConfigString()">COPY</button>
                </div>
                <div style="display:flex; gap:15px;">
                    <button class="footer-btn" onclick="window.TacticalShooter.UIManager.closeSettings()">CLOSE</button>
                    <button class="footer-btn save-btn" onclick="window.TacticalShooter.UIManager.saveSettings()">SAVE & EXIT</button>
                </div>
            </div>
        </div>
    </div>
            `;
        }
    };
})();
