
// js/gamemodes/match_state.js
(function() {
    const MatchState = {
        // Local Mirror of Synced State
        state: {
            gamemode: "TDM", // TDM, FFA
            mapId: "TESTING", // Default Map
            timeLimit: 10, // Minutes
            teamCount: 2, // 2, 3, 4
            status: "LOBBY", // LOBBY, COUNTDOWN, PLAYING
            launchTime: 0 // Unix timestamp when game starts
        },

        init() {
            console.log("MatchState: Initialized");
            this.triggerUpdates();
        },

        // --- Host Actions (Updates Network Global State) ---
        
        setSetting(key, value) {
            if (!window.TacticalShooter.PlayroomManager.isHost) return;
            
            // 1. Update Local State immediately
            this.state[key] = value;
            
            // 2. Update Global Network State
            if (window.Playroom) {
                window.Playroom.setState(`MATCH_${key}`, value, true);
            }
            
            // 3. Trigger Logic & UI
            this.triggerUpdates();
        },

        startCountdown() {
            if (!window.TacticalShooter.PlayroomManager.isHost) return;
            console.log("MatchState: Starting Countdown...");
            const launchTime = Date.now() + 10000; // 10 seconds
            this.setSetting('launchTime', launchTime);
            this.setSetting('status', 'COUNTDOWN');
        },

        cancelCountdown() {
            if (!window.TacticalShooter.PlayroomManager.isHost) return;
            console.log("MatchState: Cancelling Countdown");
            this.setSetting('status', 'LOBBY');
            this.setSetting('launchTime', 0);
        },
        
        startGame() {
             if (!window.TacticalShooter.PlayroomManager.isHost) return;
             console.log("MatchState: Starting Game!");
             this.setSetting('status', 'PLAYING');
             
             if (window.TacticalShooter.GameManager) {
                 window.TacticalShooter.GameManager.enterGame();
             }
        },

        // --- Host Update Loop (Called by PlayroomManager background worker) ---
        hostUpdateLogic() {
            if (!window.TacticalShooter.PlayroomManager.isHost) return;
            
            // Check countdown expiration
            if (this.state.status === 'COUNTDOWN') {
                const now = Date.now();
                if (now >= this.state.launchTime) {
                    this.startGame();
                }
            }
        },

        // --- Global Sync (Called by PlayroomManager.update) ---
        
        syncMatchState() {
            if (!window.Playroom) return;

            const keys = ['gamemode', 'mapId', 'timeLimit', 'teamCount', 'status', 'launchTime'];
            let updated = false;

            keys.forEach(k => {
                const val = window.Playroom.getState(`MATCH_${k}`);
                if (val !== undefined && val !== this.state[k]) {
                    this.state[k] = val;
                    updated = true;
                }
            });

            if (updated) {
                // Rebalance check
                if (window.TacticalShooter.TeamManager) {
                    const myTeam = window.TacticalShooter.TeamManager.getLocalTeamId();
                    if (myTeam >= this.state.teamCount) {
                        window.TacticalShooter.TeamManager.autoBalance(this.state.teamCount);
                    }
                }
                
                // Game Start Transition
                if (this.state.status === 'PLAYING') {
                     if (window.TacticalShooter.GameManager && window.TacticalShooter.GameManager.currentState !== 'IN_GAME') {
                         window.TacticalShooter.GameManager.enterGame();
                     }
                }
                
                this.triggerUpdates();
            }
        },
        
        triggerUpdates() {
            if (window.TacticalShooter.TeamManager) {
                window.TacticalShooter.TeamManager.resolveTeamNames(this.state.gamemode, this.state.mapId);
            }
            if (window.TacticalShooter.LobbyUI) {
                window.TacticalShooter.LobbyUI.updateUI();
            }
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.MatchState = MatchState;
})();
