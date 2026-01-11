
// js/multiplayer/remote_player_manager.js
(function() {
    const RemotePlayerManager = {
        remotePlayers: {},
        raycaster: null, 
        
        SYMBOLS: ['◆', '●', '■', '▼', '▲', '♠'],

        addPlayer(player) {
            if (this.remotePlayers[player.id]) return;
            
            const scene = window.TacticalShooter.GameManager ? window.TacticalShooter.GameManager.scene : null;
            if (!scene) return;
            
            const stateName = player.getState('name');
            const finalName = stateName || "...";
            
            // Get Team Assignment
            const assignment = this._getAssignment(player);
            
            // Text Mix Configuration
            let textMix = 0.0;
            if (assignment.teamId === 1) { // Red Team
                textMix = 0.05; 
            } else if (assignment.teamId === 0) { // Blue Team
                textMix = 0.05; 
            }
            
            const pos = player.getState('position') || { x: 0, y: 0, z: 0 };
            const rot = player.getState('rotation') || { x: 0, y: 0, z: 0 };
            
            let mesh, parts;
            if (window.TacticalShooter.PlayerModelBuilder) {
                const buildResult = window.TacticalShooter.PlayerModelBuilder.build();
                mesh = buildResult.mesh;
                parts = buildResult.parts;
                
                if (parts.leftLeg) parts.leftLeg.rotation.order = 'YXZ';
                if (parts.rightLeg) parts.rightLeg.rotation.order = 'YXZ';
                if (parts.leftArm) parts.leftArm.rotation.order = 'XYZ';
                if (parts.rightArm) parts.rightArm.rotation.order = 'XYZ';
                
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.userData.collidable = true;
                        child.userData.type = 'player';
                        child.userData.playerId = player.id; 
                    }
                });

            } else {
                const geo = new THREE.CapsuleGeometry(0.4, 1.85, 4, 8);
                const mat = new THREE.MeshStandardMaterial({ color: 0x444444 });
                mesh = new THREE.Mesh(geo, mat);
                mesh.userData.collidable = true;
                mesh.userData.type = 'player';
            }

            mesh.position.set(pos.x, pos.y, pos.z);
            mesh.rotation.y = rot.y || 0;
            
            const hitboxGeo = new THREE.BoxGeometry(0.45, 1.8, 0.45);
            const hitboxMat = new THREE.MeshBasicMaterial({ visible: false, wireframe: true });
            const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
            hitbox.position.y = 0.9; 
            hitbox.userData.isPlayerHitbox = true; 
            hitbox.userData.collidable = false; 
            
            mesh.add(hitbox);

            // NAMETAG GROUP
            const tagGroup = new THREE.Group();
            tagGroup.position.y = 2.1;
            mesh.add(tagGroup);

            // Name Sprite 
            const nameSprite = this._createNameSprite(finalName, assignment.teamColor, textMix);
            // Initial scales set in update
            tagGroup.add(nameSprite);
            
            // Marker Sprite
            const markerSprite = this._createMarkerSprite(assignment.symbol, assignment.teamColor);
            tagGroup.add(markerSprite);
            
            // --- HEALTH BAR SPRITE SYSTEM ---
            const hpWidth = 1.3;
            const hpHeight = 0.15; 
            
            // Background Bar (Black)
            const hpBgSprite = this._createHealthBarSprite("#000000", false, 0);
            hpBgSprite.center.set(0.0, 0.5); 
            // Position/Scale set in update
            tagGroup.add(hpBgSprite);
            
            // Damage Trail Bar (Grey) - Z-Order 0.01
            const hpDamageSprite = this._createHealthBarSprite("#aaaaaa", false, 0); 
            hpDamageSprite.center.set(0.0, 0.5);
            tagGroup.add(hpDamageSprite);
            
            // Foreground Fill (Color + Glow) - Z-Order 0.02
            const hpFillSprite = this._createHealthBarSprite(assignment.teamColor, true, 0);
            hpFillSprite.center.set(0.0, 0.5); 
            tagGroup.add(hpFillSprite);
            
            scene.add(mesh);
            
            let weaponParts = null;
            let weaponMesh = null;
            let muzzleFlashGroup = null;
            let muzzleFlashLight = null;
            let weaponDef = null;
            
            if (parts && parts.rightArm && parts.rightArm.userData.elbow && window.TacticalShooter.GameData.Weapons["PISTOL"]) {
                const elbowGroup = parts.rightArm.userData.elbow;
                const pistolDef = window.TacticalShooter.GameData.Weapons["PISTOL"];
                weaponDef = pistolDef; 
                
                if (pistolDef.buildMesh) {
                    const built = pistolDef.buildMesh();
                    weaponMesh = built.mesh; 
                    weaponParts = built.parts;
                    elbowGroup.add(weaponMesh);
                    
                    if (weaponParts.muzzle) {
                        muzzleFlashGroup = new THREE.Group();
                        muzzleFlashGroup.visible = false;
                        weaponParts.muzzle.add(muzzleFlashGroup);
                        
                        const flashColor = (weaponDef.effects && weaponDef.effects.muzzle) ? weaponDef.effects.muzzle.color : 0xffaa00;
                        const fMat = new THREE.MeshBasicMaterial({ color: flashColor, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
                        const fGeo = new THREE.PlaneGeometry(0.3, 0.3);
                        const p1 = new THREE.Mesh(fGeo, fMat);
                        const p2 = new THREE.Mesh(fGeo, fMat); p2.rotation.z = Math.PI/2;
                        
                        muzzleFlashGroup.add(p1); 
                        muzzleFlashGroup.add(p2);
                        muzzleFlashLight = new THREE.PointLight(flashColor, 0, 8);
                        muzzleFlashGroup.add(muzzleFlashLight);
                    }
                }
            }

            let animator = null;
            if (window.TacticalShooter.RemotePlayerAnimator) {
                animator = new window.TacticalShooter.RemotePlayerAnimator(mesh, parts, weaponParts, weaponMesh, weaponDef);
            }
            
            if (!this.raycaster) this.raycaster = new THREE.Raycaster();
            
            this.remotePlayers[player.id] = {
                id: player.id,
                player: player,
                name: finalName,
                teamId: assignment.teamId,
                teamColor: assignment.teamColor,
                symbol: assignment.symbol,
                mesh: mesh,
                hitbox: hitbox, 
                parts: parts, 
                animator: animator,
                
                tagGroup: tagGroup,
                nameSprite: nameSprite,
                markerSprite: markerSprite,
                
                // Sprites
                hpBgSprite: hpBgSprite,
                hpDamageSprite: hpDamageSprite,
                hpFillSprite: hpFillSprite,
                hpWidthBase: hpWidth,
                hpHeightBase: hpHeight,
                
                damageHealth: 100, 
                prevHealth: 100,
                damageTimer: 0,
                
                targetPosition: new THREE.Vector3(pos.x, pos.y, pos.z),
                targetRotationY: rot.y || 0,
                lastFired: 0,
                muzzleFlashGroup: muzzleFlashGroup,
                muzzleFlashLight: muzzleFlashLight,
                flashTimer: 0,
                weaponParts: weaponParts,
                weaponMesh: weaponMesh,
                weaponDef: weaponDef,
                slideOffset: -0.02,
                joinTime: Date.now(),
                processedHitIds: new Set(),
                isRagdolled: false
            };
            
            console.log(`RemotePlayerManager: Added ${finalName} (ID: ${player.id})`);
        },

        removePlayer(playerId) {
            const rp = this.remotePlayers[playerId];
            if (!rp) return;
            
            const scene = window.TacticalShooter.GameManager ? window.TacticalShooter.GameManager.scene : null;
            
            if (scene && !rp.isRagdolled && window.TacticalShooter.RagdollManager) {
                const crumpleImpulse = new THREE.Vector3((Math.random() - 0.5) * 1.5, -2.0, (Math.random() - 0.5) * 1.5);
                window.TacticalShooter.RagdollManager.spawn(rp.mesh, undefined, rp.mesh.position, rp.mesh.rotation.y, crumpleImpulse);
            }

            if (scene) {
                scene.remove(rp.mesh);
                // Dispose textures
                [rp.nameSprite, rp.markerSprite, rp.hpBgSprite, rp.hpDamageSprite, rp.hpFillSprite].forEach(s => {
                    if(s && s.material.map) s.material.map.dispose();
                    if(s) s.material.dispose();
                });
            }
            
            delete this.remotePlayers[playerId];
            console.log(`RemotePlayerManager: Removed ${rp.name}`);
        },

        removeAll() {
            for (const id in this.remotePlayers) {
                this.removePlayer(id);
            }
        },
        
        getHitboxes() {
            const hitboxes = [];
            for (const id in this.remotePlayers) {
                if (this.remotePlayers[id].hitbox) {
                    hitboxes.push(this.remotePlayers[id].hitbox);
                }
            }
            return hitboxes;
        },

        update(dt) {
            let showNametags = window.TacticalShooter.config ? window.TacticalShooter.config.showNametags : true;
            
            const MS = window.TacticalShooter.MatchState;
            const lobbyUI = document.getElementById('lobby-ui-layer');
            const isLobbyUIActive = lobbyUI && lobbyUI.classList.contains('active');
            
            // In Lobby, hide everything regardless of settings
            if ((MS && MS.state.status === 'LOBBY') || isLobbyUIActive) {
                showNametags = false;
                // We actually want to hide the group entirely in lobby to prevent clutter
                for (const id in this.remotePlayers) {
                    if (this.remotePlayers[id].tagGroup) this.remotePlayers[id].tagGroup.visible = false;
                }
                // Skip the rest of loop to avoid calculating logic for hidden lobby players
                // But we still need to update position/animation! 
                // So we just set a flag to hide visuals later.
            }

            const gameManager = window.TacticalShooter.GameManager;
            const gameCamera = gameManager ? gameManager.camera : null;
            const scene = gameManager ? gameManager.scene : null;
            const pm = window.TacticalShooter.ParticleManager;

            let localTeamId = 0;
            let myId = null;
            if (window.TacticalShooter.PlayroomManager && window.TacticalShooter.PlayroomManager.myPlayer) {
                 myId = window.TacticalShooter.PlayroomManager.myPlayer.id;
                 if (window.TacticalShooter.TeamManager) {
                     localTeamId = window.TacticalShooter.TeamManager.getLocalTeamId();
                 }
            }

            for (const id in this.remotePlayers) {
                const rp = this.remotePlayers[id];
                if (!rp.player) continue;

                const newState = this._getAssignment(rp.player);
                if (rp.teamId !== newState.teamId || rp.teamColor !== newState.teamColor) {
                    rp.teamId = newState.teamId;
                    rp.teamColor = newState.teamColor;
                    rp.symbol = newState.symbol;
                    
                    let textMix = 0.0;
                    if (rp.teamId === 1) textMix = 0.05;
                    else if (rp.teamId === 0) textMix = 0.05;
                    
                    if (rp.nameSprite.material.map) rp.nameSprite.material.map.dispose();
                    const newNameSprite = this._createNameSprite(rp.name, rp.teamColor, textMix);
                    rp.nameSprite.material.map = newNameSprite.material.map;
                    rp.nameSprite.material.needsUpdate = true;
                    
                    if (rp.markerSprite.material.map) rp.markerSprite.material.map.dispose();
                    const newMarkerSprite = this._createMarkerSprite(rp.symbol, rp.teamColor);
                    rp.markerSprite.material.map = newMarkerSprite.material.map;
                    rp.markerSprite.material.needsUpdate = true;
                    
                    // Update Fill Bar Color
                    if (rp.hpFillSprite.material.map) rp.hpFillSprite.material.map.dispose();
                    const newHpSprite = this._createHealthBarSprite(rp.teamColor, true, 0);
                    rp.hpFillSprite.material.map = newHpSprite.material.map;
                    rp.hpFillSprite.material.needsUpdate = true;
                }

                // 1. DATA SYNC & RAGDOLL CHECK
                const ragdollData = rp.player.getState('ragdollData');
                if (ragdollData) {
                    if (!rp.isRagdolled) {
                        rp.isRagdolled = true;
                        rp.mesh.visible = false; 
                        rp.mesh.position.set(0, -1000, 0);
                        // Hide tag in ragdoll
                        rp.tagGroup.visible = false;
                        
                        if (window.TacticalShooter.RagdollManager) {
                            const spawnPos = new THREE.Vector3(ragdollData.x, ragdollData.y, ragdollData.z);
                            const impulse = new THREE.Vector3(ragdollData.vx, ragdollData.vy, ragdollData.vz);
                            let momentum = null;
                            if (ragdollData.mvx !== undefined) momentum = new THREE.Vector3(ragdollData.mvx, ragdollData.mvy, ragdollData.mvz);
                            const hitOffset = ragdollData.offX !== undefined ? new THREE.Vector3(ragdollData.offX, ragdollData.offY, ragdollData.offZ) : null;
                            window.TacticalShooter.RagdollManager.spawn(rp.mesh, undefined, spawnPos, ragdollData.ry, impulse, hitOffset, momentum);
                        }
                    }
                    continue; 
                } else {
                    if (rp.isRagdolled) {
                        rp.isRagdolled = false;
                        rp.mesh.visible = true;
                        rp.tagGroup.visible = true; // Show tag again
                    }
                }

                const pos = rp.player.getState('position');
                const rot = rp.player.getState('rotation');
                const health = rp.player.getState('health') !== undefined ? rp.player.getState('health') : 100;
                
                // --- DAMAGE ANIMATION ---
                // Check if health dropped recently
                if (health < rp.prevHealth) {
                    rp.damageTimer = 0.5; // Reset delay when hit
                }
                rp.prevHealth = health;

                if (rp.damageHealth > health) {
                    if (rp.damageTimer > 0) {
                        rp.damageTimer -= dt;
                    } else {
                        // Lerp Speed 5.0 (Matches HUD)
                        rp.damageHealth = THREE.MathUtils.lerp(rp.damageHealth, health, dt * 5.0);
                        if (Math.abs(rp.damageHealth - health) < 0.5) rp.damageHealth = health;
                    }
                } else {
                    // Healed or equal
                    rp.damageHealth = health;
                    rp.damageTimer = 0;
                }
                
                if (health <= 0) {
                    rp.mesh.visible = false;
                    rp.tagGroup.visible = false;
                    rp.mesh.position.set(0, -1000, 0);
                    continue; 
                } else {
                    if (!rp.isRagdolled) {
                        rp.mesh.visible = true;
                        rp.tagGroup.visible = true;
                    }
                }

                const lookPitch = (rot && typeof rot.x === 'number') ? rot.x : 0;
                const lookYaw = (rot && typeof rot.y === 'number') ? rot.y : 0;

                const state = {
                    lean: rp.player.getState('lean') || 0,
                    isCrouching: rp.player.getState('isCrouching'),
                    isSliding: rp.player.getState('isSliding'),
                    isSprinting: rp.player.getState('isSprinting'),
                    isADS: rp.player.getState('isADS'),
                    isProne: rp.player.getState('isProne'), 
                    currentAmmo: rp.player.getState('currentAmmo'),
                    actionId: rp.player.getState('actionId') || 0, 
                    actionStartTime: rp.player.getState('actionStartTime') || 0,
                    lookPitch: lookPitch,
                    lookYaw: lookYaw
                };

                if (pos) rp.targetPosition.set(pos.x, pos.y, pos.z);
                
                const prevPos = rp.mesh.position.clone();
                const smoothFactor = 1.0 - Math.exp(-12.0 * dt);
                rp.mesh.position.lerp(rp.targetPosition, smoothFactor);
                
                const moveDelta = rp.mesh.position.clone().sub(prevPos);
                const worldVelocity = moveDelta.divideScalar(dt);
                
                let targetBodyYaw = lookYaw;
                if (state.isSliding && worldVelocity.length() > 0.5) {
                     targetBodyYaw = Math.atan2(worldVelocity.x, worldVelocity.z) + Math.PI;
                }

                if (typeof targetBodyYaw === 'number') {
                    rp.targetRotationY = targetBodyYaw;
                    let diff = rp.targetRotationY - rp.mesh.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    rp.mesh.rotation.y += diff * smoothFactor;
                }

                // 2. STATS & ANIMATOR
                const speed = worldVelocity.length();
                const forwardDir = new THREE.Vector3(0, 0, -1).applyEuler(rp.mesh.rotation);
                const rightDir = new THREE.Vector3(1, 0, 0).applyEuler(rp.mesh.rotation);
                const fwdSpeed = worldVelocity.dot(forwardDir);
                const strafeSpeed = worldVelocity.dot(rightDir);
                const isMoving = speed > 0.1;
                const isSprinting = (typeof state.isSprinting === 'boolean') ? state.isSprinting : (fwdSpeed > 5.5);
                const isStrafing = Math.abs(strafeSpeed) > Math.abs(fwdSpeed) && !isSprinting;
                
                let wallDistance = 999;
                if (scene && this.raycaster && rp.mesh) {
                    const eyeY = state.isCrouching ? 1.0 : 1.5;
                    const origin = rp.mesh.position.clone().add(new THREE.Vector3(0, eyeY, 0));
                    const lookQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(lookPitch, lookYaw, 0, 'YXZ'));
                    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(lookQuat);
                    this.raycaster.set(origin, direction);
                    this.raycaster.far = 1.0; 
                    const collidables = scene.children.filter(obj => obj.userData.collidable);
                    const hits = this.raycaster.intersectObjects(collidables, false);
                    if (hits.length > 0) wallDistance = hits[0].distance;
                }
                
                const derivedStats = { isMoving, isSprinting, isStrafing, isSliding: state.isSliding, isCrouching: state.isCrouching, speed, strafeSpeed, wallDistance };
                if (rp.animator) rp.animator.update(dt, state, derivedStats);

                // 4. FX
                const lastFired = rp.player.getState('lastFired') || 0;
                if (rp.weaponParts && rp.weaponParts.slide) {
                    let targetSlide = -0.02;
                    if (lastFired > rp.lastFired) {
                        rp.lastFired = lastFired;
                        rp.flashTimer = 0.05;
                        if (rp.muzzleFlashGroup) {
                            rp.muzzleFlashGroup.visible = true;
                            if (rp.muzzleFlashLight) rp.muzzleFlashLight.intensity = 5.0;
                        }
                        if (rp.weaponParts.ejection && pm && pm.casingsEnabled) {
                            const ejPos = new THREE.Vector3(); const ejQuat = new THREE.Quaternion();
                            rp.weaponParts.ejection.getWorldPosition(ejPos);
                            rp.weaponParts.ejection.getWorldQuaternion(ejQuat);
                            const ejDir = new THREE.Vector3(1, 0.5, 0.2).applyQuaternion(ejQuat).normalize();
                            pm.createShellCasing(ejPos, ejDir);
                        }
                        rp.slideOffset = 0.05; 
                    }
                    rp.slideOffset = THREE.MathUtils.lerp(rp.slideOffset, targetSlide, dt * 15.0);
                    rp.weaponParts.slide.position.z = rp.slideOffset;
                }

                if (rp.flashTimer > 0) {
                    rp.flashTimer -= dt;
                    if (rp.flashTimer <= 0 && rp.muzzleFlashGroup) {
                        rp.muzzleFlashGroup.visible = false;
                        if (rp.muzzleFlashLight) rp.muzzleFlashLight.intensity = 0;
                    }
                }
                if (rp.muzzleFlashGroup && rp.muzzleFlashGroup.visible && gameCamera) {
                    rp.muzzleFlashGroup.lookAt(gameCamera.position);
                }
                
                // 5. Hits Processing (Pass normal to animator for directional flinch)
                const hitQueue = rp.player.getState('hitQueue');
                if (Array.isArray(hitQueue)) {
                    hitQueue.forEach(hit => {
                        if (rp.processedHitIds.has(hit.id)) return;
                        rp.processedHitIds.add(hit.id);
                        if (rp.processedHitIds.size > 100) {
                            const arr = Array.from(rp.processedHitIds).slice(-50);
                            rp.processedHitIds = new Set(arr);
                        }

                        // Case 1: This remote player hit ME (local player)
                        if (hit.targetId === myId) {
                            if (window.TacticalShooter.PlayerState) {
                                const damage = hit.dmg || 0;
                                window.TacticalShooter.PlayerState.takeDamage(damage, rp.id, hit.part);
                            }
                        } 
                        // Case 2: This remote player hit ANOTHER remote player (e.g. A shot B, I am C)
                        // Or they hit themselves (unlikely)
                        else if (hit.targetId) {
                            // Find the victim in my remote list
                            const victim = this.remotePlayers[hit.targetId];
                            if (victim && victim.animator && victim.animator.triggerFlinch) {
                                // PASS NORMAL VECTOR FOR DIRECTIONAL FLINCH
                                const impactNormal = new THREE.Vector3(hit.nx, hit.ny, hit.nz);
                                victim.animator.triggerFlinch(hit.part || 'Torso', impactNormal);
                            }
                        }
                        
                        // Particle FX for everyone
                        if (hit.targetId !== myId && pm) {
                            const hitPos = new THREE.Vector3(hit.x, hit.y, hit.z);
                            const normal = new THREE.Vector3(hit.nx, hit.ny, hit.nz);
                            const effectsConfig = (rp.weaponDef && rp.weaponDef.effects) ? rp.weaponDef.effects.impact : {};
                            pm.createImpactSparks(hitPos, normal, effectsConfig);
                        }
                    });
                }

                // 6. VISIBILITY / NAMETAG LOGIC
                if (gameCamera && rp.tagGroup && !isLobbyUIActive && MS.state.status !== 'LOBBY') {
                    // Always look at camera first
                    rp.tagGroup.lookAt(gameCamera.position);
                    rp.tagGroup.visible = true; // Always visible (unless dead/ragdolled above)

                    const isFFA = (window.TacticalShooter.MatchState && window.TacticalShooter.MatchState.state.gamemode === 'FFA');
                    const isEnemy = isFFA || (rp.teamId !== localTeamId);
                    
                    const dist = gameCamera.position.distanceTo(rp.mesh.position);
                    
                    // --- SCALING LOGIC (Always runs) ---
                    const screenScale = Math.max(1.0, dist / 6.0); 
                    const symbolScale = Math.min(screenScale, 4.0);
                    
                    // 1. Name Scale
                    rp.nameSprite.scale.set(0.9 * screenScale, 0.18 * screenScale, 1);
                    
                    // 2. Health Bar Scale
                    const baseHpW = rp.hpWidthBase * screenScale;
                    const baseHpH = rp.hpHeightBase * screenScale;
                    
                    const fillPct = Math.max(0, health) / 100;
                    const damPct = Math.max(0, rp.damageHealth) / 100;
                    
                    // Fill
                    rp.hpFillSprite.scale.set(baseHpW * fillPct, baseHpH, 1);
                    rp.hpFillSprite.position.set(-baseHpW/2, 0, 0.02);
                    
                    // Damage
                    rp.hpDamageSprite.scale.set(baseHpW * damPct, baseHpH, 1);
                    rp.hpDamageSprite.position.set(-baseHpW/2, 0, 0.01);
                    
                    // BG (Full width)
                    rp.hpBgSprite.scale.set(baseHpW, baseHpH, 1);
                    rp.hpBgSprite.position.set(-baseHpW/2, 0, 0);
                    
                    // Marker Scale
                    rp.markerSprite.scale.set(0.4 * symbolScale, 0.4 * symbolScale, 1);
                    
                    // 3. Layout (Stacking Y) - Calculated regardless of visibility to ensure Symbol doesn't jump
                    const hpY = 0.05 * screenScale;
                    
                    // Update HP Group Pos
                    rp.hpBgSprite.position.y = hpY;
                    rp.hpDamageSprite.position.y = hpY;
                    rp.hpFillSprite.position.y = hpY;
                    
                    const nameY = hpY + (baseHpH/2) + (0.18 * screenScale / 2) + (0.02 * screenScale);
                    rp.nameSprite.position.y = nameY;
                    rp.markerSprite.position.y = nameY;

                    // --- VISIBILITY TOGGLE ---
                    if (showNametags) {
                        // STANDARD FADE LOGIC
                        let masterOpacity = 0.0;
                        let contentOpacity = 0.0; 
                        let symbolOpacity = 1.0; 

                        if (dist < 60) masterOpacity = 1.0;
                        else if (dist < 80) masterOpacity = 1.0 - (dist - 60)/20;
                        else masterOpacity = 0.0; 
                        
                        let distFade = 1.0;
                        if (dist > 20.0) {
                            if (dist > 25.0) distFade = 0.0;
                            else distFade = 1.0 - (dist - 20.0) / 5.0;
                        }
                        
                        if (masterOpacity > 0.01) {
                            if (!isEnemy) {
                                contentOpacity = 1.0;
                                symbolOpacity = 0.0; 
                            } else {
                                const camDir = new THREE.Vector3();
                                gameCamera.getWorldDirection(camDir);
                                const enemyDir = rp.mesh.position.clone().sub(gameCamera.position).normalize();
                                const angle = camDir.angleTo(enemyDir); 
                                
                                if (dist < 8.0) {
                                    contentOpacity = 1.0;
                                    symbolOpacity = 0.0;
                                } else {
                                    const threshold = 0.2; 
                                    const transitionZone = 0.1;
                                    if (angle < threshold) {
                                        contentOpacity = 1.0 * distFade; 
                                        symbolOpacity = 1.0 - contentOpacity; 
                                    } else if (angle < threshold + transitionZone) {
                                        const t = (angle - threshold) / transitionZone;
                                        contentOpacity = (1.0 - t) * distFade;
                                        symbolOpacity = Math.max(t, 1.0 - contentOpacity);
                                    } else {
                                        contentOpacity = 0.0;
                                        symbolOpacity = 1.0;
                                    }
                                }
                            }
                        }
                        
                        const finalSymbolOp = masterOpacity * symbolOpacity;
                        rp.markerSprite.material.opacity = THREE.MathUtils.lerp(rp.markerSprite.material.opacity, finalSymbolOp, dt * 10);
                        rp.markerSprite.visible = rp.markerSprite.material.opacity > 0.05;
                        
                        const finalContentOp = masterOpacity * contentOpacity;
                        rp.nameSprite.material.opacity = THREE.MathUtils.lerp(rp.nameSprite.material.opacity, finalContentOp, dt * 10);
                        rp.nameSprite.visible = rp.nameSprite.material.opacity > 0.05;
                        
                        // Health Bar Opacity links to Name
                        rp.hpBgSprite.material.opacity = 0.5 * rp.nameSprite.material.opacity;
                        rp.hpBgSprite.visible = rp.nameSprite.visible;
                        rp.hpDamageSprite.material.opacity = 0.8 * rp.nameSprite.material.opacity;
                        rp.hpDamageSprite.visible = rp.nameSprite.visible;
                        rp.hpFillSprite.material.opacity = rp.nameSprite.material.opacity;
                        rp.hpFillSprite.visible = rp.nameSprite.visible;

                    } else {
                        // "HARDCORE" MODE: HIDE DETAILS, FORCE MARKER
                        rp.nameSprite.visible = false;
                        rp.hpBgSprite.visible = false;
                        rp.hpDamageSprite.visible = false;
                        rp.hpFillSprite.visible = false;
                        
                        // Show Marker always (Team Indicator)
                        // TODO: Maybe hide enemies if far? For now, requirement says "unicode shows at all distances"
                        rp.markerSprite.material.opacity = 1.0;
                        rp.markerSprite.visible = true;
                    }
                }
                
                const remoteNameState = rp.player.getState('name');
                if (remoteNameState && remoteNameState !== rp.name && remoteNameState.length > 0) {
                    this._updateVisualName(id, remoteNameState);
                }
            }
        },
        
        _updateVisualName(id, newName) {
            const rp = this.remotePlayers[id];
            if (!rp) return;
            
            rp.name = newName;
            
            if (rp.nameSprite) {
                if (rp.nameSprite.material.map) rp.nameSprite.material.map.dispose();
                let textMix = 0.0;
                if (rp.teamId === 1) textMix = 0.05;
                else if (rp.teamId === 0) textMix = 0.05;
                const newSprite = this._createNameSprite(newName, rp.teamColor, textMix);
                rp.nameSprite.material.map = newSprite.material.map;
                rp.nameSprite.material.needsUpdate = true;
            }
        },

        _getAssignment(player) {
            const id = player.id || player; 
            const teamId = player.getState ? player.getState('teamId') : undefined;
            const validTid = (typeof teamId === 'number') ? teamId : 0;
            
            const TM = window.TacticalShooter.TeamManager;
            let color = "#ffffff"; 
            
            const MS = window.TacticalShooter.MatchState;
            const myTeam = TM ? TM.getLocalTeamId() : -1;
            
            if (MS && MS.state.gamemode === 'FFA') {
                if (validTid === myTeam) {
                    color = TM.getTeam(validTid).color; 
                } else {
                    color = "#EE0000"; 
                }
            } else {
                if (TM && TM.teams[validTid]) {
                    if (validTid === 0) {
                        // Tactical Azure: Lighter Hue, Same Darkness
                        color = "#0077CC"; 
                    } else if (validTid === 1) {
                        color = "#EE0000"; // Vibrant Red
                    } else {
                        color = TM.teams[validTid].color;
                    }
                } else {
                    color = "#00AAFF"; 
                }
            }
            
            let hash = 0;
            for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i) | 0;
            const symbolIndex = Math.abs(hash) % 6;
            
            return { teamId: validTid, teamColor: color, symbol: this.SYMBOLS[symbolIndex] };
        },
        
        _createNameSprite(text, color, mixFactor) {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            
            let fillStyle = color;
            
            // Override Blue Team text color to be more vibrant/saturated
            // Only affects text, not healthbar or symbols which use raw `color`
            if (color === "#0077CC") {
                fillStyle = "#0099FF"; 
            } else {
                const baseC = new THREE.Color(color);
                const lighterC = baseC.clone().lerp(new THREE.Color(0xffffff), mixFactor);
                fillStyle = lighterC.getStyle();
            }

            ctx.font = 'bold 36px Arial, sans-serif'; 
            ctx.letterSpacing = '4px'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'bottom'; 
            
            // Remove Glow and Outline completely
            ctx.shadowBlur = 0; 
            ctx.shadowColor = "transparent";
            
            ctx.fillStyle = fillStyle;
            ctx.fillText(text, 128, 55);

            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });
            const sprite = new THREE.Sprite(mat);
            return sprite;
        },
        
        _createMarkerSprite(symbol, color) {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            ctx.shadowColor = color;
            ctx.shadowBlur = 20; 
            
            ctx.fillStyle = color; 
            ctx.font = 'bold 75px Arial'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle';
            
            ctx.fillText(symbol, 64, 64);
            
            const tex = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true });
            return new THREE.Sprite(mat);
        },
        
        _createHealthBarSprite(color, isGlowing, mixFactor) {
            const w = 128;
            const h = 32;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            
            const barH = 5;
            const padding = 10;
            // Draw full width relative to texture (geometry will scale it)
            const barW = w - (padding * 2);
            const barY = (h - barH) / 2;
            
            if (isGlowing) {
                const baseC = new THREE.Color(color);
                const lighterC = baseC.clone().lerp(new THREE.Color(0xffffff), mixFactor);
                const style = lighterC.getStyle();
                
                ctx.shadowColor = style;
                ctx.shadowBlur = 8; // Restored standard glow
                ctx.fillStyle = style;
            } else {
                if (color === "#aaaaaa") {
                    ctx.fillStyle = "rgba(170, 170, 170, 0.8)";
                } else {
                    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
                }
            }
            
            ctx.fillRect(padding, barY, barW, barH);
            
            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            
            const mat = new THREE.SpriteMaterial({ 
                map: tex, 
                depthTest: true, 
                depthWrite: false, 
                transparent: true,
                opacity: isGlowing ? 1.0 : 0.6,
                blending: isGlowing ? THREE.AdditiveBlending : THREE.NormalBlending
            });
            return new THREE.Sprite(mat);
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.RemotePlayerManager = RemotePlayerManager;
})();
