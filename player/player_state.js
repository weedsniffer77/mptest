
// js/player/player_state.js
(function() {
    const PlayerState = {
        health: 100,
        maxHealth: 100,
        isDead: false,
        
        // HUD Animation state
        damageHealth: 100, // Trailing value
        damageTimer: 0,
        
        // Current weapon ammo
        currentAmmo: 0,
        maxAmmo: 0,
        reserveAmmo: 999,
        
        // Logic state
        isReloading: false,
        reloadTimer: 0,
        reloadDuration: 2.0, 
        
        isADS: false,
        isInspecting: false,
        
        // --- NEW: Abstract Action Tracking ---
        currentActionId: 0,
        actionStartTime: 0,
        
        // Store last hit info for Ragdoll calculation
        lastDamageVector: null, // Initialized in init()
        lastHitPart: 'Torso', // Default
        
        init() {
            console.log('PlayerState: Initialized');
            this.health = this.maxHealth;
            this.damageHealth = this.maxHealth;
            this.isDead = false;
            
            // Initialize vector here when THREE is guaranteed to be ready
            this.lastDamageVector = new THREE.Vector3(0, 0, 1);
            
            this.updateHealthUI();
            this.updateHUD();
        },
        
        setWeapon(weaponDef) {
            this.maxAmmo = weaponDef.magazineSize;
            this.currentAmmo = this.maxAmmo; 
            this.reloadDuration = weaponDef.reloadTime;
            
            this.isReloading = false;
            this.isInspecting = false;
            this.currentActionId = 0;
            this.reloadTimer = 0;
            
            console.log(`PlayerState: Weapon set to ${weaponDef.name}`);
            this.updateHUD();
        },
        
        update(dt) {
            // Handle reload timer logic locally
            if (this.isReloading) {
                this.reloadTimer += dt;
                if (this.reloadTimer >= this.reloadDuration) {
                    this.finishReload();
                }
            }
            
            // Handle HUD Damage Decay
            if (this.health < this.damageHealth) {
                if (this.damageTimer > 0) {
                    this.damageTimer -= dt;
                } else {
                    // Decay
                    this.damageHealth = THREE.MathUtils.lerp(this.damageHealth, this.health, dt * 5.0);
                    if (Math.abs(this.damageHealth - this.health) < 0.5) this.damageHealth = this.health;
                    this.updateHealthUI();
                }
            } else if (this.health > this.damageHealth) {
                // Healed
                this.damageHealth = this.health;
                this.damageTimer = 0;
                this.updateHealthUI();
            }

            // Update name just in case local player name changes
            const nameEl = document.getElementById('player-name-display');
            if (nameEl && window.TacticalShooter.PlayroomManager) {
                const currentName = nameEl.textContent;
                const actualName = window.TacticalShooter.PlayroomManager.localPlayerName || 'OPERATOR';
                if (currentName !== actualName) {
                    nameEl.textContent = actualName;
                }
            }
            this.updateHUD();
        },
        
        takeDamage(amount, sourceId, hitPart) {
            if (this.isDead) return;
            
            this.health -= amount;
            if (this.health < 0) this.health = 0;
            this.lastHitPart = hitPart || 'Torso';
            
            // Reset damage timer to delay decay (damage stacking)
            this.damageTimer = 0.8;
            
            // Calculate Damage Vector
            if (window.TacticalShooter.PlayroomManager && window.TacticalShooter.PlayroomManager.myPlayer) {
                // Let's assume the hit came from the direction of the remote player who shot us
                if (sourceId && window.TacticalShooter.RemotePlayerManager) {
                    const shooter = window.TacticalShooter.RemotePlayerManager.remotePlayers[sourceId];
                    if (shooter && shooter.mesh) {
                        const myPos = window.TacticalShooter.CharacterController.position.clone();
                        const shooterPos = shooter.mesh.position.clone();
                        if (this.lastDamageVector) {
                            this.lastDamageVector.subVectors(myPos, shooterPos).normalize(); // Vector away from shooter
                            // Reduced vertical component to prevent popping
                            this.lastDamageVector.y += 0.1; 
                        }
                    }
                }
            }
            
            // --- FLINCH MECHANIC (Live Player) ---
            if (this.health > 0) {
                // 1. Camera Punch
                if (window.TacticalShooter.PlayerCamera) {
                    window.TacticalShooter.PlayerCamera.applyFlinch();
                }
                // 2. Physics Push
                if (window.TacticalShooter.CharacterController && this.lastDamageVector) {
                    const flinchImpulse = this.lastDamageVector.clone().multiplyScalar(3.0); 
                    window.TacticalShooter.CharacterController.applyImpulse(flinchImpulse);
                }
                // 3. Visual Flinch (Local Body)
                if (window.TacticalShooter.GunRenderer) {
                    window.TacticalShooter.GunRenderer.triggerFlinch(hitPart);
                }
            }
            
            this.updateHealthUI();
            
            if (this.health <= 0) {
                this.die(sourceId);
            }
        },
        
        die(killerId) {
            if (this.isDead) return;
            this.isDead = true;
            console.log('PlayerState: K.I.A.');
            
            const cc = window.TacticalShooter.CharacterController;
            const cam = window.TacticalShooter.PlayerCamera;
            // Use weapon definition impulse if available, else default to 6.0
            const weaponDef = window.TacticalShooter.WeaponManager ? window.TacticalShooter.WeaponManager.currentWeapon : null;
            let impulseForce = (weaponDef && weaponDef.ragdollImpulse) ? weaponDef.ragdollImpulse : 6.0; 
            
            // PHYSICS TWEAK: Reduce impulse drastically for body shots to prevent flinging
            if (this.lastHitPart !== 'Head') {
                impulseForce *= 0.1; // 10% force for body/limbs (Just collapse)
            } else {
                impulseForce *= 0.5; // Reduced from 1.5 to 0.5 to prevent snapping constraints
            }
            
            const damageVec = this.lastDamageVector ? this.lastDamageVector.clone() : new THREE.Vector3(0,0,1);

            const ragdollImpulse = new THREE.Vector3(
                damageVec.x * impulseForce,
                damageVec.y * impulseForce * 0.2, 
                damageVec.z * impulseForce
            );
            
            // Capture Player Momentum (Running speed)
            const momentum = cc.velocity.clone();
            if (momentum.length() > 5.0) momentum.normalize().multiplyScalar(5.0); 

            // Calculate Hit Offset for Physics Torque
            let hitOffset = new THREE.Vector3(0, 0.2, 0); 
            
            if (this.lastHitPart === 'Head') hitOffset.set(0, 0.8, 0);
            else if (this.lastHitPart === 'Leg') hitOffset.set(0, -0.7, 0);
            else if (this.lastHitPart === 'Arm') hitOffset.set(0.3, 0.4, 0);

            // 1. Broadcast Ragdoll State (For Remote Players)
            if (window.TacticalShooter.PlayroomManager && window.TacticalShooter.PlayroomManager.myPlayer) {
                const ragdollData = {
                    x: cc.position.x,
                    y: cc.position.y,
                    z: cc.position.z,
                    ry: cam ? cam.yaw : 0, 
                    // Impact Force
                    vx: ragdollImpulse.x,
                    vy: ragdollImpulse.y,
                    vz: ragdollImpulse.z,
                    // Momentum Velocity (New)
                    mvx: momentum.x,
                    mvy: momentum.y,
                    mvz: momentum.z,
                    // Hit Location
                    offX: hitOffset.x,
                    offY: hitOffset.y,
                    offZ: hitOffset.z,
                    time: Date.now()
                };
                window.TacticalShooter.PlayroomManager.myPlayer.setState('ragdollData', ragdollData, true);
            }

            // 2. Spawn Local Ragdoll (For ME to see)
            if (window.TacticalShooter.RagdollManager) {
                const spawnPos = cc.position.clone();
                window.TacticalShooter.RagdollManager.spawn(null, '#333333', spawnPos, (cam ? cam.yaw : 0), ragdollImpulse, hitOffset, momentum);
            }

            // Resolve Killer Name
            let killerName = "UNKNOWN";
            if (killerId) {
                if (window.TacticalShooter.PlayroomManager && window.TacticalShooter.PlayroomManager.myPlayer && killerId === window.TacticalShooter.PlayroomManager.myPlayer.id) {
                    killerName = "YOURSELF (SUICIDE)";
                } else if (window.TacticalShooter.RemotePlayerManager && window.TacticalShooter.RemotePlayerManager.remotePlayers[killerId]) {
                    killerName = window.TacticalShooter.RemotePlayerManager.remotePlayers[killerId].name.toUpperCase();
                }
            }
            
            const killerNameEl = document.getElementById('killer-name');
            if (killerNameEl) killerNameEl.textContent = killerName;
            
            // 3. Show Death Screen
            const respawnOverlay = document.getElementById('respawn-overlay');
            if (respawnOverlay) {
                respawnOverlay.classList.add('active');
            }
            
            // 4. Hide HUD
            if (window.TacticalShooter.MultiplayerUI) {
                document.getElementById('crosshair').style.display = 'none';
            }
            
            // 5. Unlock Cursor & FORCE VISIBILITY
            if (document.exitPointerLock) document.exitPointerLock();
            
            if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.cursorElement) {
                window.TacticalShooter.UIManager.cursorElement.style.display = 'block';
            }
            
            // 6. Disable Gun Model (Hands)
            if (window.TacticalShooter.GunRenderer) {
                window.TacticalShooter.GunRenderer.setVisible(false);
            }
        },
        
        respawn() {
            if (!this.isDead) return;
            console.log('PlayerState: Respawning...');
            
            // 1. Reset Stats
            this.health = this.maxHealth;
            this.damageHealth = this.maxHealth;
            this.isDead = false;
            this.currentAmmo = this.maxAmmo;
            this.isReloading = false;
            
            // Clear Ragdoll Data so remote players see me alive again
            if (window.TacticalShooter.PlayroomManager && window.TacticalShooter.PlayroomManager.myPlayer) {
                window.TacticalShooter.PlayroomManager.myPlayer.setState('ragdollData', null, true);
            }
            
            // 2. Teleport to Spawn
            if (window.TacticalShooter.GameManager) {
                window.TacticalShooter.GameManager.spawnPlayer();
            }
            
            // 3. Hide Death Screen
            const respawnOverlay = document.getElementById('respawn-overlay');
            if (respawnOverlay) {
                respawnOverlay.classList.remove('active');
            }
            
            // 4. Restore UI/Visuals
            if (window.TacticalShooter.MultiplayerUI) {
                document.getElementById('crosshair').style.display = 'block';
                window.TacticalShooter.MultiplayerUI.requestPointerLock();
            }
            
            if (window.TacticalShooter.GunRenderer) {
                window.TacticalShooter.GunRenderer.setVisible(true);
                // Reset gun anims
                window.TacticalShooter.GunRenderer.loadWeapon(window.TacticalShooter.WeaponManager.currentWeapon);
            }
            
            this.updateHealthUI();
            this.updateHUD();
        },
        
        updateHealthUI() {
            const bar = document.getElementById('health-fill');
            const damageBar = document.getElementById('health-damage');
            
            if (!bar || !damageBar) return;
            
            const pct = (this.health / this.maxHealth) * 100;
            const damagePct = (this.damageHealth / this.maxHealth) * 100;
            
            bar.style.width = `${pct}%`;
            damageBar.style.width = `${damagePct}%`;
            
            // Color Logic
            let color = '#ffffff'; 
            if (pct <= 25) {
                color = '#d65555'; 
            } else if (pct <= 50) {
                color = '#ffc0cb';
            }
            
            bar.style.backgroundColor = color;
            bar.style.boxShadow = `0 0 10px ${color}`;
        },
        
        startReload() {
            if (this.isDead) return false;
            if (this.isReloading) return false;
            if (this.currentAmmo === this.maxAmmo) return false;
            
            this.isReloading = true;
            this.isInspecting = false;
            this.reloadTimer = 0;
            
            // Set Abstract Action for Network
            // ID 101 = Pistol Reload. In future, map weapon type to ID.
            this.currentActionId = 101; 
            this.actionStartTime = Date.now();
            
            console.log('Reloading... (Action ID: 101)');
            return true;
        },
        
        finishReload() {
            this.currentAmmo = this.maxAmmo;
            this.isReloading = false;
            this.reloadTimer = 0;
            
            // Clear Action
            this.currentActionId = 0;
            
            console.log(`Reload complete: ${this.currentAmmo}/${this.maxAmmo}`);
        },
        
        consumeAmmo() {
            if (this.isDead) return false;
            if (this.isInspecting) this.isInspecting = false;
            if (this.currentAmmo > 0) {
                this.currentAmmo--;
                return true;
            }
            return false;
        },
        
        canShoot() {
            return !this.isDead && !this.isReloading && this.currentAmmo > 0;
        },
        
        setADS(active) {
            if (this.isDead) { this.isADS = false; return; }
            this.isADS = active;
            if (active) this.isInspecting = false;
        },
        
        toggleInspect() {
            if (!this.isDead && !this.isReloading && !this.isADS) {
                this.isInspecting = !this.isInspecting;
            }
        },
        
        updateHUD() {
            const ammoDisplay = document.getElementById('ammo-display');
            if (ammoDisplay) {
                if (this.isReloading) {
                    const progress = Math.floor((this.reloadTimer / this.reloadDuration) * 100);
                    ammoDisplay.textContent = `RELOADING... ${progress}%`;
                } else {
                    ammoDisplay.textContent = `${this.currentAmmo}/${this.maxAmmo} (∞)`;
                }
            }
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.PlayerState = PlayerState;
})();
