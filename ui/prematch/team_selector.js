
// js/ui/prematch/team_selector.js
(function() {
    const TeamSelector = {
        container: null,
        
        init() {
            this.container = document.getElementById('lobby-teams-container');
        },

        render() {
            if (!this.container) return;
            
            const MS = window.TacticalShooter.MatchState.state;
            const TM = window.TacticalShooter.TeamManager;
            const localId = window.TacticalShooter.PlayroomManager.myPlayer ? window.TacticalShooter.PlayroomManager.myPlayer.id : null;
            
            this.container.innerHTML = '';

            if (MS.gamemode === 'FFA') {
                const players = [];
                const localName = window.TacticalShooter.PlayroomManager.localPlayerName;
                
                players.push({ name: localName, isLocal: true, id: localId });
                
                if (window.TacticalShooter.RemotePlayerManager) {
                     for (let id in window.TacticalShooter.RemotePlayerManager.remotePlayers) {
                         const rp = window.TacticalShooter.RemotePlayerManager.remotePlayers[id];
                         players.push({ name: rp.name, isLocal: false, id: id });
                     }
                }
                this.renderBox(-1, "SOLO", "#555", players, false, true);
            } else {
                const count = MS.teamCount;
                const myTeam = TM.getLocalTeamId();
                const isLocked = MS.status !== 'LOBBY';

                for (let i = 0; i < count; i++) {
                    const team = TM.getTeam(i);
                    const teamPlayers = TM.getPlayersOnTeam(i).map(p => ({
                        name: p.name,
                        isLocal: (p.id === localId),
                        id: p.id
                    }));
                    const canJoin = !isLocked && (myTeam !== i);
                    this.renderBox(i, team.name, team.color, teamPlayers, canJoin, false);
                }
            }
        },

        renderBox(id, name, color, players, canJoin, isFFA) {
            // Simple Div Structure - No overlays, no sensors, just standard DOM
            const container = document.createElement('div');
            container.className = `team-container ${canJoin ? 'joinable' : ''}`;
            container.style.borderLeftColor = color;
            
            if (canJoin) {
                container.onclick = () => this.onJoin(id);
            }

            let cardHtml = `
                <div class="team-header" style="color: ${color}">
                    <span class="team-name">${name}</span>
                    <span class="team-count">${players.length}/16</span>
                </div>
                <div class="team-list">
            `;
            
            players.forEach(p => {
                let rowClass = 'team-player-row';
                if (p.isLocal) {
                    rowClass += ' player-row-self'; 
                }
                
                const symbol = this.getSymbol(p.id);
                cardHtml += `
                    <div class="${rowClass}">
                        <div class="player-symbol" style="color: ${color}">${symbol}</div>
                        ${p.name}
                    </div>
                `;
            });
            
            cardHtml += `   </div>`; 
            container.innerHTML = cardHtml;
            
            this.container.appendChild(container);
        },
        
        onJoin(id) {
            window.TacticalShooter.TeamManager.setLocalTeam(id);
            this.render();
        },
        
        getSymbol(id) {
            if (!id) return '◆';
            const SYMBOLS = ['◆', '●', '■', '▼', '▲', '♠'];
            let hash = 0;
            for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i) | 0;
            return SYMBOLS[Math.abs(hash) % 6];
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.TeamSelector = TeamSelector;
})();
