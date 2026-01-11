
// js/player/character_controller.js
(function() {
    const CharacterController = {
        position: null,
        velocity: null,
        
        config: {
            walkSpeed: 6.0,
            sprintSpeed: 10.0,
            crouchSpeed: 3.0,
            proneSpeed: 1.5, // Slightly faster prone to avoid feeling stuck
            adsSpeed: 3.0,
            
            jumpForce: 9.5, // Increased from 8.0 to allow clearing 1.5m obstacles
            gravity: -25.0,
            
            standingHeight: 1.85, 
            crouchHeight: 0.9,
            slideHeight: 0.7, 
            proneHeight: 0.4, 
            radius: 0.4,          
            
            acceleration: 30.0,
            friction: 12.0,
            airControl: 0.2,

            leanMaxDistance: 0.6, 
            leanSmoothing: 4.0,

            slideSpeedThreshold: 5.5, 
            slideForce: 12.0,         
            slideFriction: 1.5,       
            slideDuration: 1.2,       
            slideCooldown: 0.5        
        },
        
        isGrounded: false,
        isCrouching: false,
        isProne: false, 
        forcedProne: false, // Track if prone was involuntary (crushed/slide-stuck)
        isSliding: false,
        
        currentHeight: 1.85,
        targetHeight: 1.85,
        
        headOffset: 0, 
        leanFactor: 0, 
        effectiveLean: 0, 
        leanOffset: null, 
        isSupported: false, 
        
        slideTimer: 0,
        slideCooldownTimer: 0,
        slideDirection: null,
        
        init(startPosition) {
            this.position = startPosition.clone();
            this.velocity = new THREE.Vector3();
            this.currentHeight = this.config.standingHeight;
            this.targetHeight = this.config.standingHeight;
            
            this.leanOffset = new THREE.Vector3();
            this.slideDirection = new THREE.Vector3();
            
            this.forcedProne = false;
            this.isProne = false;
            this.isCrouching = false;
            this.isSliding = false;
            
            // Initialize Physics Sub-system
            if (window.TacticalShooter.PhysicsController) {
                window.TacticalShooter.PhysicsController.init();
            }
        },
        
        applyImpulse(vector) {
            // Adds immediate velocity
            this.velocity.add(vector);
        },
        
        update(dt, inputManager, playerState, scene) {
            if (this.slideCooldownTimer > 0) this.slideCooldownTimer -= dt;
            
            const camera = window.TacticalShooter.PlayerCamera.camera;
            
            // 1. Input Processing
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0; forward.normalize();
            
            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
            
            const wishDir = new THREE.Vector3();
            if (inputManager.isActionActive('Forward')) wishDir.add(forward);
            if (inputManager.isActionActive('Backward')) wishDir.sub(forward);
            if (inputManager.isActionActive('Left')) wishDir.sub(right);
            if (inputManager.isActionActive('Right')) wishDir.add(right);
            if (wishDir.length() > 0) wishDir.normalize();

            const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
            const currentSpeed = horizontalVelocity.length();
            
            const isCrouchHeld = inputManager.isActionActive('Crouch');
            const isPronePressed = inputManager.wasActionJustPressed('Prone');

            // 2. State Management (Slide/Crouch/Prone)
            this.updateStance(dt, isCrouchHeld, isPronePressed, currentSpeed, horizontalVelocity, inputManager, scene, forward);
            
            // 3. Velocity Calculation
            this.updateVelocity(dt, wishDir, playerState, forward, inputManager, scene);
            
            // 4. Physics Integration via PhysicsController
            if (window.TacticalShooter.PhysicsController) {
                const result = window.TacticalShooter.PhysicsController.move(
                    this.position, 
                    this.velocity, 
                    this.config.radius, 
                    this.currentHeight, 
                    dt, 
                    scene,
                    this.isCrouching,
                    this.isSliding
                );
                
                this.isGrounded = result.isGrounded;
                this.isSupported = result.isSupported;
                
                this.headOffset = THREE.MathUtils.lerp(this.headOffset, result.headOffset, 0.2);
                
                // Update Lean
                const leanInput = (inputManager.isActionActive('LeanRight') ? 1 : 0) - (inputManager.isActionActive('LeanLeft') ? 1 : 0);
                this.leanFactor += (leanInput - this.leanFactor) * dt * this.config.leanSmoothing;
                
                const leanData = window.TacticalShooter.PhysicsController.getLeanOffset(
                    this.position, 
                    this.currentHeight + this.headOffset, 
                    this.leanFactor, 
                    this.config.leanMaxDistance, 
                    scene, 
                    right
                );
                this.leanOffset.copy(leanData.offset);
                this.effectiveLean = leanData.effective;
            }
            
            // Kill floor
            if (this.position.y < -50) {
                this.position.set(0, 10, 0);
                this.velocity.set(0, 0, 0);
            }
            
            return this.position;
        },
        
        updateStance(dt, isCrouchHeld, isPronePressed, currentSpeed, horizontalVelocity, inputManager, scene, forwardDir) {
            const pc = window.TacticalShooter.PhysicsController;
            const hasHeadroomForStand = pc ? pc.hasHeadroom(this.position, this.config.standingHeight, scene) : true;
            const hasHeadroomForCrouch = pc ? pc.hasHeadroom(this.position, this.config.crouchHeight, scene) : true;

            // --- PRONE TOGGLE ---
            if (isPronePressed && this.isGrounded && !this.isSliding) {
                this.isProne = !this.isProne;
                this.forcedProne = false; // Manual input always clears forced state
                if (this.isProne) {
                    this.isCrouching = false;
                } else {
                    // Try to stand/uncrouch
                    if (!hasHeadroomForStand) {
                        if (hasHeadroomForCrouch) {
                            this.isCrouching = true;
                            this.isProne = false;
                        } else {
                            this.isProne = true; // Blocked
                        }
                    } else {
                        this.isProne = false;
                        this.isCrouching = false;
                    }
                }
            }

            // --- SLIDE LOGIC ---
            let attemptSlide = false;
            const isSprinting = inputManager.isActionActive('Sprint');
            
            // Check direction
            let isMovingForward = false;
            if (currentSpeed > 0.1 && forwardDir) {
                const moveDir = horizontalVelocity.clone().normalize();
                if (moveDir.dot(forwardDir) > 0.1) isMovingForward = true;
            }

            if (isCrouchHeld && !this.isSliding && !this.isProne && this.slideCooldownTimer <= 0) {
                if (this.isGrounded && isSprinting && currentSpeed > this.config.slideSpeedThreshold && isMovingForward) {
                    attemptSlide = true;
                }
            }

            if (attemptSlide) {
                this.isSliding = true;
                this.isCrouching = false; // CRITICAL: Force false immediately
                this.isProne = false;
                this.forcedProne = false;
                this.slideTimer = this.config.slideDuration;
                this.slideDirection.copy(horizontalVelocity.normalize());
                this.velocity.x += this.slideDirection.x * 2.0;
                this.velocity.z += this.slideDirection.z * 2.0;
                this.targetHeight = this.config.slideHeight; // Set height target immediately
            }

            if (this.isSliding) {
                this.slideTimer -= dt;
                
                // Force flags off during slide
                this.isCrouching = false; 
                this.isProne = false;
                
                // Jump Cancel
                if (inputManager.isActionActive('Jump')) {
                    if (hasHeadroomForStand) {
                        this.velocity.y = this.config.jumpForce;
                        this.isGrounded = false;
                        this.position.y += 0.1;
                        this.isSliding = false;
                        this.slideCooldownTimer = 0; 
                        this.isCrouching = false;
                        this.isProne = false;
                    }
                }
                // Slide Ended
                else if (this.slideTimer <= 0 || currentSpeed < 1.0 || !isCrouchHeld) {
                    this.isSliding = false;
                    this.slideCooldownTimer = this.config.slideCooldown;
                    
                    // Force prone if ceiling is too low for crouch
                    if (!hasHeadroomForCrouch) {
                        this.isProne = true;
                        this.forcedProne = true; // Mark as forced prone (involuntarily stuck)
                        this.isCrouching = false;
                    } else if (isCrouchHeld || !hasHeadroomForStand) {
                        this.isCrouching = true;
                        this.isProne = false;
                    } else {
                        this.isCrouching = false;
                        this.isProne = false;
                    }
                } 
                else {
                    this.targetHeight = this.config.slideHeight;
                }
            } 
            else {
                // --- NORMAL STANCE ---
                if (this.isProne) {
                    this.targetHeight = this.config.proneHeight;
                    this.isCrouching = false;
                    
                    // Check Forced Prone Recovery
                    if (this.forcedProne) {
                        if (isCrouchHeld && hasHeadroomForCrouch) {
                            this.isProne = false;
                            this.forcedProne = false;
                            this.isCrouching = true;
                        } else if (!isCrouchHeld && hasHeadroomForStand) {
                            this.isProne = false;
                            this.forcedProne = false;
                            this.isCrouching = false;
                        }
                    }
                    
                    if (inputManager.wasActionJustPressed('Jump')) {
                         if (hasHeadroomForStand) {
                             this.isProne = false;
                             this.forcedProne = false;
                         }
                         else if (hasHeadroomForCrouch) { 
                             this.isProne = false; 
                             this.forcedProne = false;
                             this.isCrouching = true; 
                         }
                    }
                } 
                else if (isCrouchHeld) {
                    this.isCrouching = true;
                    this.targetHeight = this.config.crouchHeight;
                } 
                else {
                    if (hasHeadroomForStand) {
                        this.isCrouching = false;
                        this.targetHeight = this.config.standingHeight;
                    } else if (hasHeadroomForCrouch) {
                        this.isCrouching = true;
                        this.targetHeight = this.config.crouchHeight;
                    } else {
                        // Forced prone if crushed/stuck
                        if (!this.isProne) this.forcedProne = true; // Entering forced prone
                        this.isProne = true;
                        this.targetHeight = this.config.proneHeight;
                    }
                }
            }

            // Lerp Height
            let speed = 10.0;
            
            if (this.isSliding) {
                speed = 15.0; // Fast drop for slide
            } else if (this.isProne || this.targetHeight === this.config.proneHeight) {
                // Transitioning into or out of prone
                speed = 4.0; 
            } else if (!this.isGrounded) {
                speed = 15.0; // Fast response in air for tucking legs
            }
            
            this.currentHeight += (this.targetHeight - this.currentHeight) * dt * speed;
        },
        
        updateVelocity(dt, wishDir, playerState, forward, inputManager, scene) {
            if (this.isSliding) {
                const friction = this.config.slideFriction * dt;
                this.velocity.x *= Math.max(0, 1 - friction);
                this.velocity.z *= Math.max(0, 1 - friction);
                const steerForce = 5.0 * dt;
                this.velocity.x += wishDir.x * steerForce;
                this.velocity.z += wishDir.z * steerForce;
            } else {
                let targetSpeed = this.config.walkSpeed;
                const weapon = window.TacticalShooter.WeaponManager ? window.TacticalShooter.WeaponManager.currentWeapon : null;
                const sprintMult = (weapon && weapon.sprintMultiplier) ? weapon.sprintMultiplier : 1.0;
                
                const isMovingForward = wishDir.length() > 0 && wishDir.dot(forward) > 0.5;
                const isSprintingInput = inputManager.isActionActive('Sprint');
                const isLeaning = Math.abs(this.leanFactor) > 0.1;

                // Determine Target Speed based on Stance
                if (this.isProne) targetSpeed = this.config.proneSpeed;
                else if (this.isCrouching) targetSpeed = this.config.crouchSpeed;
                else if (isSprintingInput) {
                    if (isMovingForward) targetSpeed = this.config.sprintSpeed * sprintMult;
                    else targetSpeed = this.config.walkSpeed;
                }
                else if (isLeaning) targetSpeed = this.config.walkSpeed * 0.8;
                else if (playerState.isADS) targetSpeed = this.config.adsSpeed;
                else targetSpeed = isMovingForward ? this.config.walkSpeed : this.config.walkSpeed * 0.7;

                // --- AIR MOVEMENT FIX ---
                if (!this.isGrounded) {
                    const currentHorzSpeed = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).length();
                    if (currentHorzSpeed > targetSpeed) {
                        targetSpeed = currentHorzSpeed; // Sustain momentum
                    }
                }

                const targetVelocity = wishDir.multiplyScalar(targetSpeed);
                
                if (this.isGrounded) {
                    const accel = this.config.acceleration * dt;
                    this.velocity.x += (targetVelocity.x - this.velocity.x) * Math.min(1, accel);
                    this.velocity.z += (targetVelocity.z - this.velocity.z) * Math.min(1, accel);
                    
                    if (wishDir.length() === 0) {
                        const friction = this.config.friction * dt;
                        this.velocity.x *= Math.max(0, 1 - friction);
                        this.velocity.z *= Math.max(0, 1 - friction);
                    }
                    
                    if (inputManager.isActionActive('Jump') && !this.isCrouching && !this.isProne) {
                        const canJump = window.TacticalShooter.PhysicsController ? window.TacticalShooter.PhysicsController.checkJumpClearance(this.position, this.currentHeight, scene) : true;
                        if (canJump) {
                            this.velocity.y = this.config.jumpForce;
                            this.isGrounded = false;
                            this.position.y += 0.1;
                        }
                    }
                } else {
                    const airAccel = this.config.acceleration * this.config.airControl * dt;
                    this.velocity.x += (targetVelocity.x - this.velocity.x) * Math.min(1, airAccel);
                    this.velocity.z += (targetVelocity.z - this.velocity.z) * Math.min(1, airAccel);
                }
            }
            this.velocity.y += this.config.gravity * dt;
        },
        
        getEyePosition() {
            let eyeY = this.currentHeight * 0.9;
            
            if (window.TacticalShooter.GunRenderer && 
                window.TacticalShooter.GunRenderer.useFullBody) {
                
                if (this.isProne) {
                    eyeY = 0.3; 
                } else if (this.isCrouching && !this.isSliding) {
                    eyeY = Math.max(eyeY, 1.2); 
                }
                eyeY -= 0.05;
            }

            return new THREE.Vector3(
                this.position.x + this.leanOffset.x,
                this.position.y + eyeY + this.headOffset,
                this.position.z + this.leanOffset.z
            );
        },
        
        getHeight() { return this.currentHeight; }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.CharacterController = CharacterController;
})();
