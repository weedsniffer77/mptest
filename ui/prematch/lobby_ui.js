
// js/ui/prematch/lobby_ui.js
(function() {
    const LobbyUI = {
        container: null,
        
        init() {
            console.log("LobbyUI: Initializing...");
            // Create container div if not exists
            if (!document.getElementById('lobby-ui-layer')) {
                const div = document.createElement('div');
                div.id = 'lobby-ui-layer';
                div.innerHTML = `
                    <div id="lobby-settings-bar"></div>
                    <div id="lobby-teams-container"></div>
                    <div id="lobby-launch-control"></div>
                `;
                document.body.appendChild(div);
            }
            
            this.container = document.getElementById('lobby-ui-layer');
            
            // Init Components
            if (window.TacticalShooter.LobbySettings) window.TacticalShooter.LobbySettings.init();
            if (window.TacticalShooter.TeamSelector) window.TacticalShooter.TeamSelector.init();
            if (window.TacticalShooter.LaunchControl) window.TacticalShooter.LaunchControl.init();
        },

        show() {
            if (this.container) this.container.classList.add('active');
            // Ensure HUD is hidden
            document.getElementById('hud').style.display = 'none';
            document.getElementById('crosshair').style.display = 'none';
            
            // Show Room Code in Lobby
            const rc = document.getElementById('room-code-display');
            if (rc) {
                rc.style.display = 'flex';
                // Ensure high z-index to sit above lobby background if needed
                rc.style.zIndex = '3000'; 
            }
            
            // CRITICAL: Force initial render of all components
            this.updateUI();
            
            // Start Update Loop
            this.updateLoop();
        },

        hide() {
            if (this.container) this.container.classList.remove('active');
        },
        
        updateUI() {
            // Trigger components to refresh based on MatchState
            if (window.TacticalShooter.LobbySettings) window.TacticalShooter.LobbySettings.render();
            if (window.TacticalShooter.TeamSelector) window.TacticalShooter.TeamSelector.render();
            if (window.TacticalShooter.LaunchControl) window.TacticalShooter.LaunchControl.render();
        },
        
        updateLoop() {
            if (!this.container.classList.contains('active')) return;
            
            requestAnimationFrame(() => this.updateLoop());
            
            // Frequent updates for countdowns and team lists
            if (window.TacticalShooter.LaunchControl) window.TacticalShooter.LaunchControl.update();
            // We re-render team lists occasionally to catch new players? 
            // Better done via event, but simple polling works for now:
            if (window.performance.now() % 500 < 20) {
                 if (window.TacticalShooter.TeamSelector) window.TacticalShooter.TeamSelector.render();
            }
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.LobbyUI = LobbyUI;
})();
