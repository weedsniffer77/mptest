
// js/ui/prematch/launch_control.js
(function() {
    const LaunchControl = {
        container: null,
        
        init() {
            this.container = document.getElementById('lobby-launch-control');
        },

        render() {
            if (!this.container) return;
            
            const isHost = window.TacticalShooter.PlayroomManager.isHost;
            const status = window.TacticalShooter.MatchState.state.status;
            
            let btnText = "WAITING FOR HOST";
            let btnClass = "";
            let onClick = null;
            let disabled = true;

            if (isHost) {
                disabled = false;
                if (status === 'LOBBY') {
                    btnText = "START GAME"; 
                    btnClass = "host-idle";
                    onClick = "window.TacticalShooter.MatchState.startCountdown()";
                } else if (status === 'COUNTDOWN') {
                    btnText = "ABORT"; 
                    btnClass = "counting";
                    onClick = "window.TacticalShooter.MatchState.cancelCountdown()";
                }
            } else {
                if (status === 'COUNTDOWN') {
                    btnText = "GAME STARTING"; 
                    btnClass = "counting";
                    disabled = false; 
                }
            }
            
            this.container.innerHTML = `
                <button id="btn-launch" class="${btnClass}" ${disabled ? 'disabled' : ''} onclick="${onClick || ''}">
                    ${btnText} <span id="launch-timer"></span>
                </button>
            `;
        },

        update() {
            const MS = window.TacticalShooter.MatchState;
            if (MS.state.status === 'COUNTDOWN') {
                const now = Date.now();
                const timeLeft = Math.max(0, Math.ceil((MS.state.launchTime - now) / 1000));
                
                const timerSpan = document.getElementById('launch-timer');
                if (timerSpan) timerSpan.textContent = `[${timeLeft}]`;
                
                // HOST LOGIC MOVED TO MatchState.hostUpdateLogic() to support background tabs
            }
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.LaunchControl = LaunchControl;
})();
