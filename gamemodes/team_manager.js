
// js/gamemodes/team_manager.js
(function() {
    const TeamManager = {
        // Defines fixed teams (ID 0-3) with Hex Colors
        // Colors updated for darker, more tactical HDR look
        teams: [
            { id: 0, name: "ALPHA", color: "#2277FF", players: [] },   // Standard Tactical Blue (Reverted)
            { id: 1, name: "BRAVO", color: "#cc3322", players: [] },   // Brick Red
            { id: 2, name: "CHARLIE", color: "#cc8800", players: [] }, // Dark Amber
            { id: 3, name: "DELTA", color: "#007777", players: [] }    // Deep Teal
        ],

        init() {
            console.log("TeamManager: Initialized");
        },

        getTeam(id) {
            return this.teams[id] || this.teams[0];
        },
        
        // Updates team names based on current Match State settings
        resolveTeamNames(gamemode, mapId) {
            let names = ["ALPHA", "BRAVO", "CHARLIE", "DELTA"]; 

            // Apply names to state
            for (let i = 0; i < this.teams.length; i++) {
                if (names[i]) this.teams[i].name = names[i];
            }
        },

        // Called by UI to render lists
        getPlayersOnTeam(teamId) {
            // This relies on RemotePlayerManager being up to date
            const players = [];
            const localId = window.TacticalShooter.PlayroomManager.myPlayer ? window.TacticalShooter.PlayroomManager.myPlayer.id : null;
            
            // Add Local
            if (localId) {
                const myTeam = this.getLocalTeamId();
                if (myTeam === teamId) {
                    players.push({ 
                        id: localId, 
                        name: window.TacticalShooter.PlayroomManager.localPlayerName
                    });
                }
            }

            // Add Remotes
            if (window.TacticalShooter.RemotePlayerManager) {
                const remotes = window.TacticalShooter.RemotePlayerManager.remotePlayers;
                for (const pid in remotes) {
                    const rp = remotes[pid];
                    const tid = rp.player.getState('teamId');
                    const finalTid = (typeof tid === 'number') ? tid : 0;
                    
                    if (finalTid === teamId) {
                        players.push({ id: pid, name: rp.name });
                    }
                }
            }
            return players;
        },

        getLocalTeamId() {
            if (!window.TacticalShooter.PlayroomManager.myPlayer) return 0;
            const tid = window.TacticalShooter.PlayroomManager.myPlayer.getState('teamId');
            return (typeof tid === 'number') ? tid : 0;
        },

        // Called by Client when joining or when Team Count reduces
        autoBalance(maxTeams) {
            let bestTeam = 0;
            let minCount = 999;

            for (let i = 0; i < maxTeams; i++) {
                const count = this.getPlayersOnTeam(i).length;
                if (count < minCount) {
                    minCount = count;
                    bestTeam = i;
                }
            }
            this.setLocalTeam(bestTeam);
        },

        setLocalTeam(id) {
            if (window.TacticalShooter.PlayroomManager.myPlayer) {
                window.TacticalShooter.PlayroomManager.myPlayer.setState('teamId', id, true);
                console.log(`TeamManager: Joined Team ${id}`);
            }
        },
        
        getTeamColorForPlayer(playerId) {
            if (window.TacticalShooter.PlayroomManager.myPlayer && playerId === window.TacticalShooter.PlayroomManager.myPlayer.id) {
                const tid = this.getLocalTeamId();
                return this.teams[tid].color;
            }
            
            if (window.TacticalShooter.RemotePlayerManager && window.TacticalShooter.RemotePlayerManager.remotePlayers[playerId]) {
                const rp = window.TacticalShooter.RemotePlayerManager.remotePlayers[playerId];
                const tid = rp.player.getState('teamId');
                const validTid = (typeof tid === 'number') ? tid : 0;
                return this.teams[validTid] ? this.teams[validTid].color : "#ffffff";
            }
            
            return "#ffffff";
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.TeamManager = TeamManager;
})();
