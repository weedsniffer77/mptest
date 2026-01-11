
// js/multiplayer/playroom_manager.js
(function() {
    const PlayroomManager = {
        myPlayer: null,
        isHost: false,
        roomCode: null,
        lastUpdate: 0,
        updateInterval: 30, 
        
        localPlayerName: "Player",
        connectionTime: 0,
        initialLoadDone: false,
        
        // Background Sync Worker
        worker: null,
        
        hitQueue: [],
        
        init() {
            console.log('PlayroomManager: Initializing Logic...');
            this.cleanURL();
            this.initBackgroundWorker();

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/playroomkit/multiplayer.full.umd.js';
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                console.log('PlayroomManager: ✓ SDK Loaded');
                if (window.TacticalShooter.MultiplayerUI) {
                    window.TacticalShooter.MultiplayerUI.init();
                }
            };
            document.head.appendChild(script);
        },
        
        initBackgroundWorker() {
            // Worker ticks every 33ms to keep network alive in background tabs
            const workerCode = `
            self.interval = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (self.interval) clearInterval(self.interval);
                    self.interval = setInterval(() => {
                        self.postMessage('tick');
                    }, 33);
                } else if (e.data === 'stop') {
                    if (self.interval) clearInterval(self.interval);
                    self.interval = null;
                }
            };
            `;
            
            const blob = new Blob([workerCode], {type: 'application/javascript'});
            this.worker = new Worker(URL.createObjectURL(blob));
            
            this.worker.onmessage = () => {
                if (document.hidden) {
                    this.update(0.033);
                }
            };
            
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    console.log('App backgrounded: Switching to Worker heartbeat');
                    this.worker.postMessage('start');
                } else {
                    console.log('App foregrounded: Stopping Worker heartbeat');
                    this.worker.postMessage('stop');
                }
            });
        },
        
        cleanURL() {
            try {
                const url = new URL(window.location.href);
                let changed = false;
                const paramsToRemove = ['player_name', 'room', 'roomCode', 'r', 'playroom_kit_room_code'];
                paramsToRemove.forEach(p => { if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }});
                if (changed) window.history.replaceState({}, '', url);
            } catch (e) {}
        },

        async createRoom(name) {
            this.localPlayerName = name;
            await Playroom.insertCoin({
                skipLobby: true,
                maxPlayersPerRoom: 16,
                allowGameStates: true, 
                defaultPlayerStates: { name: "", teamId: 0, hitQueue: [] } 
            });
            this._onSessionStart();
        },

        async joinRoom(name, code) {
            this.localPlayerName = name;
            await Playroom.insertCoin({
                skipLobby: true,
                roomCode: code,
                maxPlayersPerRoom: 16,
                allowGameStates: true, 
                defaultPlayerStates: { name: "", teamId: 0, hitQueue: [] }
            });
            this._onSessionStart();
        },

        _onSessionStart() {
            this.isHost = Playroom.isHost();
            this.myPlayer = Playroom.myPlayer();
            this.roomCode = Playroom.getRoomCode();
            this.connectionTime = Date.now();
            this.initialLoadDone = false;
            
            this.myPlayer.setState('name', this.localPlayerName, true);
            this.myPlayer.setState('hitQueue', [], true);
            
            console.log(`PlayroomManager: Session Started. Name: ${this.localPlayerName}, Host: ${this.isHost}`);
            
            if (window.TacticalShooter.GameManager) {
                window.TacticalShooter.GameManager.enterLobby();
            }
            if (window.TacticalShooter.MultiplayerUI) {
                window.TacticalShooter.MultiplayerUI.onGameStarted(this.roomCode, this.isHost);
            }
            
            this._setupNetworkListeners();
            setTimeout(() => { this.initialLoadDone = true; }, 1000);
        },

        _setupNetworkListeners() {
            Playroom.onPlayerJoin((player) => {
                if (player.id === this.myPlayer.id) return;
                
                if (window.TacticalShooter.RemotePlayerManager) {
                    window.TacticalShooter.RemotePlayerManager.addPlayer(player);
                }
                
                if (this.initialLoadDone) this._waitForNameAndNotify(player);

                player.onQuit(() => {
                    if (window.TacticalShooter.RemotePlayerManager) {
                        const rpm = window.TacticalShooter.RemotePlayerManager;
                        const p = rpm.remotePlayers[player.id];
                        const name = (p && p.name !== '...') ? p.name : 'PLAYER';
                        let type = 'red'; 
                        if (p && p.team && p.team.label === 'BLUE') type = 'blue'; 
                        rpm.removePlayer(player.id);
                        if (this.initialLoadDone && window.TacticalShooter.MultiplayerUI) {
                            window.TacticalShooter.MultiplayerUI.showNotification(`${name} LEFT`, type);
                        }
                    }
                });
            });
        },
        
        _waitForNameAndNotify(player, attempts = 0) {
            const name = player.getState('name');
            if (name && name.length > 0) {
                if (window.TacticalShooter.MultiplayerUI) {
                    window.TacticalShooter.MultiplayerUI.showNotification(`${name} JOINED`, 'blue');
                }
                return;
            }
            if (attempts < 20) setTimeout(() => this._waitForNameAndNotify(player, attempts + 1), 250);
        },

        update(dt) {
            if (!this.myPlayer) return;

            const now = performance.now();
            if (now - this.lastUpdate < this.updateInterval) return;
            this.lastUpdate = now;

            const currentStateName = this.myPlayer.getState('name');
            if (currentStateName !== this.localPlayerName) {
                this.myPlayer.setState('name', this.localPlayerName, true);
            }

            // Sync global settings
            if (window.TacticalShooter.MatchState) {
                window.TacticalShooter.MatchState.syncMatchState();
                
                // HOST ONLY: Logic Update (Countdown check)
                // This runs here because this update loop is kept alive by Worker when backgrounded
                if (this.isHost) {
                    window.TacticalShooter.MatchState.hostUpdateLogic();
                }
            }

            // Host init logic
            if (this.isHost) {
                const globalStatus = Playroom.getState('MATCH_status');
                if (!globalStatus) {
                    console.log("PlayroomManager (HOST): Initializing Global Match Defaults");
                    const MS = window.TacticalShooter.MatchState;
                    MS.setSetting('status', 'LOBBY');
                    MS.setSetting('gamemode', 'TDM');
                    MS.setSetting('mapId', 'TESTING'); 
                    MS.setSetting('timeLimit', 10);
                    MS.setSetting('teamCount', 2);
                }
            }

            // Gameplay packet
            if (window.TacticalShooter.GameManager.currentState === 'IN_GAME') {
                if (window.TacticalShooter.NetworkState) {
                    const packet = window.TacticalShooter.NetworkState.getLocalPacket();
                    if (packet) {
                        for (const key in packet) {
                            this.myPlayer.setState(key, packet[key]);
                        }
                    }
                }
            }

            if (window.TacticalShooter.RemotePlayerManager) {
                window.TacticalShooter.RemotePlayerManager.update(dt);
            }
        },

        disconnect() {
            if (window.TacticalShooter.RemotePlayerManager) {
                window.TacticalShooter.RemotePlayerManager.removeAll();
            }
            this.myPlayer = null;
            this.isHost = false;
            this.roomCode = null;
            try { Object.keys(localStorage).forEach(key => { if (key.startsWith('playroom') || key.includes('roomCode')) localStorage.removeItem(key); }); } catch(e) {}
            this.cleanURL();
        },
        
        onPlayerFired() {
            if (this.myPlayer) this.myPlayer.setState('lastFired', Date.now());
        },

        broadcastBulletHit(position, normal, targetId, damage = 0, hitPart = null) {
            if (!this.myPlayer) return;
            
            const hitData = {
                id: Math.random().toString(36).substr(2, 9), 
                x: Math.round(position.x * 100) / 100,
                y: Math.round(position.y * 100) / 100,
                z: Math.round(position.z * 100) / 100,
                nx: Math.round(normal.x * 100) / 100,
                ny: Math.round(normal.y * 100) / 100,
                nz: Math.round(normal.z * 100) / 100,
                targetId: targetId || null, 
                dmg: damage, 
                part: hitPart, 
                t: Date.now()
            };
            
            this.hitQueue.push(hitData);
            if (this.hitQueue.length > 10) this.hitQueue.shift();
            this.myPlayer.setState('hitQueue', this.hitQueue);
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.PlayroomManager = PlayroomManager;
})();
