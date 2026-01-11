
// js/ui/prematch/lobby_settings.js
(function() {
    const LobbySettings = {
        container: null,
        
        init() {
            this.container = document.getElementById('lobby-settings-bar');
            // Global click listener to close dropdowns
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-select-container')) {
                    document.querySelectorAll('.custom-options.open').forEach(el => el.classList.remove('open'));
                }
            });
        },

        render() {
            if (!this.container) return;
            
            const state = window.TacticalShooter.MatchState.state;
            const isHost = window.TacticalShooter.PlayroomManager.isHost;
            const isLocked = state.status !== 'LOBBY';

            // Helper to create setting block
            const createBlock = (label, value, options, onChange) => {
                let html = `<div class="lobby-setting-group"><div class="lobby-label">${label}</div>`;
                
                if (isHost && !isLocked && options) {
                    // --- Custom Dropdown ---
                    // Find current label
                    const currentOpt = options.find(o => o.val == value) || options[0];
                    const displayTxt = currentOpt ? currentOpt.txt : value;
                    
                    html += `
                        <div class="custom-select-container" id="dd-${label}">
                            <div class="custom-select-trigger" onclick="window.TacticalShooter.LobbySettings.toggleDropdown('dd-${label}')">
                                <span>${displayTxt}</span>
                            </div>
                            <div class="custom-options">
                    `;
                    
                    options.forEach(opt => {
                        const isSelected = (opt.val == value) ? 'selected' : '';
                        html += `
                            <div class="custom-option ${isSelected}" 
                                 onclick="window.TacticalShooter.LobbySettings.selectOption('${label}', '${opt.val}')">
                                 ${opt.txt}
                            </div>
                        `;
                    });
                    
                    html += `   </div>
                        </div>`;
                } else {
                    // Read-only
                    let txt = value;
                    if (options) {
                        const found = options.find(o => o.val == value);
                        if (found) txt = found.txt;
                    }
                    html += `<div class="lobby-value-box">${txt}</div>`;
                }
                html += `</div>`;
                return html;
            };

            const mapOpts = [{val: "TESTING", txt: "TESTING"}];
            const modeOpts = [{val: "TDM", txt: "TEAM DEATHMATCH"}, {val: "FFA", txt: "FREE FOR ALL"}];
            const timeOpts = [{val: 1, txt: "1 MIN"}, {val: 5, txt: "5 MIN"}, {val: 10, txt: "10 MIN"}, {val: 20, txt: "20 MIN"}];
            const teamOpts = [{val: 2, txt: "2 TEAMS"}, {val: 3, txt: "3 TEAMS"}, {val: 4, txt: "4 TEAMS"}];

            this.container.innerHTML = 
                createBlock("MAP", state.mapId, mapOpts) +
                createBlock("MODE", state.gamemode, modeOpts) +
                createBlock("TIME LIMIT", state.timeLimit, timeOpts) +
                (state.gamemode !== 'FFA' ? createBlock("TEAMS", state.teamCount, teamOpts) : "");
        },

        toggleDropdown(id) {
            const container = document.getElementById(id);
            if (!container) return;
            const options = container.querySelector('.custom-options');
            
            // Close others
            document.querySelectorAll('.custom-options.open').forEach(el => {
                if (el !== options) el.classList.remove('open');
            });
            
            options.classList.toggle('open');
        },

        selectOption(label, value) {
            const MS = window.TacticalShooter.MatchState;
            // Convert to int if needed (timeLimit, teamCount)
            let finalVal = value;
            if (label === 'TIME LIMIT' || label === 'TEAMS') finalVal = parseInt(value);
            
            if (label === 'MAP') MS.setSetting('mapId', finalVal);
            if (label === 'MODE') MS.setSetting('gamemode', finalVal);
            if (label === 'TIME LIMIT') MS.setSetting('timeLimit', finalVal);
            if (label === 'TEAMS') MS.setSetting('teamCount', finalVal);
            
            // Re-render handled by MatchState update, but we can force it here for snap
            this.render();
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.LobbySettings = LobbySettings;
})();
