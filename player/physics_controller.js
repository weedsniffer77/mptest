
// js/player/physics_controller.js
(function() {
    const PhysicsController = {
        raycaster: null,
        horizontalRaycaster: null,
        downVector: null,
        upVector: null,
        
        init() {
            this.raycaster = new THREE.Raycaster();
            this.horizontalRaycaster = new THREE.Raycaster();
            this.downVector = new THREE.Vector3(0, -1, 0);
            this.upVector = new THREE.Vector3(0, 1, 0);
        },

        getCollidables(scene) {
            // Only static objects here. Dynamic players handled explicitly.
            return scene.children.filter(obj => obj.userData.collidable && !obj.userData.type);
        },

        // CORE UPDATE: Sub-stepping logic
        move(position, velocity, radius, height, dt, scene, isCrouching, isSliding) {
            if (!scene) {
                position.add(velocity.clone().multiplyScalar(dt));
                return { position, isGrounded: false, isSupported: false, headOffset: 0 };
            }

            const MAX_STEP = 0.02; 
            let remainingTime = dt;
            
            let result = { isGrounded: false, isSupported: false, headOffset: 0 };
            const MAX_ITERATIONS = 5;
            let iterations = 0;

            while (remainingTime > 0.0001 && iterations < MAX_ITERATIONS) {
                const step = Math.min(remainingTime, MAX_STEP);
                result = this._performMoveStep(position, velocity, radius, height, step, scene, isCrouching, isSliding);
                remainingTime -= step;
                iterations++;
            }
            
            // Failsafe: Depenetration check
            this.resolveDepenetration(position, radius, height, scene);
            
            // Player-Player Collision (Explicit Sphere Check)
            this.resolvePlayerCollisions(position, radius);

            return result;
        },

        _performMoveStep(position, velocity, radius, height, dt, scene, isCrouching, isSliding) {
            const proposedPos = position.clone();
            
            // 1. Horizontal Collision (Walls)
            this.resolveHorizontal(proposedPos, position, velocity, radius, height, dt, scene);
            
            // 2. Ceiling Constraint
            this.resolveCeiling(proposedPos, position, velocity, height, scene);
            
            // 3. Upward Velocity Ceiling Constraint
            if (velocity.y > 0) {
                 this.checkUpwardCollision(proposedPos, velocity, height, dt, scene);
            }

            // 4. Vertical Integration
            proposedPos.y += velocity.y * dt;
            
            // 5. Vertical Collision (Ground)
            const isGrounded = this.resolveVertical(proposedPos, position, velocity, scene);
            
            // 6. Head Clearance
            const headOffset = this.checkHeadClearance(proposedPos, height, scene);
            
            // 7. Wall Support
            const isSupported = this.checkWallSupport(proposedPos, height, scene);

            // Apply final position for this step
            position.copy(proposedPos);
            
            return { isGrounded, isSupported, headOffset };
        },
        
        resolvePlayerCollisions(position, myRadius) {
            if (!window.TacticalShooter.RemotePlayerManager) return;
            
            const players = window.TacticalShooter.RemotePlayerManager.remotePlayers;
            const otherRadius = 0.4; // Approximated radius for other players
            const minDist = myRadius + otherRadius;
            const minDistSq = minDist * minDist;

            for (const id in players) {
                const rp = players[id];
                if (!rp || !rp.mesh) continue;

                // Simple 2D Cylinder Check (XZ plane)
                const dx = position.x - rp.mesh.position.x;
                const dz = position.z - rp.mesh.position.z;
                const distSq = dx*dx + dz*dz;

                // Also check Y height to allow standing on heads or jumping over
                const dy = Math.abs(position.y - rp.mesh.position.y);
                const heightThreshold = 1.5; // Only collide if vertically overlapping

                if (distSq < minDistSq && dy < heightThreshold && distSq > 0.0001) {
                    const dist = Math.sqrt(distSq);
                    const overlap = minDist - dist;
                    
                    // Push vector (Normalized direction from them to me)
                    const pushX = dx / dist;
                    const pushZ = dz / dist;
                    
                    // Apply smooth push-out
                    const correction = Math.min(overlap, 0.1); // Clamp per frame
                    
                    position.x += pushX * correction;
                    position.z += pushZ * correction;
                }
            }
        },

        resolveDepenetration(position, radius, height, scene) {
            const collidables = this.getCollidables(scene);
            const checkPoints = [
                // Raised feet check to 0.25 (Step Height Tolerance) to avoid snagging on pallets/seams
                position.clone().add(new THREE.Vector3(0, 0.25, 0)), 
                position.clone().add(new THREE.Vector3(0, height * 0.5, 0)), // Waist
                position.clone().add(new THREE.Vector3(0, height - 0.1, 0)) // Head
            ];
            
            const directions = [
                new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
            ];
            
            for (const pt of checkPoints) {
                for (const dir of directions) {
                    this.horizontalRaycaster.set(pt, dir);
                    this.horizontalRaycaster.far = radius; 
                    
                    const hits = this.horizontalRaycaster.intersectObjects(collidables, false);
                    if (hits.length > 0) {
                        const hit = hits[0];
                        if (hit.distance < radius - 0.01) {
                            const normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion).normalize();
                            
                            // UPDATED: Only ignore FLOORS (normal.y > 0.5). 
                            // Walls (0) and Ceilings (<0) should still push us out.
                            if (normal.y > 0.5) continue;

                            normal.y = 0; normal.normalize();
                            const penetration = radius - hit.distance;
                            
                            // Push away from wall
                            const pushAmt = Math.min(penetration, 0.1); 
                            const push = normal.multiplyScalar(pushAmt + 0.001);
                            position.add(push);
                        }
                    }
                }
            }
        },
        
        checkJumpClearance(position, currentHeight, scene) {
            const collidables = this.getCollidables(scene);
            this.raycaster.set(position, this.upVector);
            const checkDist = currentHeight + 0.5; 
            this.raycaster.far = checkDist;
            const hits = this.raycaster.intersectObjects(collidables, false);
            return hits.length === 0;
        },
        
        hasHeadroom(position, requiredHeight, scene) {
            const collidables = this.getCollidables(scene);
            const start = position.clone();
            start.y += 0.1;
            this.raycaster.set(start, this.upVector);
            this.raycaster.far = requiredHeight - 0.1; 
            const hits = this.raycaster.intersectObjects(collidables, false);
            return hits.length === 0;
        },
        
        checkUpwardCollision(position, velocity, height, dt, scene) {
            const collidables = this.getCollidables(scene);
            const checkDist = height + (velocity.y * dt) + 0.1;
            this.raycaster.set(position, this.upVector);
            this.raycaster.far = checkDist;
            const hits = this.raycaster.intersectObjects(collidables, false);
            if (hits.length > 0) {
                const hit = hits[0];
                const headroom = hit.distance - height;
                if (headroom <= 0.05) velocity.y = 0;
            }
        },

        resolveHorizontal(proposedPos, currentPos, velocity, radius, height, dt, scene) {
            const collidables = this.getCollidables(scene);
            
            // Only check middle and top. Skip bottom 25% to allow stepping up.
            // Gravity/Vertical resolve will handle the step up.
            const hMid = height * 0.4;
            const hTop = Math.max(0.1, height - 0.1); 
            
            const checkHeights = [hMid, hTop]; 
            
            const iterations = 2; 
            const stepDist = new THREE.Vector3(velocity.x, 0, velocity.z).length() * dt;
            const checkRadius = radius + Math.max(0, stepDist * 1.5); 

            proposedPos.x += velocity.x * dt;
            proposedPos.z += velocity.z * dt;
            
            for (let i = 0; i < iterations; i++) {
                const deltaX = proposedPos.x - currentPos.x;
                const deltaZ = proposedPos.z - currentPos.z;
                if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaZ) < 0.0001) break;
                
                const directions = [
                    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
                    new THREE.Vector3(0.707, 0, 0.707), new THREE.Vector3(-0.707, 0, 0.707),
                    new THREE.Vector3(0.707, 0, -0.707), new THREE.Vector3(-0.707, 0, -0.707)
                ];
                
                let nearestHit = null;
                
                for (let h of checkHeights) {
                    if (h >= height) continue; 
                    
                    const origin = proposedPos.clone();
                    origin.y = currentPos.y + h;
                    
                    for (let dir of directions) {
                        this.horizontalRaycaster.set(origin, dir);
                        this.horizontalRaycaster.far = checkRadius; 
                        const hits = this.horizontalRaycaster.intersectObjects(collidables, false);
                        if (hits.length > 0) {
                            if (!nearestHit || hits[0].distance < nearestHit.distance) {
                                nearestHit = hits[0];
                            }
                        }
                    }
                }
                
                if (nearestHit) {
                    const normal = nearestHit.face.normal.clone().applyQuaternion(nearestHit.object.quaternion).normalize();

                    // UPDATED: Only ignore walkable floors (normal.y > 0.5).
                    // This allows walls AND angled ceilings (like ramp undersides) to block horizontal movement.
                    // This prevents walking into wedges/slopes.
                    if (normal.y > 0.5) {
                         continue;
                    }

                    normal.y = 0; 
                    normal.normalize();

                    if (nearestHit.distance < radius) {
                        let overlap = radius - nearestHit.distance;
                        const MAX_PUSH_PER_STEP = 0.05;
                        const actualPush = Math.min(overlap + 0.001, MAX_PUSH_PER_STEP);
                        const push = normal.clone().multiplyScalar(actualPush);
                        proposedPos.add(push);
                        
                        const velDot = velocity.dot(normal);
                        if (velDot < 0) {
                            velocity.sub(normal.clone().multiplyScalar(velDot));
                        }
                    }
                } else {
                    break;
                }
            }
            
            currentPos.x = proposedPos.x;
            currentPos.z = proposedPos.z;
        },

        resolveCeiling(proposedPos, currentPos, velocity, height, scene) {
            const collidables = this.getCollidables(scene);
            this.raycaster.set(proposedPos, this.upVector);
            this.raycaster.far = height + 0.1; 
            
            const hits = this.raycaster.intersectObjects(collidables, false);
            if (hits.length > 0) {
                proposedPos.x = currentPos.x;
                proposedPos.z = currentPos.z;
                velocity.x = 0;
                velocity.z = 0;
            }
        },

        resolveVertical(proposedPos, currentPos, velocity, scene) {
            const collidables = this.getCollidables(scene);
            const rayOrigin = proposedPos.clone();
            
            // CRITICAL FIX: Start raycast at max step height (0.5) instead of full body height (1.2+).
            // This prevents the ray from starting *above* a ramp/ceiling when the player is underneath it,
            // which caused teleportation to the top surface.
            const stepHeight = 0.5;
            rayOrigin.y = Math.max(proposedPos.y, currentPos.y) + stepHeight;
            
            this.raycaster.set(rayOrigin, this.downVector);
            // Ray length covers step height + gravity/fall
            this.raycaster.far = stepHeight + 2.0; 
            
            const groundHits = this.raycaster.intersectObjects(collidables, false);
            
            if (groundHits.length > 0) {
                const hit = groundHits[0];
                const distToFeet = hit.distance - stepHeight;
                let normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion).normalize();
                
                const up = new THREE.Vector3(0, 1, 0);
                const angle = up.angleTo(normal);
                
                // If angle is too steep (approx 45 deg), it's a wall, not ground.
                if (angle > 0.78) {
                    return false;
                } else {
                    // Increased tolerance from 0.3 to 0.4 to allow climbing slightly taller props
                    if (distToFeet <= 0.4 && velocity.y <= 0.1) {
                        proposedPos.y = hit.point.y; 
                        velocity.y = 0;
                        return true; 
                    } else {
                        return false;
                    }
                }
            } else {
                return false;
            }
        },

        checkHeadClearance(position, height, scene) {
            const collidables = this.getCollidables(scene);
            const eyePos = position.clone();
            eyePos.y += height * 0.9;
            const cam = window.TacticalShooter.PlayerCamera.camera;
            if (!cam) return 0;
            
            const forward = new THREE.Vector3();
            cam.getWorldDirection(forward);
            
            this.horizontalRaycaster.set(eyePos, forward);
            this.horizontalRaycaster.far = 0.75;
            
            const hits = this.horizontalRaycaster.intersectObjects(collidables, false);
            
            if (hits.length > 0) {
                const hit = hits[0];
                const normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion).normalize();
                if (normal.y < -0.4) {
                    const dist = hit.distance;
                    const penetration = 0.75 - dist;
                    const maxDip = height * 0.4;
                    return -Math.min(maxDip, penetration * 2.0);
                }
            }
            return 0;
        },

        checkWallSupport(position, height, scene) {
            const collidables = this.getCollidables(scene);
            const eyePos = position.clone();
            eyePos.y += height * 0.8;
            const cam = window.TacticalShooter.PlayerCamera.camera;
            if (!cam) return false;
            
            const forward = new THREE.Vector3();
            cam.getWorldDirection(forward);
            forward.y = 0; forward.normalize();

            this.horizontalRaycaster.set(eyePos, forward);
            this.horizontalRaycaster.far = 1.2;
            
            const hits = this.horizontalRaycaster.intersectObjects(collidables, false);
            return hits.length > 0;
        },
        
        getLeanOffset(position, height, leanFactor, maxDist, scene, rightVector) {
            if (Math.abs(leanFactor) < 0.01) return { offset: new THREE.Vector3(), effective: 0 };
            const collidables = this.getCollidables(scene);
            const headPos = position.clone();
            headPos.y += height * 0.9;
            const leanSign = Math.sign(leanFactor);
            const leanDir = rightVector.clone().multiplyScalar(leanSign);
            const targetDist = Math.abs(leanFactor) * maxDist;
            this.horizontalRaycaster.set(headPos, leanDir);
            this.horizontalRaycaster.far = targetDist + 0.2; 
            const hits = this.horizontalRaycaster.intersectObjects(collidables, false);
            let actualDist = targetDist;
            if (hits.length > 0) actualDist = Math.max(0, hits[0].distance - 0.2);
            const effective = (actualDist / maxDist) * leanSign;
            const offset = leanDir.multiplyScalar(actualDist);
            return { offset, effective };
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.PhysicsController = PhysicsController;
})();
