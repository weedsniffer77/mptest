
// js/render/gun_renderer.js
(function() {
    const GunRenderer = {
        camera: null,
        scene: null, 
        
        // Mode Config
        useFullBody: false,
        
        // FPS Hand Hierarchy
        weaponContainer: null, 
        recoilContainer: null, 
        gunMeshGroup: null,    
        
        // Full Body Hierarchy
        fullBodyMesh: null,
        fullBodyParts: null,
        fullBodyAnimator: null,
        
        // Common Parts Refs (Swapped based on mode)
        slideMesh: null,
        triggerMesh: null,
        muzzlePoint: null,     
        ejectionPoint: null,
        
        // Animation State
        slideOffset: 0,
        triggerRot: 0,
        inspectTime: 0,
        
        // Muzzle Flash
        muzzleFlashGroup: null,
        flashLight: null,
        flashMesh: null,
        flashMaterial: null, 
        flashTimer: 0,
        muzzleFlashEnabled: true,
        
        // Obstruction
        barrelRaycaster: null,
        isBarrelBlocked: false,
        
        // Data
        currentWeaponDef: null,
        visualConfig: null, 
        
        // State
        currentPosition: null, 
        currentRotation: null,
        
        hipVec: null,
        adsVec: null,
        sprintVec: null,
        blockedVec: null,
        
        recoilImpulse: { x: 0, y: 0, z: 0 },
        bobTime: 0,
        
        // Bob Smoothing State
        curBobPos: { x: 0, y: 0 },
        curBobRot: { x: 0, z: 0 },
        
        init(camera) {
            console.log('GunRenderer: Initializing...');
            this.camera = camera;
            this.scene = window.TacticalShooter.GameManager ? window.TacticalShooter.GameManager.scene : null;
            this.barrelRaycaster = new THREE.Raycaster();
            
            // FPS Containers
            this.weaponContainer = new THREE.Group();
            this.camera.add(this.weaponContainer);
            this.recoilContainer = new THREE.Group();
            this.weaponContainer.add(this.recoilContainer);
            
            this.curBobPos = { x: 0, y: 0 };
            this.curBobRot = { x: 0, z: 0 };
            
            console.log('GunRenderer: ✓ Ready');
        },

        setVisible(visible) {
            if (this.useFullBody) {
                if (this.fullBodyMesh) this.fullBodyMesh.visible = visible;
            } else {
                if (this.weaponContainer) this.weaponContainer.visible = visible;
            }
        },
        
        setUseFullBody(enabled) {
            if (this.useFullBody === enabled) return;
            this.useFullBody = enabled;
            
            // Hide everything
            if (this.weaponContainer) this.weaponContainer.visible = false;
            if (this.fullBodyMesh) this.fullBodyMesh.visible = false;
            
            // Reload current weapon to rebuild correct hierarchy
            if (this.currentWeaponDef) {
                this.loadWeapon(this.currentWeaponDef);
            }
        },

        loadWeapon(weaponDef) {
            console.log(`GunRenderer: Loading weapon ${weaponDef.name} (Mode: ${this.useFullBody ? "FullBody" : "Hands"})...`);
            this.currentWeaponDef = weaponDef;
            this.visualConfig = weaponDef.visuals;
            
            this.resetRefs();

            if (this.useFullBody) {
                this.setupFullBody(weaponDef);
            } else {
                this.setupFPSHands(weaponDef);
            }
            
            // Common Flash Setup
            if (this.muzzlePoint) {
                this._buildMuzzleFlash();
            }
        },
        
        resetRefs() {
            // Cleanup FPS
            if (this.gunMeshGroup) {
                this.recoilContainer.remove(this.gunMeshGroup);
                this.gunMeshGroup = null;
            }
            // Cleanup Full Body
            if (this.fullBodyMesh) {
                this.scene.remove(this.fullBodyMesh);
                this.fullBodyMesh = null;
                this.fullBodyParts = null;
                this.fullBodyAnimator = null;
            }
            
            this.slideMesh = null;
            this.triggerMesh = null;
            this.muzzlePoint = null;
            this.ejectionPoint = null;
            this.weaponContainer.visible = false;
        },
        
        setupFPSHands(weaponDef) {
            this.weaponContainer.visible = true;
            
            // Init Vectors
            this.hipVec = new THREE.Vector3(this.visualConfig.hipPosition.x, this.visualConfig.hipPosition.y, this.visualConfig.hipPosition.z);
            this.adsVec = new THREE.Vector3(this.visualConfig.adsPosition.x, this.visualConfig.adsPosition.y, this.visualConfig.adsPosition.z);
            this.sprintVec = new THREE.Vector3(this.visualConfig.sprintPosition.x, this.visualConfig.sprintPosition.y, this.visualConfig.sprintPosition.z);
            this.blockedVec = new THREE.Vector3(this.visualConfig.blockedPosition.x, this.visualConfig.blockedPosition.y, this.visualConfig.blockedPosition.z);
            
            this.currentPosition = this.hipVec.clone();
            this.currentRotation = new THREE.Euler(0, 0, 0);
            this.weaponContainer.position.copy(this.currentPosition);

            if (typeof weaponDef.buildMesh === 'function') {
                const built = weaponDef.buildMesh();
                this.gunMeshGroup = built.mesh;
                this.slideMesh = built.parts.slide;
                this.triggerMesh = built.parts.trigger;
                this.muzzlePoint = built.parts.muzzle;
                this.ejectionPoint = built.parts.ejection;
                this.recoilContainer.add(this.gunMeshGroup);
            }
        },
        
        setupFullBody(weaponDef) {
            if (!window.TacticalShooter.PlayerModelBuilder) return;
            
            // IMPORTANT: Initialize FPS state vectors anyway so we can perform the FPS math calculation
            this.hipVec = new THREE.Vector3(this.visualConfig.hipPosition.x, this.visualConfig.hipPosition.y, this.visualConfig.hipPosition.z);
            this.adsVec = new THREE.Vector3(this.visualConfig.adsPosition.x, this.visualConfig.adsPosition.y, this.visualConfig.adsPosition.z);
            this.sprintVec = new THREE.Vector3(this.visualConfig.sprintPosition.x, this.visualConfig.sprintPosition.y, this.visualConfig.sprintPosition.z);
            this.blockedVec = new THREE.Vector3(this.visualConfig.blockedPosition.x, this.visualConfig.blockedPosition.y, this.visualConfig.blockedPosition.z);
            this.currentPosition = this.hipVec.clone();
            this.currentRotation = new THREE.Euler(0, 0, 0);
            
            // Build Body
            const buildResult = window.TacticalShooter.PlayerModelBuilder.build('#222222'); // Dark gray local suit
            this.fullBodyMesh = buildResult.mesh;
            this.fullBodyParts = buildResult.parts;
            
            // HIDE HEAD FOR LOCAL PLAYER to prevent camera clipping
            if (this.fullBodyParts.head) {
                this.fullBodyParts.head.visible = false;
            }
            
            // Fix Rot Orders for IK
            const p = this.fullBodyParts;
            if (p.leftLeg) p.leftLeg.rotation.order = 'YXZ';
            if (p.rightLeg) p.rightLeg.rotation.order = 'YXZ';
            if (p.leftArm) p.leftArm.rotation.order = 'XYZ';
            if (p.rightArm) p.rightArm.rotation.order = 'XYZ';
            
            // Build Weapon
            let weaponMesh, weaponParts;
            if (typeof weaponDef.buildMesh === 'function') {
                const built = weaponDef.buildMesh();
                weaponMesh = built.mesh;
                weaponParts = built.parts;
                
                // Attach to elbow like remote player
                p.rightArm.userData.elbow.add(weaponMesh);
                
                this.slideMesh = weaponParts.slide;
                this.triggerMesh = weaponParts.trigger;
                this.muzzlePoint = weaponParts.muzzle;
                this.ejectionPoint = weaponParts.ejection;
            }
            
            // Init Animator
            if (window.TacticalShooter.RemotePlayerAnimator) {
                this.fullBodyAnimator = new window.TacticalShooter.RemotePlayerAnimator(
                    this.fullBodyMesh, 
                    this.fullBodyParts, 
                    weaponParts, 
                    weaponMesh, 
                    weaponDef
                );
            }
            
            this.scene.add(this.fullBodyMesh);
            this.fullBodyMesh.visible = true;
        },
        
        triggerFlinch(part) {
            // Apply visual flinch to local body mesh if exists
            if (this.useFullBody && this.fullBodyAnimator) {
                this.fullBodyAnimator.triggerFlinch(part);
            }
        },
        
        update(dt, playerState, characterController, inputManager, isFiring) {
            if (!this.scene) this.scene = window.TacticalShooter.GameManager.scene;
            
            // Shared Logic
            this.checkBarrelObstruction();
            this.updateFlash(dt);
            this.updateWeaponParts(dt, isFiring, playerState);

            // ALWAYS Run FPS Math calculation (updates this.currentPosition, this.recoilImpulse etc)
            this.calculateFPSMath(dt, playerState, characterController, inputManager, isFiring);

            if (this.useFullBody) {
                this.updateFullBody(dt, playerState, characterController, isFiring);
            } else {
                this.applyToFPSHands();
            }
        },
        
        updateFlash(dt) {
            if (this.flashTimer > 0) {
                this.flashTimer -= dt;
                if (this.flashTimer <= 0 && this.muzzleFlashGroup) {
                    this.muzzleFlashGroup.visible = false;
                    this.flashLight.intensity = 0;
                }
            }
        },
        
        updateWeaponParts(dt, isFiring, playerState) {
            // Slide
            if (this.slideMesh) {
                const maxSlideBack = 0.05; 
                let targetSlide = -0.02; // Rest pos

                if (playerState.currentAmmo === 0 || playerState.isReloading) {
                    targetSlide += maxSlideBack;
                }
                
                const slideSpeed = 12.0;
                this.slideOffset = THREE.MathUtils.lerp(this.slideOffset, targetSlide, dt * slideSpeed);
                this.slideMesh.position.z = this.slideOffset;
            }

            // Trigger
            if (this.triggerMesh) {
                const targetRot = isFiring ? 0.6 : 0; 
                const triggerSpeed = isFiring ? 40.0 : 10.0; 
                this.triggerRot = THREE.MathUtils.lerp(this.triggerRot, targetRot, dt * triggerSpeed);
                this.triggerMesh.rotation.x = -this.triggerRot;
            }
        },
        
        updateFullBody(dt, playerState, charController, isFiring) {
            if (!this.fullBodyAnimator || !this.fullBodyMesh) return;
            
            // Map Local State to "Remote" State format
            const pc = window.TacticalShooter.PlayerCamera;
            const velocity = charController.velocity;
            const horizontalSpeed = new THREE.Vector3(velocity.x, 0, velocity.z).length();
            
            // Calculate Derived Stats
            const forward = new THREE.Vector3(); pc.camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(); right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
            
            const fwdSpeed = velocity.dot(forward);
            const strafeSpeed = velocity.dot(right);
            
            const isMoving = horizontalSpeed > 0.1;
            const isSprinting = isMoving && horizontalSpeed > (charController.config.walkSpeed + 1.0);
            const isStrafing = Math.abs(strafeSpeed) > Math.abs(fwdSpeed) && !isSprinting;
            
            const wallDistance = this.isBarrelBlocked ? 0.5 : 999;

            const state = {
                lean: charController.effectiveLean,
                isCrouching: charController.isCrouching,
                isSliding: charController.isSliding,
                isProne: charController.isProne, // Pass Prone
                isSprinting: isSprinting,
                isADS: playerState.isADS,
                currentAmmo: playerState.currentAmmo,
                lookPitch: pc.pitch,
                lookYaw: pc.yaw
            };
            
            const derivedStats = {
                isMoving, isSprinting, isStrafing, isSliding: state.isSliding, isCrouching: state.isCrouching,
                speed: horizontalSpeed,
                strafeSpeed: strafeSpeed,
                wallDistance: wallDistance
            };
            
            // Position Mesh at Feet
            this.fullBodyMesh.position.copy(charController.position);
            // Apply body rotation based on Camera Yaw
            this.fullBodyMesh.rotation.y = pc.yaw;
            
            // --- SYNC WITH FPS CALCULATION ---
            
            // 1. Get Base FPS position/rotation (relative to camera eye)
            const weaponPosLocal = this.currentPosition.clone();
            
            // APPLY SMOOTH BOB (Calculated in calculateFPSMath and stored in this.curBobPos)
            weaponPosLocal.x += this.curBobPos.x;
            weaponPosLocal.y += this.curBobPos.y;
            
            const weaponRotLocal = new THREE.Euler(
                this.currentRotation.x + this.curBobRot.x,
                this.currentRotation.y,
                this.currentRotation.z + this.curBobRot.z
            );
            const weaponQuatLocal = new THREE.Quaternion().setFromEuler(weaponRotLocal);
            
            // 2. Apply recoil offset (translation)
            const recoilPos = new THREE.Vector3(0, 0, this.recoilImpulse.z);
            recoilPos.applyQuaternion(weaponQuatLocal);
            weaponPosLocal.add(recoilPos);
            
            // 3. Apply recoil rotation
            const recoilRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.recoilImpulse.x, 0, this.recoilImpulse.y));
            weaponQuatLocal.multiply(recoilRot);

            // 4. Calculate Absolute World Position/Rotation from Camera
            const worldGunPos = weaponPosLocal.clone().applyMatrix4(this.camera.matrixWorld);
            const worldGunRot = weaponQuatLocal.clone().premultiply(this.camera.quaternion);

            // Update Animator with explicit absolute world transform
            this.fullBodyAnimator.update(dt, state, derivedStats, null, null, worldGunPos, worldGunRot);
        },
        
        calculateFPSMath(dt, playerState, characterController, inputManager, isFiring) {
            const velocity = characterController.velocity;
            const speed = new THREE.Vector3(velocity.x, 0, velocity.z).length();
            const isMoving = speed > 0.1;
            const isSprinting = isMoving && speed > (characterController.config.walkSpeed + 1.0);
            const isSliding = characterController.isSliding;
            
            let targetPos = this.hipVec;
            let targetRot = new THREE.Euler(0, 0, 0); 
            let moveSpeed = 10.0;
            
            if (this.isBarrelBlocked) {
                targetPos = this.blockedVec;
                targetRot = new THREE.Euler(this.visualConfig.blockedRotation.x, this.visualConfig.blockedRotation.y, this.visualConfig.blockedRotation.z);
                moveSpeed = 8.0;
            } else if (isSliding) {
                targetPos = this.hipVec.clone(); 
                targetPos.x = 0.12; 
                targetPos.y = -0.14; 
                targetPos.z = -0.35;
                targetRot = new THREE.Euler(0.05, 0, -0.15); 
                
                if (this.useFullBody) {
                    targetPos.x = 0.0; 
                    targetPos.y = -0.12; 
                    targetPos.z = -0.65; 
                    targetRot = new THREE.Euler(0, 0, 0); 
                }
                
                moveSpeed = 10.0;
            } else if (characterController.isProne) {
                targetPos = new THREE.Vector3(0.0, -0.12, -0.5);
                targetRot = new THREE.Euler(0, 0, 0);
                moveSpeed = 8.0;
            } else if (playerState.isADS) {
                if (isSprinting) {
                    targetPos = this.hipVec.clone(); targetPos.y += 0.04; targetPos.x += 0.05; targetRot = new THREE.Euler(0, 0, 0);
                    moveSpeed = this.visualConfig.adsOutSpeed; 
                } else {
                    targetPos = this.adsVec;
                    moveSpeed = this.visualConfig.adsInSpeed;
                }
            } else if (isSprinting && !playerState.isReloading) {
                moveSpeed = this.visualConfig.sprintTransitionSpeed;
                if (isFiring) {
                    targetPos = this.hipVec; targetRot = new THREE.Euler(-0.1, 0, 0); moveSpeed = 20.0; 
                } else {
                    targetPos = this.sprintVec;
                    targetRot = new THREE.Euler(this.visualConfig.sprintRotation.x, this.visualConfig.sprintRotation.y, this.visualConfig.sprintRotation.z);
                }
            } else if (playerState.isInspecting) {
                this.inspectTime += dt;
                if (this.inspectTime < 2.0) { 
                    targetPos = new THREE.Vector3(0.05, -0.13, -0.32); 
                    targetRot = new THREE.Euler(0.1, 1.2, 0.2); 
                    moveSpeed = 3.0; 
                } else if (this.inspectTime < 4.0) { 
                    targetPos = new THREE.Vector3(-0.02, -0.13, -0.32); 
                    targetRot = new THREE.Euler(0.3, -0.3, 0.9); 
                    moveSpeed = 2.0; 
                } else {
                    targetPos = this.hipVec; 
                    targetRot = new THREE.Euler(0, 0, 0); 
                    moveSpeed = 5.0; 
                }
            } else {
                this.inspectTime = 0; 
                moveSpeed = this.visualConfig.adsOutSpeed;
            }
            
            if (isFiring) moveSpeed = 25.0; 
            
            this.currentPosition.lerp(targetPos, dt * moveSpeed);
            
            this.currentRotation.x = THREE.MathUtils.lerp(this.currentRotation.x, targetRot.x, dt * moveSpeed);
            this.currentRotation.y = THREE.MathUtils.lerp(this.currentRotation.y, targetRot.y, dt * moveSpeed);
            this.currentRotation.z = THREE.MathUtils.lerp(this.currentRotation.z, targetRot.z, dt * moveSpeed);
            
            // --- Bobbing Calculation (With Smoothing) ---
            let targetBobX = 0, targetBobY = 0, targetRotBobX = 0, targetRotBobZ = 0;
            
            if (isMoving && !this.isBarrelBlocked && !playerState.isADS) {
                let bobFreq = isSprinting ? this.visualConfig.sprintBobSpeed : this.visualConfig.walkBobSpeed;
                let bobAmp = isSprinting ? this.visualConfig.sprintBobAmount : this.visualConfig.walkBobAmount;
                if (isSliding) { bobFreq = 18.0; bobAmp = 0.0015; }
                
                this.bobTime += dt * bobFreq;
                targetBobX = Math.cos(this.bobTime) * bobAmp * 0.5;
                targetBobY = -Math.abs(Math.sin(this.bobTime)) * bobAmp;
                
                if (isSprinting) {
                    targetRotBobZ = Math.cos(this.bobTime) * 0.05; 
                    targetRotBobX = Math.sin(this.bobTime * 2) * 0.04;
                } else {
                    targetRotBobZ = Math.cos(this.bobTime) * 0.02;
                }
            } else {
                // Idle breathe
                this.bobTime += dt * 1.0;
                targetBobX = Math.cos(this.bobTime) * 0.0005;
                targetBobY = Math.sin(this.bobTime) * 0.0005;
                // Zero out rot bob
                targetRotBobX = 0;
                targetRotBobZ = 0;
            }
            
            // Smooth Dampening
            const smoothSpeed = 6.0;
            this.curBobPos.x = THREE.MathUtils.lerp(this.curBobPos.x, targetBobX, dt * smoothSpeed);
            this.curBobPos.y = THREE.MathUtils.lerp(this.curBobPos.y, targetBobY, dt * smoothSpeed);
            this.curBobRot.x = THREE.MathUtils.lerp(this.curBobRot.x, targetRotBobX, dt * smoothSpeed);
            this.curBobRot.z = THREE.MathUtils.lerp(this.curBobRot.z, targetRotBobZ, dt * smoothSpeed);

            // Sway
            const mouseDelta = inputManager.getMouseDelta();
            const swayStrength = 0.00015;
            const targetSwayZ = -mouseDelta.x * swayStrength * 10;
            const targetSwayX = -mouseDelta.y * swayStrength * 10;
            const targetSwayY = -mouseDelta.x * swayStrength * 5; 
            
            this.currentRotation.x = THREE.MathUtils.lerp(this.currentRotation.x, this.currentRotation.x + targetSwayX, dt * 10.0);
            this.currentRotation.y = THREE.MathUtils.lerp(this.currentRotation.y, this.currentRotation.y + targetSwayY, dt * 10.0);
            this.currentRotation.z = THREE.MathUtils.lerp(this.currentRotation.z, this.currentRotation.z + targetSwayZ, dt * 10.0);

            // Recoil Update
            const recoverSpeed = 15.0;
            this.recoilImpulse.x = THREE.MathUtils.lerp(this.recoilImpulse.x, 0, dt * recoverSpeed);
            this.recoilImpulse.y = THREE.MathUtils.lerp(this.recoilImpulse.y, 0, dt * recoverSpeed);
            this.recoilImpulse.z = THREE.MathUtils.lerp(this.recoilImpulse.z, 0, dt * recoverSpeed);
        },
        
        applyToFPSHands() {
            if (!this.weaponContainer) return;
            
            // Base transform + Smooth Bob
            this.weaponContainer.position.copy(this.currentPosition);
            this.weaponContainer.position.x += this.curBobPos.x;
            this.weaponContainer.position.y += this.curBobPos.y;
            
            this.weaponContainer.rotation.x = this.currentRotation.x + this.curBobRot.x;
            this.weaponContainer.rotation.y = this.currentRotation.y;
            this.weaponContainer.rotation.z = this.currentRotation.z + this.curBobRot.z;
            
            // Recoil Container
            this.recoilContainer.position.z = this.recoilImpulse.z; 
            this.recoilContainer.rotation.x = this.recoilImpulse.x; 
            this.recoilContainer.rotation.z = this.recoilImpulse.y; 
        },
        
        checkBarrelObstruction() {
            if (!this.scene || !this.camera) return;
            
            const origin = this.camera.position.clone();
            const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            
            this.barrelRaycaster.set(origin, direction);
            this.barrelRaycaster.far = 0.8; 
            
            const collidables = this.scene.children.filter(obj => obj.userData.collidable);
            const hits = this.barrelRaycaster.intersectObjects(collidables, false);
            
            this.isBarrelBlocked = hits.length > 0;
        },
        
        applyRecoil() {
            this.recoilImpulse.z += 0.15;
            this.recoilImpulse.x += 0.1;
            this.recoilImpulse.y += (Math.random() - 0.5) * 0.05;
        },
        
        triggerMuzzleFlash(weaponConfig) {
            this.slideOffset = 0.05; // Kick slide back
            this.ejectShell();

            if (!this.muzzleFlashGroup) return;
            
            const scale = this.visualConfig.muzzleFlashScale || 1.0;
            const baseIntensity = this.visualConfig.muzzleFlashIntensity || 1.0;
            const lightMult = this.muzzleFlashEnabled ? 1.0 : 0.0;

            this.muzzleFlashGroup.visible = true;
            this.flashLight.intensity = 15.0 * baseIntensity * lightMult; 
            if (this.flashMaterial) this.flashMaterial.opacity = 1.0;
            
            if (this.flashMesh) {
                this.flashMesh.rotation.z = Math.random() * Math.PI * 2;
                this.flashMesh.scale.set(scale, scale, scale);
            }
            this.flashTimer = this.visualConfig.muzzleFlashDuration || 0.05;
        },
        
        ejectShell() {
            if (!this.ejectionPoint || !window.TacticalShooter.ParticleManager) return;
            
            const position = new THREE.Vector3();
            this.ejectionPoint.getWorldPosition(position);
            
            const quaternion = new THREE.Quaternion();
            this.ejectionPoint.getWorldQuaternion(quaternion);
            
            const direction = new THREE.Vector3(1.0, 0.5, 0.2).applyQuaternion(quaternion).normalize();
            
            window.TacticalShooter.ParticleManager.createShellCasing(position, direction);
        },
        
        getMuzzleState() {
            if (!this.muzzlePoint) return { position: new THREE.Vector3(), direction: new THREE.Vector3(0,0,-1) };
            
            if (this.useFullBody) {
                if (this.fullBodyMesh) this.fullBodyMesh.updateMatrixWorld(true);
            } else {
                if (this.weaponContainer) this.weaponContainer.updateMatrixWorld(true);
            }
            
            const position = new THREE.Vector3();
            const direction = new THREE.Vector3();
            
            this.muzzlePoint.getWorldPosition(position);
            
            const quaternion = new THREE.Quaternion();
            this.muzzlePoint.getWorldQuaternion(quaternion);
            direction.set(0, 0, -1).applyQuaternion(quaternion).normalize();
            
            return { position, direction };
        },
        
        _buildMuzzleFlash() {
            this.muzzleFlashGroup = new THREE.Group();
            this.muzzlePoint.add(this.muzzleFlashGroup);
            this.muzzleFlashGroup.visible = false;
            
            this.flashLight = new THREE.PointLight(0xffaa33, 0, 10);
            this.muzzleFlashGroup.add(this.flashLight);
            
            const geom = new THREE.PlaneGeometry(0.3, 0.3);
            this.flashMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            
            const plane1 = new THREE.Mesh(geom, this.flashMaterial);
            const plane2 = new THREE.Mesh(geom, this.flashMaterial);
            plane2.rotation.z = Math.PI / 2;
            
            this.flashMesh = new THREE.Group();
            this.flashMesh.add(plane1);
            this.flashMesh.add(plane2);
            
            this.muzzleFlashGroup.add(this.flashMesh);
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.GunRenderer = GunRenderer;
})();
