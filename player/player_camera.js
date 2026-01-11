
// js/player/player_camera.js
(function() {
    const PlayerCamera = {
        camera: null,
        
        // Look rotation
        yaw: 0,
        pitch: 0,
        
        // Recoil state (Permanent offset until compensated)
        recoilPending: { pitch: 0, yaw: 0 },
        
        // Flinch state (Elastic/Temporary offset)
        flinchOffset: { pitch: 0, yaw: 0 },
        
        // State for smoothing angle transition
        currentMaxLeanRoll: Math.PI / 9,
        
        // Full Body offset state
        currentOffsetZ: -0.15,

        // Slide Constraint State
        wasSliding: false,
        slideAnchorYaw: 0,
        
        // Config
        config: {
            mouseSensitivity: 0.002,
            maxPitch: Math.PI / 2 - 0.1,
            
            normalFOV: 75,
            adsFOV: 50,
            slideFOV: 85, // Wider FOV when sliding for speed effect
            fovTransitionSpeed: 10.0,
            
            // Recoil smoothing
            recoilSmoothSpeed: 20.0,
            
            // Flinch recovery
            flinchRecoverySpeed: 10.0,
            
            // Head bob
            bobFrequency: 0.08,
            bobAmplitude: 0.03,
            bobPhase: 0,

            // Lean Angles
            maxLeanRollWall: Math.PI / 4, // 45 Degrees (Deep Peek)
            maxLeanRollOpen: Math.PI / 9, // 20 Degrees (Shallow Lean)
            leanAngleTransitionSpeed: 3.0,
            
            // Slide Camera
            slideRollAngle: -0.05, // Radians to tilt when sliding
            slideLookLimit: 2.1 // ~120 degrees in radians
        },
        
        currentFOV: 75,
        
        init(camera, startRotation) {
            console.log('PlayerCamera: Initializing...');
            
            this.camera = camera;
            
            // Apply start rotation if provided
            if (startRotation) {
                this.yaw = startRotation.y || 0;
                this.pitch = startRotation.x || 0;
            }
            
            this.camera.fov = this.config.normalFOV;
            this.currentFOV = this.config.normalFOV;
            this.currentMaxLeanRoll = this.config.maxLeanRollOpen;
            
            this.camera.near = 0.1;
            this.camera.far = 1000;
            this.camera.updateProjectionMatrix();
            
            console.log('PlayerCamera: ✓ Ready');
        },
        
        setSensitivity(val) {
            this.config.mouseSensitivity = val;
        },
        
        addRecoil(pitch, yaw) {
            // Add to pending queue (Standard recoil)
            this.recoilPending.pitch += pitch;
            this.recoilPending.yaw += yaw;
        },
        
        applyFlinch() {
            // Apply a temporary kick that springs back
            // Reduced amplitude (approx 30% of original intensity)
            const flinchPitch = 0.02 + Math.random() * 0.02;
            const flinchYaw = (Math.random() - 0.5) * 0.05;
            
            // Add to Elastic Offset (This decays to zero)
            this.flinchOffset.pitch += flinchPitch;
            this.flinchOffset.yaw += flinchYaw;
        },
        
        update(dt, inputManager, characterController, playerState) {
            // Stop all camera updates if dead to allow mouse cursor for UI
            if (playerState.isDead) return;

            // Mouse look
            const mouseDelta = inputManager.getMouseDelta();
            
            this.yaw -= mouseDelta.x * this.config.mouseSensitivity;
            this.pitch -= mouseDelta.y * this.config.mouseSensitivity;
            
            // Apply Smooth Recoil (Permanent Change)
            if (Math.abs(this.recoilPending.pitch) > 0.0001 || Math.abs(this.recoilPending.yaw) > 0.0001) {
                // Calculate step
                const pitchStep = this.recoilPending.pitch * dt * this.config.recoilSmoothSpeed;
                const yawStep = this.recoilPending.yaw * dt * this.config.recoilSmoothSpeed;
                
                // Apply to actual camera angles
                this.pitch += pitchStep;
                this.yaw += yawStep;
                
                // Reduce pending
                this.recoilPending.pitch -= pitchStep;
                this.recoilPending.yaw -= yawStep;
            } else {
                this.recoilPending.pitch = 0;
                this.recoilPending.yaw = 0;
            }
            
            // Update Elastic Flinch (Temporary Change)
            // Decay flinch towards zero
            this.flinchOffset.pitch = THREE.MathUtils.lerp(this.flinchOffset.pitch, 0, dt * this.config.flinchRecoverySpeed);
            this.flinchOffset.yaw = THREE.MathUtils.lerp(this.flinchOffset.yaw, 0, dt * this.config.flinchRecoverySpeed);
            
            // --- Sliding Clamp ---
            if (characterController.isSliding) {
                if (!this.wasSliding) {
                    // Lock the yaw at the moment sliding starts as the center point
                    this.slideAnchorYaw = this.yaw;
                    this.wasSliding = true;
                }
                
                // Restrict yaw deviation
                const diff = this.yaw - this.slideAnchorYaw;
                if (diff > this.config.slideLookLimit) {
                    this.yaw = this.slideAnchorYaw + this.config.slideLookLimit;
                } else if (diff < -this.config.slideLookLimit) {
                    this.yaw = this.slideAnchorYaw - this.config.slideLookLimit;
                }
            } else {
                this.wasSliding = false;
            }
            
            // Clamp pitch (Look up/down limits)
            // PRONE CONSTRAINT: Cannot look down too far (-0.2 rads approx 12 deg)
            let minPitch = -this.config.maxPitch;
            if (characterController.isProne) {
                minPitch = -0.25; 
            }
            
            this.pitch = Math.max(minPitch, Math.min(this.config.maxPitch, this.pitch));
            
            // Set camera rotation
            this.camera.rotation.order = 'YXZ';
            // Combine Base Yaw + Elastic Flinch
            this.camera.rotation.y = this.yaw + this.flinchOffset.yaw;
            // Combine Base Pitch + Elastic Flinch
            this.camera.rotation.x = this.pitch + this.flinchOffset.pitch;

            // --- ROLL CALCULATIONS ---
            let targetRoll = 0;
            
            // 1. Leaning Roll
            // Determine target max angle based on support context (Wall vs Open)
            const targetMaxLean = characterController.isSupported ? this.config.maxLeanRollWall : this.config.maxLeanRollOpen;
            
            // Smoothly interpolate the max angle limit
            this.currentMaxLeanRoll = THREE.MathUtils.lerp(this.currentMaxLeanRoll, targetMaxLean, dt * this.config.leanAngleTransitionSpeed);

            if (characterController.effectiveLean) {
                targetRoll = -characterController.effectiveLean * this.currentMaxLeanRoll;
            } 
            // 2. Sliding Roll (Adds tilt based on slide direction or fixed tilt)
            else if (characterController.isSliding) {
                targetRoll = this.config.slideRollAngle;
            }
            
            // Apply accumulated roll
            // Smoothly interpolate current Z to target Z
            this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, targetRoll, dt * 5.0);
            
            // Set camera position (eye position)
            const eyePos = characterController.getEyePosition();
            this.camera.position.copy(eyePos);
            
            // Head bob
            if (characterController.isGrounded && characterController.velocity.length() > 0.1 && !characterController.isSliding) {
                this.config.bobPhase += dt * this.config.bobFrequency * characterController.velocity.length();
                
                const bobY = Math.sin(this.config.bobPhase * 10) * this.config.bobAmplitude;
                const bobX = Math.cos(this.config.bobPhase * 5) * this.config.bobAmplitude * 0.5;
                
                this.camera.position.y += bobY;
                this.camera.position.x += bobX;
            } else {
                this.config.bobPhase = 0;
            }
            
            // Camera Offset for Full Body Mode
            if (window.TacticalShooter.GunRenderer && window.TacticalShooter.GunRenderer.useFullBody) {
                let targetOffset = -0.15; // Default: 15cm forward (Head is hidden now)
                
                // Get Movement Stats for logic
                const forward = this.getForwardDirection();
                forward.y = 0; forward.normalize();
                const vel = characterController.velocity.clone();
                vel.y = 0;
                const speed = vel.length();
                const isMovingFwd = speed > 0.1 && vel.dot(forward) > 0;
                
                const isSprinting = inputManager.isActionActive('Sprint') && isMovingFwd && !characterController.isCrouching && !characterController.isProne;

                if (characterController.isProne) {
                    targetOffset = 0.05; 
                }
                else if (characterController.isSliding) {
                    targetOffset = 0.20; // Sliding: 20cm BACKWARDS (Positive Z) to look like leaning back
                }
                // --- SPRINT OFFSET ---
                else if (isSprinting) {
                    targetOffset = -0.45; // 45cm forward to hide leaning torso
                }
                // If crouching and moving forward (and not sliding)
                else if (characterController.isCrouching && isMovingFwd) {
                    targetOffset = -0.40; // 40cm forward for crouch-walking
                }
                
                // Smooth the transition to prevent popping
                this.currentOffsetZ = THREE.MathUtils.lerp(this.currentOffsetZ, targetOffset, dt * 8.0);
                this.camera.translateZ(this.currentOffsetZ);
            } else {
                // Reset offset if body mode disabled
                this.currentOffsetZ = 0;
            }
            
            // FOV Transition
            let targetFOV = this.config.normalFOV;
            if (playerState.isADS) targetFOV = this.config.adsFOV;
            else if (characterController.isSliding) targetFOV = this.config.slideFOV;
            
            this.currentFOV += (targetFOV - this.currentFOV) * dt * this.config.fovTransitionSpeed;
            this.camera.fov = this.currentFOV;
            this.camera.updateProjectionMatrix();
        },
        
        getForwardDirection() {
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(this.camera.quaternion);
            return direction;
        },
        
        getRightDirection() {
            const direction = new THREE.Vector3(1, 0, 0);
            direction.applyQuaternion(this.camera.quaternion);
            return direction;
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.PlayerCamera = PlayerCamera;
})();
