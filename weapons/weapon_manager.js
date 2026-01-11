
// js/weapons/weapon_manager.js
(function() {
    const WeaponManager = {
        currentWeapon: null,
        fireTimer: 0,
        
        // Input latch
        fPressed: false,
        
        // Audio
        audioCtx: null,
        
        init() {
            console.log('WeaponManager: Initializing...');
            
            // Init Loadout
            window.TacticalShooter.LoadoutManager.init();
            
            // Get weapon from loadout instead of hardcoded variable
            this.currentWeapon = window.TacticalShooter.LoadoutManager.getActiveWeaponDef();
            
            if (!this.currentWeapon) {
                console.error('WeaponManager: No active weapon found in Loadout!');
                return;
            }
            
            // Set initial player state based on weapon (Ammo etc)
            if (window.TacticalShooter.PlayerState) {
                window.TacticalShooter.PlayerState.setWeapon(this.currentWeapon);
            }
            
            // Init Audio Context
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext();
            } catch(e) { console.warn('Web Audio API not supported'); }
            
            // Initialize the Gun Renderer
            if (window.TacticalShooter.GunRenderer && window.TacticalShooter.PlayerCamera) {
                window.TacticalShooter.GunRenderer.init(window.TacticalShooter.PlayerCamera.camera);
                
                // LOAD WEAPON DATA
                window.TacticalShooter.GunRenderer.loadWeapon(this.currentWeapon);
            } else {
                console.error('WeaponManager: GunRenderer or PlayerCamera missing');
            }
        },
        
        playGunshotSound() {
            if (!this.audioCtx) return;
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            
            const t = this.audioCtx.currentTime;
            const duration = 0.2;
            
            // 1. SNAP
            const snapOsc = this.audioCtx.createOscillator();
            snapOsc.type = 'sawtooth';
            snapOsc.frequency.setValueAtTime(800, t);
            snapOsc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            
            const snapGain = this.audioCtx.createGain();
            snapGain.gain.setValueAtTime(0.4, t);
            snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            
            snapOsc.connect(snapGain);
            snapGain.connect(this.audioCtx.destination);
            
            snapOsc.start(t);
            snapOsc.stop(t + 0.15); 
            
            // 2. NOISE
            const bufferSize = this.audioCtx.sampleRate * duration;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
            
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;
            
            const noiseFilter = this.audioCtx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(2000, t);
            noiseFilter.frequency.linearRampToValueAtTime(100, t + duration);
            
            const noiseGain = this.audioCtx.createGain();
            noiseGain.gain.setValueAtTime(1.0, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.audioCtx.destination);
            
            noise.start(t);
            noise.stop(t + duration + 0.1); 
        },
        
        update(dt, inputManager, playerState, playerCamera) {
            if (!this.currentWeapon) return;
            
            // If dead, prevent update
            if (playerState.isDead) return;
            
            if (this.fireTimer > 0) this.fireTimer -= dt;
            
            // Update Gun Visuals
            if (window.TacticalShooter.GunRenderer) {
                const charController = window.TacticalShooter.CharacterController;
                // Pass isFiring (true if we are in the cooldown window of a shot)
                const isFiring = this.fireTimer > (this.currentWeapon.fireRate - 0.1);
                
                window.TacticalShooter.GunRenderer.update(dt, playerState, charController, inputManager, isFiring);
            }
            
            // Check for obstruction
            const isBlocked = window.TacticalShooter.GunRenderer && window.TacticalShooter.GunRenderer.isBarrelBlocked;
            
            // Logic
            if (inputManager.isActionActive('Reload')) playerState.startReload(); 
            
            // Inspect Weapon (Toggle)
            if (inputManager.isActionActive('Inspect')) {
                if (!this.fPressed) {
                    playerState.toggleInspect();
                    this.fPressed = true;
                }
            } else {
                this.fPressed = false;
            }
            
            // ADS (Cancel if blocked) - Configurable Bind
            let adsActive = inputManager.isActionActive('ADS');
            if (isBlocked) adsActive = false;
            playerState.setADS(adsActive);
            
            // Fire (Cancel if blocked) - Configurable Bind
            // Check firing mode (Automatic vs Semi-Auto)
            let isShooting = false;
            if (this.currentWeapon.automatic) {
                isShooting = inputManager.isActionActive('Shoot');
            } else {
                isShooting = inputManager.wasActionJustPressed('Shoot');
            }
            
            if (isShooting && !isBlocked) {
                this.attemptFire(playerState, playerCamera);
            }
        },
        
        attemptFire(playerState, playerCamera) {
            if (!this.currentWeapon) return;
            
            if (playerState.isReloading) return;
            if (playerState.currentAmmo <= 0) { playerState.startReload(); return; }
            if (this.fireTimer > 0) return;
            
            // Capture inspect state BEFORE consumption (which clears it)
            const wasInspecting = playerState.isInspecting;
            
            if (!playerState.consumeAmmo()) return;
            
            this.fireTimer = this.currentWeapon.fireRate;
            
            // Notify multiplayer of Shot Fired
            if (window.TacticalShooter.PlayroomManager) {
                window.TacticalShooter.PlayroomManager.onPlayerFired();
            }

            this.playGunshotSound();
            
            // Visual Recoil & Flash
            if (window.TacticalShooter.GunRenderer) {
                window.TacticalShooter.GunRenderer.applyRecoil();
                window.TacticalShooter.GunRenderer.triggerMuzzleFlash(this.currentWeapon);
            }
            
            // Ballistics
            let origin, direction;
            
            // Check for Sprinting
            const charController = window.TacticalShooter.CharacterController;
            const velocity = charController.velocity;
            const horizontalSpeed = new THREE.Vector3(velocity.x, 0, velocity.z).length();
            const isSprinting = horizontalSpeed > charController.config.walkSpeed + 1.0;

            if (window.TacticalShooter.GunRenderer) {
                const muzzleState = window.TacticalShooter.GunRenderer.getMuzzleState();
                origin = muzzleState.position;
                
                // --- AIM LOGIC ---
                // If sprinting (non-ADS) OR inspecting, shoot from barrel direction
                if ((isSprinting && !playerState.isADS) || wasInspecting) {
                    direction = muzzleState.direction;
                } else {
                    // NORMAL/ADS: Use Convergence (New Behavior)
                    // Bullet travels from Muzzle -> Crosshair Target
                    const targetPoint = window.TacticalShooter.Ballistics.getCrosshairTarget(
                        playerCamera.camera, 
                        this.currentWeapon.range
                    );
                    direction = new THREE.Vector3().subVectors(targetPoint, origin).normalize();
                }
                
            } else {
                origin = playerCamera.camera.position.clone();
                direction = playerCamera.getForwardDirection();
            }
            
            // Calculate Spread based on state
            let spread = this.currentWeapon.hipfireSpread;
            const isMoving = horizontalSpeed > 0.1;
            
            if (playerState.isADS) {
                if (isSprinting) {
                    // Sprinting while ADS - Significantly inaccurate
                    spread = this.currentWeapon.hipfireSpread * 2.0;
                } else {
                    // Normal ADS
                    spread = this.currentWeapon.adsSpread;
                }
            } else {
                if (isSprinting) {
                    // Sprinting without ADS
                    spread = this.currentWeapon.sprintSpread || (spread * 3.0);
                } else if (isMoving) {
                    // Walking Hipfire - Slightly inaccurate
                    spread = this.currentWeapon.hipfireSpread * 1.5;
                }
                // Else Standing Hipfire (default)
            }
            
            // Fire raycast with calculated direction + spread
            const result = window.TacticalShooter.Ballistics.fireRaycast(origin, direction, this.currentWeapon.range, spread);
            
            // Camera Recoil
            const kickPitch = this.currentWeapon.recoilPitch;
            const kickYaw = (Math.random() - 0.5) * this.currentWeapon.recoilYaw;
            playerCamera.addRecoil(kickPitch, kickYaw);

            if (result.hit) {
                // Determine effect type
                if (result.object && result.object.userData.type === 'player') {
                    // Hit a player
                    window.TacticalShooter.ParticleManager.createBloodSparks(result.point, result.normal);
                    
                    // --- HITBOX MULTIPLIER LOGIC ---
                    let damage = this.currentWeapon.damage; // Base: 20
                    const hitPart = result.object.name || "Torso";
                    
                    if (hitPart === "Head") {
                        damage *= 2.0; // 40
                    } else if (hitPart === "Arm" || hitPart === "Leg") {
                        damage = 15; // Fixed 15
                    }
                    // Else Torso = 20
                    
                    // Broadcast Network Hit with Variable Damage
                    if (window.TacticalShooter.PlayroomManager) {
                        window.TacticalShooter.PlayroomManager.broadcastBulletHit(
                            result.point, 
                            result.normal, 
                            result.playerId,
                            Math.floor(damage),
                            hitPart 
                        );
                    }
                    
                    // --- IMMEDIATE FLINCH (Local Visual Feedback) ---
                    // Trigger flinch on the remote player mesh immediately for responsiveness
                    if (window.TacticalShooter.RemotePlayerManager && result.playerId) {
                        const rp = window.TacticalShooter.RemotePlayerManager.remotePlayers[result.playerId];
                        if (rp && rp.animator && rp.animator.triggerFlinch) {
                            // Pass NORMAL vector to animator for directional flinch
                            rp.animator.triggerFlinch(hitPart, result.normal);
                        }
                    }

                } else {
                    // Hit environment
                    const effectsConfig = this.currentWeapon.effects ? this.currentWeapon.effects.impact : {};
                    window.TacticalShooter.ParticleManager.createImpactSparks(result.point, result.normal, effectsConfig);
                    
                    // Broadcast Env Hit (0 damage, no targetId)
                    if (window.TacticalShooter.PlayroomManager) {
                        window.TacticalShooter.PlayroomManager.broadcastBulletHit(
                            result.point, 
                            result.normal, 
                            null,
                            0,
                            null
                        );
                    }
                }
            }
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.WeaponManager = WeaponManager;
})();
