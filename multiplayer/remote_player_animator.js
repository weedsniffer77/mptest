
// js/multiplayer/remote_player_animator.js
(function() {
    class RemotePlayerAnimator {
        constructor(mesh, parts, weaponParts, weaponMesh, weaponDef) {
            this.mesh = mesh;
            this.parts = parts;
            this.weaponParts = weaponParts;
            this.weaponMesh = weaponMesh; 
            this.weaponDef = weaponDef; 
            
            this.animTime = 0;
            this.bobTime = 0;
            
            // Flinch State
            this.flinch = {
                active: false,
                timer: 0,
                duration: 0.15, // Fast Speed
                part: 'Torso',
                intensity: 0.0,
                randX: 0,
                randY: 0,
                dirZ: -1, // Normal Z (Negative = Front Hit, Positive = Back Hit)
                dirX: 0   // Normal X (Positive = Right Hit, Negative = Left Hit)
            };
            
            this.upperArmLen = 0.35;
            this.lowerArmLen = 0.35;
            
            this.currentGunOffset = new THREE.Vector3(0.2, -0.25, 0.4); 
            this.currentGunRotOffset = new THREE.Quaternion();
            
            this.targets = {
                bodyPos: new THREE.Vector3(),
                torsoRot: new THREE.Euler(),
                headRot: new THREE.Euler(),
                
                leftLeg:  { rot: new THREE.Euler() },
                rightLeg: { rot: new THREE.Euler() },
                leftKnee: { rotX: 0 },
                rightKnee:{ rotX: 0 },
                leftFoot: { rotX: 0 },
                rightFoot:{ rotX: 0 }
            };
        }
        
        triggerFlinch(part, normal) {
            this.flinch.active = true;
            this.flinch.duration = 0.2; // Slightly longer for torque readability
            this.flinch.timer = this.flinch.duration;
            this.flinch.part = part || 'Torso';
            this.flinch.intensity = 4.0; 
            this.flinch.randX = (Math.random() - 0.5) * 2; 
            this.flinch.randY = (Math.random() - 0.5) * 2;
            
            // Calculate Direction relative to Model
            // Normal points OUT of surface.
            if (normal && this.mesh) {
                const localNorm = normal.clone().applyQuaternion(this.mesh.quaternion.clone().invert());
                this.flinch.dirZ = localNorm.z; 
                this.flinch.dirX = localNorm.x; 
            } else {
                this.flinch.dirZ = -1; // Default Front Hit
                this.flinch.dirX = 0;
            }
        }
        
        update(dt, state, derivedStats, manualGunOffset = null, manualGunRot = null, overrideWorldGunPos = null, overrideWorldGunRot = null) {
            if (!this.parts) return;
            
            const { isMoving, isSprinting, speed } = derivedStats;
            const animRate = isSprinting ? (speed * 0.8) : (speed * 1.4);
            this.animTime += dt * animRate;
            
            // Update Flinch
            if (this.flinch.active) {
                this.flinch.timer -= dt;
                if (this.flinch.timer <= 0) {
                    this.flinch.active = false;
                    this.flinch.intensity = 0;
                } else {
                    // Ease out quadratic
                    this.flinch.intensity = Math.pow(this.flinch.timer / this.flinch.duration, 2) * 4.0; 
                }
            }

            // 1. Base Body Animation
            this._updateProceduralMovement(dt, state, derivedStats);
            
            // 2. Head Look
            const targetHeadPitch = state.lookPitch - this.targets.torsoRot.x;
            this.targets.headRot.set(targetHeadPitch, 0, 0);
            
            // --- Apply Flinch Offsets ---
            if (this.flinch.active) {
                const i = this.flinch.intensity;
                const p = this.flinch.part;
                const rx = this.flinch.randX;
                const dz = this.flinch.dirZ; // Norm Z: <0 Front, >0 Back
                const dx = this.flinch.dirX; // Norm X: >0 Right, <0 Left
                
                // TORQUE CALCULATION
                // "Twist away from pain"
                // Front Right Hit (dx>0, dz<0) -> Right shoulder back -> Yaw Negative
                // Back Right Hit (dx>0, dz>0) -> Right shoulder forward -> Yaw Positive
                // Formula: Math.sign(dx * dz) provides correct torque sign
                // + * - = - (Correct)
                // + * + = + (Correct)
                let torqueDir = Math.sign(dx * dz);
                if (Math.abs(dx) < 0.1) torqueDir = Math.sign(rx); // Random if center hit

                if (p === 'Head') {
                    // Head Snap (Front Hit dz<0 -> Snap Back +X)
                    const snapDir = (dz < 0) ? 1 : -1; 
                    
                    this.targets.headRot.x += snapDir * 0.35 * i; 
                    this.targets.headRot.y += 0.3 * torqueDir * i; // Head twists with impact
                    this.targets.torsoRot.x += snapDir * 0.15 * i;
                } 
                else if (p === 'Arm' || p === 'Hand') {
                    // Arm hit twists body
                    this.targets.torsoRot.y += 0.6 * torqueDir * i; 
                    this.targets.torsoRot.z += 0.15 * Math.sign(dx) * i; // Dip shoulder
                } 
                else if (p === 'Leg') {
                    this.targets.bodyPos.y -= 0.15 * i; 
                    this.targets.torsoRot.x += 0.3 * i; // Hunch
                    if (rx > 0) this.targets.rightLeg.rot.x -= 0.8 * i; 
                    else this.targets.leftLeg.rot.x -= 0.8 * i;
                } 
                else {
                    // Torso (Main)
                    this.targets.torsoRot.y += 0.7 * torqueDir * i; // Strong twist
                    this.targets.torsoRot.x += 0.25 * i; // Hunch
                    this.targets.bodyPos.z -= 0.15 * i; // Knockback
                }
            }

            // 3. Apply Base Transforms
            this._applyBaseTransforms(dt, isMoving, state.isSliding);
            
            // 4. Force Matrix Update
            this.mesh.updateMatrixWorld(true);
            
            // 5. IK Solver
            this._updateIKArms(dt, state, derivedStats, manualGunOffset, manualGunRot, overrideWorldGunPos, overrideWorldGunRot);
        }

        _updateProceduralMovement(dt, state, stats) {
            const T = this.targets;
            const t = this.animTime;
            
            T.bodyPos.set(state.lean * 0.25, 0, 0);
            T.torsoRot.set(0, 0, -state.lean * 0.65);
            
            T.leftLeg.rot.set(0,0,0); T.rightLeg.rot.set(0,0,0);
            T.leftKnee.rotX = 0; T.rightKnee.rotX = 0;
            T.leftFoot.rotX = 0; T.rightFoot.rotX = 0;

            if (state.isProne) {
                T.bodyPos.y = -0.9; 
                T.bodyPos.z = 0.55;   
                T.torsoRot.x = -1.2; 
                T.headRot.x = 1.2; 
                T.leftLeg.rot.x = -1.7; 
                T.rightLeg.rot.x = -1.7;
                T.leftFoot.rotX = 0.5;
                T.rightFoot.rotX = 0.5;

                if (stats.isMoving) {
                    const crawlSpeed = t * 1.5;
                    T.bodyPos.x += Math.sin(crawlSpeed) * 0.1;
                    T.torsoRot.z += Math.cos(crawlSpeed) * 0.1;
                    T.leftKnee.rotX = Math.max(0, Math.sin(crawlSpeed)) * 1.5;
                    T.rightKnee.rotX = Math.max(0, Math.sin(crawlSpeed + Math.PI)) * 1.5;
                } else {
                    T.leftLeg.rot.y = -0.15;
                    T.rightLeg.rot.y = 0.15;
                }

            } else if (stats.isSliding) {
                T.bodyPos.y = -0.8; 
                T.bodyPos.z = 0.2;
                T.torsoRot.x = 0.5; 
                
                let yawDiff = state.lookYaw - this.mesh.rotation.y;
                while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
                while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
                T.headRot.y = yawDiff; 

                T.leftLeg.rot.x = 1.57; 
                T.rightLeg.rot.x = 1.9; 
                T.rightKnee.rotX = -1.7; 

            } else if (stats.isCrouching) {
                if (stats.isMoving) {
                    T.bodyPos.y = -0.25;
                    T.torsoRot.x = -0.6; 
                    const strideAmp = 0.6;
                    T.leftLeg.rot.x = 1.1 + Math.sin(t * 1.5) * strideAmp;
                    T.leftKnee.rotX = -1.9 + Math.sin(t * 1.5 - 0.5) * 0.4;
                    T.rightLeg.rot.x = 1.1 + Math.sin(t * 1.5 + Math.PI) * strideAmp;
                    T.rightKnee.rotX = -1.9 + Math.sin(t * 1.5 + Math.PI - 0.5) * 0.4;
                } else {
                    T.bodyPos.y = -0.48;
                    T.torsoRot.x = -0.3;
                    T.leftLeg.rot.x = 1.6; T.leftKnee.rotX = -1.6;
                    T.rightLeg.rot.y = -0.5; T.rightLeg.rot.x = 0.2; T.rightKnee.rotX = -2.0;
                }
            } else if (stats.isMoving) {
                if (stats.isSprinting) {
                    T.torsoRot.x = -0.3; 
                    const spT = this.animTime * 1.5;
                    T.leftLeg.rot.x = Math.sin(spT) * 1.2;
                    T.rightLeg.rot.x = Math.sin(spT + Math.PI) * 1.2;
                    T.leftKnee.rotX = -Math.max(0, Math.sin(spT)*2);
                    T.rightKnee.rotX = -Math.max(0, Math.sin(spT + Math.PI)*2);
                } else {
                    T.leftLeg.rot.x = Math.sin(t) * 0.9;
                    T.rightLeg.rot.x = Math.sin(t + Math.PI) * 0.9;
                    T.leftKnee.rotX = -Math.max(0, Math.sin(t + 0.5)) * 1.2;
                    T.rightKnee.rotX = -Math.max(0, Math.sin(t + 0.5 + Math.PI)) * 1.2;
                }
            } else {
                T.bodyPos.y = Math.sin(this.animTime * 1.5) * 0.005;
                T.leftKnee.rotX = -0.05;
                T.rightKnee.rotX = -0.05;
            }

            if (state.isADS && !stats.isCrouching && !stats.isSliding && !state.isProne) {
                T.torsoRot.x -= 0.3;
            }
        }

        _applyBaseTransforms(dt, isMoving, isSliding) {
            const P = this.parts;
            const T = this.targets;
            
            let smooth = isMoving ? (dt * 25.0) : (dt * 20.0);
            if (Math.abs(P.torso.rotation.x - T.torsoRot.x) > 0.5) smooth = dt * 3.0; 
            if (isSliding) smooth = dt * 40.0;

            const applyRot = (obj, target) => {
                obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, target.x, smooth);
                obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, target.y, smooth);
                obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, target.z, smooth);
            };

            P.bodyGroup.position.x = THREE.MathUtils.lerp(P.bodyGroup.position.x, T.bodyPos.x, smooth);
            P.bodyGroup.position.y = THREE.MathUtils.lerp(P.bodyGroup.position.y, T.bodyPos.y, smooth);
            P.bodyGroup.position.z = THREE.MathUtils.lerp(P.bodyGroup.position.z, T.bodyPos.z, smooth);
            
            P.bodyGroup.rotation.y = THREE.MathUtils.lerp(P.bodyGroup.rotation.y, T.torsoRot.y, smooth);
            
            applyRot(P.torso, T.torsoRot);
            applyRot(P.head, T.headRot);
            applyRot(P.leftLeg, T.leftLeg.rot);
            applyRot(P.rightLeg, T.rightLeg.rot);
            
            P.leftLeg.userData.knee.rotation.x = THREE.MathUtils.lerp(P.leftLeg.userData.knee.rotation.x, T.leftKnee.rotX, smooth);
            P.rightLeg.userData.knee.rotation.x = THREE.MathUtils.lerp(P.rightLeg.userData.knee.rotation.x, T.rightKnee.rotX, smooth);
            
            if (P.leftLeg.userData.knee.userData.foot) {
                P.leftLeg.userData.knee.userData.foot.rotation.x = THREE.MathUtils.lerp(
                    P.leftLeg.userData.knee.userData.foot.rotation.x, T.leftFoot.rotX, smooth
                );
            }
            if (P.rightLeg.userData.knee.userData.foot) {
                P.rightLeg.userData.knee.userData.foot.rotation.x = THREE.MathUtils.lerp(
                    P.rightLeg.userData.knee.userData.foot.rotation.x, T.rightFoot.rotX, smooth
                );
            }
        }

        _updateIKArms(dt, state, stats, manualGunOffset, manualGunRot, overrideWorldGunPos, overrideWorldGunRot) {
            const P = this.parts;
            const headPos = new THREE.Vector3();
            P.head.getWorldPosition(headPos);
            
            let worldGunPos, worldGunRot;

            if (overrideWorldGunPos && overrideWorldGunRot) {
                let handGripOffset = new THREE.Vector3(0,0,0);
                if (this.weaponParts && this.weaponParts.handRight) {
                    handGripOffset.copy(this.weaponParts.handRight.position);
                }
                const rotatedOffset = handGripOffset.clone().applyQuaternion(overrideWorldGunRot);
                worldGunPos = overrideWorldGunPos.clone().add(rotatedOffset);
                worldGunRot = overrideWorldGunRot.clone();
                
            } else {
                let visualPitch = state.lookPitch;
                if (visualPitch > 1.4) visualPitch = 1.4; 
                if (visualPitch < -1.5) visualPitch = -1.5; 
                
                const viewQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(visualPitch, state.lookYaw, 0, 'YXZ'));
                const targetOffset = new THREE.Vector3();
                const targetRotOffset = new THREE.Quaternion(); 

                if (manualGunOffset && manualGunRot) {
                    this.currentGunOffset.lerp(manualGunOffset, dt * 25);
                    this.currentGunRotOffset.slerp(manualGunRot, dt * 25);
                } else {
                    const isBlocked = stats.wallDistance < 0.6;
                    
                    if (isBlocked) {
                        targetOffset.set(0.15, -0.2, -0.25); 
                        const qUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), 1.0);
                        targetRotOffset.copy(qUp);
                    } else if (state.isProne) {
                        targetOffset.set(0.0, -0.08, -0.65); 
                    } else if (stats.isSprinting && !state.isADS && !stats.isSliding) {
                        targetOffset.set(0.25, -0.35, -0.45); 
                        const qDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -0.8);
                        const qIn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), -0.6);
                        targetRotOffset.copy(qIn.multiply(qDown));
                    } else if (state.isADS || stats.isSliding) {
                        targetOffset.set(0.0, -0.165, -0.70); 
                    } else {
                        targetOffset.set(0.2, -0.25, -0.62); 
                    }

                    if (!isBlocked && !state.isProne) {
                        if (visualPitch > 0.5) {
                            const lookDownIntensity = (visualPitch - 0.5);
                            targetOffset.z -= lookDownIntensity * 0.2; 
                            targetOffset.y -= lookDownIntensity * 0.1;
                        }
                        else if (visualPitch < -0.5) {
                            const lookUpIntensity = (Math.abs(visualPitch) - 0.5);
                            targetOffset.z -= lookUpIntensity * 0.2;
                            targetOffset.y += lookUpIntensity * 0.05;
                        }
                    }

                    if (stats.isMoving && !isBlocked && !state.isADS) {
                        const visuals = this.weaponDef ? this.weaponDef.visuals : {};
                        const walkBobSpeed = visuals.walkBobSpeed || 8.0;
                        const walkBobAmount = visuals.walkBobAmount || 0.03;
                        const sprintBobSpeed = visuals.sprintBobSpeed || 13.0;
                        const sprintBobAmount = visuals.sprintBobAmount || 0.025;
                        
                        let bobFreq = stats.isSprinting ? sprintBobSpeed : walkBobSpeed;
                        let bobAmp = stats.isSprinting ? sprintBobAmount : walkBobAmount;
                        if (stats.isSliding) { bobFreq = 18.0; bobAmp = 0.0015; }
                        if (state.isProne) { bobFreq = 4.0; bobAmp = 0.04; }

                        this.bobTime = (this.bobTime || 0) + dt * bobFreq;
                        const bobX = Math.cos(this.bobTime) * bobAmp * 0.5;
                        const bobY = Math.abs(Math.sin(this.bobTime)) * bobAmp;
                        
                        targetOffset.x += bobX;
                        targetOffset.y -= bobY;
                        
                        let rotBobZ = 0;
                        let rotBobX = 0;
                        if (stats.isSprinting) {
                            rotBobZ = Math.cos(this.bobTime) * 0.05; 
                            rotBobX = Math.sin(this.bobTime * 2) * 0.04;
                        } else {
                            rotBobZ = Math.cos(this.bobTime) * 0.02;
                        }
                        
                        const qBob = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotBobX, 0, rotBobZ));
                        targetRotOffset.multiply(qBob);
                    } else {
                        this.bobTime = (this.bobTime || 0) + dt * 1.0;
                        targetOffset.y += Math.sin(this.bobTime * 2.0) * 0.003;
                        targetOffset.x += Math.cos(this.bobTime * 1.5) * 0.002;
                    }

                    this.currentGunOffset.lerp(targetOffset, dt * 10);
                    this.currentGunRotOffset.slerp(targetRotOffset, dt * 10);
                }

                worldGunPos = this.currentGunOffset.clone().applyQuaternion(viewQuat).add(headPos);
                worldGunRot = viewQuat.clone().multiply(this.currentGunRotOffset);
                
                // Add flinch drop to arms
                if (this.flinch.active && (this.flinch.part === 'Arm' || this.flinch.part === 'Hand')) {
                    worldGunPos.y -= 0.6 * this.flinch.intensity; 
                    worldGunPos.x += 0.4 * this.flinch.randX * this.flinch.intensity; 
                }
            }

            const bodyYawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, state.lookYaw, 0, 'YXZ'));
            let rElbowDir = new THREE.Vector3(0.5, -1.0, 0.2).normalize();
            let lElbowDir = new THREE.Vector3(-0.5, -1.0, 0.2).normalize();
            
            if (state.isProne) {
                rElbowDir.set(0.8, -0.2, 0).normalize();
                lElbowDir.set(-0.8, -0.2, 0).normalize();
            }

            const worldRElbowHint = rElbowDir.applyQuaternion(bodyYawQuat).add(headPos);
            const worldLElbowHint = lElbowDir.applyQuaternion(bodyYawQuat).add(headPos);

            const rShoulderPos = new THREE.Vector3();
            P.rightArm.getWorldPosition(rShoulderPos);
            
            this._solveTwoBoneIK(P.rightArm, P.rightArm.userData.elbow, rShoulderPos, worldGunPos, worldRElbowHint);
            P.rightArm.updateMatrixWorld(true);
            
            let leftHandTargetPos = worldGunPos.clone().add(new THREE.Vector3(0, 0.05, -0.25).applyQuaternion(worldGunRot));

            if (this.weaponMesh) {
                let handGripOffset = new THREE.Vector3(0, 0, 0);
                if (this.weaponParts && this.weaponParts.handRight) {
                    handGripOffset.copy(this.weaponParts.handRight.position);
                }

                const wristLocalPos = new THREE.Vector3(0, -this.lowerArmLen, 0);
                const elbowWorldQuat = new THREE.Quaternion();
                P.rightArm.userData.elbow.getWorldQuaternion(elbowWorldQuat);
                const elbowInvQuat = elbowWorldQuat.clone().invert();
                
                const weaponLocalRot = elbowInvQuat.clone().multiply(worldGunRot);
                this.weaponMesh.quaternion.copy(weaponLocalRot);
                
                const rotatedGripOffset = handGripOffset.clone().applyQuaternion(weaponLocalRot);
                this.weaponMesh.position.copy(wristLocalPos).sub(rotatedGripOffset);
                this.weaponMesh.updateMatrixWorld(true);
                
                if (this.weaponParts && this.weaponParts.handLeft) {
                    const handLeftWorld = new THREE.Vector3();
                    this.weaponParts.handLeft.getWorldPosition(handLeftWorld);
                    leftHandTargetPos.copy(handLeftWorld);
                    if (this.weaponDef && this.weaponDef.visuals && this.weaponDef.visuals.leftHandOffset) {
                        const offsetConfig = this.weaponDef.visuals.leftHandOffset;
                        const offsetVec = new THREE.Vector3(offsetConfig.x, offsetConfig.y, offsetConfig.z);
                        offsetVec.applyQuaternion(worldGunRot);
                        leftHandTargetPos.add(offsetVec);
                    }
                }
            }

            const lShoulderPos = new THREE.Vector3();
            P.leftArm.getWorldPosition(lShoulderPos);
            this._solveTwoBoneIK(P.leftArm, P.leftArm.userData.elbow, lShoulderPos, leftHandTargetPos, worldLElbowHint);
        }

        _solveTwoBoneIK(bone1, bone2, rootPos, targetPos, hintPos) {
            const l1 = this.upperArmLen;
            const l2 = this.lowerArmLen;
            const dir = new THREE.Vector3().subVectors(targetPos, rootPos);
            const dist = dir.length();
            const maxReach = (l1 + l2) * 0.999;
            if (dist > maxReach) dir.normalize().multiplyScalar(maxReach);
            
            const distSq = dir.lengthSq();
            const cos1 = (distSq + l1*l1 - l2*l2) / (2 * Math.sqrt(distSq) * l1);
            const angle1 = Math.acos(Math.min(1, Math.max(-1, cos1)));
            const cos2 = (l1*l1 + l2*l2 - distSq) / (2 * l1 * l2);
            const angle2 = Math.acos(Math.min(1, Math.max(-1, cos2)));
            
            const targetDir = dir.clone().normalize();
            const boneAxis = new THREE.Vector3(0, -1, 0); 
            const qBase = new THREE.Quaternion().setFromUnitVectors(boneAxis, targetDir);
            
            const hintVec = new THREE.Vector3().subVectors(hintPos, rootPos);
            const planeNormal = new THREE.Vector3().crossVectors(targetDir, hintVec).normalize();
            
            const m = new THREE.Matrix4();
            const axisY = targetDir.clone().negate(); 
            const axisX = planeNormal.clone(); 
            const axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();
            m.makeBasis(axisX, axisY, axisZ);
            const qOrient = new THREE.Quaternion().setFromRotationMatrix(m);
            
            const qBend = new THREE.Quaternion().setFromAxisAngle(axisX, angle1);
            const qUpperWorld = qBend.multiply(qOrient);
            
            if (bone1.parent) {
                const parentInv = bone1.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
                bone1.quaternion.copy(parentInv.multiply(qUpperWorld));
            } else {
                bone1.quaternion.copy(qUpperWorld);
            }
            
            const bendAngle = -(Math.PI - angle2);
            bone2.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), bendAngle);
        }
    }

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.RemotePlayerAnimator = RemotePlayerAnimator;
})();
