
// js/core/game_manager.js
(function() {
    const GameManager = {
        scene: null,
        camera: null,
        renderer: null,
        cubeCamera: null,
        cubeRenderTarget: null,
        
        currentState: "INIT", // INIT, LOBBY, IN_GAME, MENU
        isMenuMode: false, // Legacy flag for ESC menu
        
        lastTime: 0,
        lastRenderTime: 0,
        fpsTime: 0,
        fpsFrames: 0,
        
        config: { maxFPS: 250 },
        
        init() {
            // Safety check: Wait for THREE
            if (!window.THREE) {
                if (window.THREE_READY) {
                    // Ready but variable not seen? odd, but proceed.
                } else {
                    console.log('GameManager: Waiting for THREE.js...');
                    setTimeout(() => this.init(), 100);
                    return;
                }
            }

            if (this.scene) return; 

            console.log('GameManager: Initializing...');
            
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x111111); // Darker default
            
            // Create camera (World Camera)
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.scene.add(this.camera);
            
            // Create renderer
            const canvas = document.getElementById('game-canvas');
            this.renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            // Init components
            this.initReflections();
            this.initSystems();
            this.loadMap();
            
            window.addEventListener('resize', () => this.onResize());
            
            console.log('GameManager: ✓ Ready');
            
            // Init Multiplayer (This will trigger the UI and Menu Mode)
            if (window.TacticalShooter.PlayroomManager) {
                window.TacticalShooter.PlayroomManager.init();
            }

            // CRITICAL FIX: Ensure gameplay systems are hidden/inactive for the Menu
            this.setSystemsActive(false);

            // Start loop immediately, but logic depends on state
            this.currentState = "MENU"; // Waiting for Host/Join
            this.startLoop();
        },
        
        enterLobby() {
            console.log("GameManager: Entering Pre-Match Lobby");
            this.currentState = "LOBBY";
            
            // Enable Tactical Camera
            if (window.TacticalShooter.TacticalCamera) {
                window.TacticalShooter.TacticalCamera.activate();
            }
            
            // Show Lobby UI
            if (window.TacticalShooter.LobbyUI) {
                window.TacticalShooter.LobbyUI.show();
            }
            
            // Ensure Systems Paused
            this.setSystemsActive(false);
            
            // Initialize Logic Modules
            if (window.TacticalShooter.TeamManager) window.TacticalShooter.TeamManager.init();
            if (window.TacticalShooter.MatchState) window.TacticalShooter.MatchState.init();
            
            // Auto-balance self if needed on join (BUT NOT IF HOST)
            setTimeout(() => {
                if (window.TacticalShooter.PlayroomManager && !window.TacticalShooter.PlayroomManager.isHost) {
                    if (window.TacticalShooter.TeamManager) window.TacticalShooter.TeamManager.autoBalance(window.TacticalShooter.MatchState.state.teamCount);
                }
            }, 500);
        },
        
        enterGame() {
            console.log("GameManager: Entering Game...");
            this.currentState = "IN_GAME";
            
            // CRITICAL FIX: Ensure menu mode is disabled so inputs work
            this.isMenuMode = false;
            
            // Hide Lobby UI
            if (window.TacticalShooter.LobbyUI) {
                window.TacticalShooter.LobbyUI.hide();
            }
            if (window.TacticalShooter.TacticalCamera) {
                window.TacticalShooter.TacticalCamera.deactivate();
            }
            
            // Show HUD
            if (window.TacticalShooter.MultiplayerUI) {
                window.TacticalShooter.MultiplayerUI.setHUDVisible(true);
            }
            
            // Reset Player
            this.spawnPlayer();
            
            // Enable Systems
            this.setSystemsActive(true);
            
            // Lock Pointer
            if (window.TacticalShooter.MultiplayerUI) {
                window.TacticalShooter.MultiplayerUI.requestPointerLock();
            }
        },
        
        spawnPlayer() {
            // TODO: Use Team Spawns
            // For now, use default spawn from config
            const spawnPos = new THREE.Vector3(
                window.TESTING_GAME_CONFIG.playerSpawn.position.x,
                window.TESTING_GAME_CONFIG.playerSpawn.position.y,
                window.TESTING_GAME_CONFIG.playerSpawn.position.z
            );
            window.TacticalShooter.CharacterController.init(spawnPos);
            
            // Reset Camera Rotation
            if (window.TacticalShooter.PlayerCamera) {
                window.TacticalShooter.PlayerCamera.init(this.camera, window.TESTING_GAME_CONFIG.playerSpawn.rotation);
            }
            
            window.TacticalShooter.PlayerState.setWeapon(window.TacticalShooter.WeaponManager.currentWeapon);
        },
        
        setSystemsActive(active) {
            // Show/Hide Gun
            if (window.TacticalShooter.GunRenderer) {
                window.TacticalShooter.GunRenderer.setVisible(active);
            }
        },

        initReflections() {
            this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128); 
            this.cubeRenderTarget.texture.type = THREE.HalfFloatType;
            this.cubeCamera = new THREE.CubeCamera(0.5, 1000, this.cubeRenderTarget);
            this.scene.add(this.cubeCamera);
            this.scene.environment = this.cubeRenderTarget.texture;
        },
        
        initSystems() {
            if (window.TacticalShooter.UIManager) window.TacticalShooter.UIManager.init();
            window.TacticalShooter.InputManager.init();
            window.TacticalShooter.PlayerState.init();
            
            // Init placeholder physics/player - will be reset on spawn
            const spawnPos = new THREE.Vector3(0,10,0);
            window.TacticalShooter.CharacterController.init(spawnPos);
            window.TacticalShooter.PlayerCamera.init(this.camera, {x:0, y:0});
            
            window.TacticalShooter.WeaponManager.init();
            window.TacticalShooter.ParticleManager.init(this.scene);
            window.TacticalShooter.MaterialLibrary.init();
            window.TacticalShooter.Raytracer.init(this.renderer);
            window.TacticalShooter.Ballistics.init(this.scene);
            
            if (window.TacticalShooter.RagdollManager) window.TacticalShooter.RagdollManager.init(this.scene);
            
            if (window.TacticalShooter.TacticalCamera) window.TacticalShooter.TacticalCamera.init();
            if (window.TacticalShooter.LobbyUI) window.TacticalShooter.LobbyUI.init();
        },
        
        loadMap() {
            window.TacticalShooter.TestingMap.init(this.scene, window.TacticalShooter.MaterialLibrary);
            window.TacticalShooter.Raytracer.applyLighting(this.scene, this.renderer, window.TESTING_LIGHTING);
            window.TacticalShooter.SkyRenderer.init(this.scene, window.TESTING_LIGHTING);
            window.TacticalShooter.PostProcessor.init(this.renderer, this.scene, this.camera, window.TESTING_LIGHTING);
            
            if (this.cubeCamera) {
                this.cubeCamera.position.set(0, 10, 0); 
                this.cubeCamera.update(this.renderer, this.scene);
            }
        },
        
        setMenuMode(enabled) {
            this.isMenuMode = enabled;
            // Legacy hook for ESC menu
        },

        startLoop() {
            this.lastTime = performance.now();
            this.lastRenderTime = this.lastTime;
            this.fpsTime = this.lastTime;
            this.gameLoop();
        },
        
        startGameLoop() {
            // Legacy alias
            // this.startLoop();
        },
        
        gameLoop() {
            requestAnimationFrame(() => this.gameLoop());

            const currentTime = performance.now();
            
            if (this.config.maxFPS < 241) {
                const interval = 1000 / this.config.maxFPS;
                const elapsed = currentTime - this.lastRenderTime;
                if (elapsed < interval) return;
                this.lastRenderTime = currentTime - (elapsed % interval);
            } else {
                this.lastRenderTime = currentTime;
            }
            
            const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
            this.lastTime = currentTime;
            
            this.fpsFrames++;
            if (currentTime >= this.fpsTime + 1000) {
                const fpsDisplay = document.getElementById('fps-display');
                if (fpsDisplay && fpsDisplay.style.display !== 'none') {
                    fpsDisplay.textContent = `FPS: ${this.fpsFrames}`;
                }
                this.fpsTime = currentTime;
                this.fpsFrames = 0;
            }
            
            this.update(deltaTime);
            this.render(deltaTime);
        },
        
        update(dt) {
            // --- STATE MACHINE UPDATE ---
            
            if (this.currentState === 'MENU') {
                // Spinning camera for Main Menu
                this.menuCameraAngle = (this.menuCameraAngle || 0) + dt * 0.15;
                const dist = 60;
                this.camera.position.x = Math.sin(this.menuCameraAngle) * dist;
                this.camera.position.z = Math.cos(this.menuCameraAngle) * dist;
                this.camera.position.y = 30;
                this.camera.lookAt(0, 5, 0);
                if (window.TacticalShooter.SkyRenderer.update) window.TacticalShooter.SkyRenderer.update(this.camera);
                
                // Still update basic networking to keep connection alive
                if (window.TacticalShooter.PlayroomManager) window.TacticalShooter.PlayroomManager.update(dt);
                return;
            }

            if (this.currentState === 'LOBBY') {
                // Pre-Match Logic
                // Nothing physical updates.
                // Just network sync.
                if (window.TacticalShooter.PlayroomManager) window.TacticalShooter.PlayroomManager.update(dt);
                return;
            }
            
            // IN_GAME Logic (or fallback if ESC menu is open)
            if (this.isMenuMode) {
                // Paused in-game (ESC Menu)
            } else {
                window.TacticalShooter.CharacterController.update(dt, window.TacticalShooter.InputManager, window.TacticalShooter.PlayerState, this.scene);
                window.TacticalShooter.PlayerCamera.update(dt, window.TacticalShooter.InputManager, window.TacticalShooter.CharacterController, window.TacticalShooter.PlayerState);
                window.TacticalShooter.WeaponManager.update(dt, window.TacticalShooter.InputManager, window.TacticalShooter.PlayerState, window.TacticalShooter.PlayerCamera);
                window.TacticalShooter.PlayerState.update(dt);
                window.TacticalShooter.ParticleManager.update(dt);
                if (window.TacticalShooter.RagdollManager) window.TacticalShooter.RagdollManager.update(dt);
            }
            
            if (window.TacticalShooter.SkyRenderer.update) {
                window.TacticalShooter.SkyRenderer.update(this.camera);
            }
            
            window.TacticalShooter.InputManager.update();
            
            if (window.TacticalShooter.PlayroomManager) {
                window.TacticalShooter.PlayroomManager.update(dt);
            }
        },
        
        render(dt) {
            let activeCam = this.camera;
            
            // Use Tactical Camera if in Lobby
            if (this.currentState === 'LOBBY' && window.TacticalShooter.TacticalCamera && window.TacticalShooter.TacticalCamera.isActive) {
                activeCam = window.TacticalShooter.TacticalCamera.camera;
            }
            
            if (window.TacticalShooter.PostProcessor && window.TacticalShooter.PostProcessor.enabled) {
                // PostProcessor currently hardcoded to this.camera in init. 
                // Swapping cameras in PP would require a setter. 
                // For now, simple render for Lobby if PP doesn't support swap easily.
                if (this.currentState === 'LOBBY') {
                    this.renderer.render(this.scene, activeCam);
                } else {
                    window.TacticalShooter.PostProcessor.render(dt);
                }
            } else {
                this.renderer.render(this.scene, activeCam);
            }
        },
        
        onResize() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            if (window.TacticalShooter.PostProcessor) {
                window.TacticalShooter.PostProcessor.resize(width, height);
            }
            if (window.TacticalShooter.TacticalCamera) {
                window.TacticalShooter.TacticalCamera.onResize();
            }
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.GameManager = GameManager;
})();
