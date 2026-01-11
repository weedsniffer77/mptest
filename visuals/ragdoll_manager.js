
// js/visual/ragdoll_manager.js
(function() {
    // --- CANNON.JS RAGDOLL SYSTEM ---
    const RagdollManager = {
        scene: null,
        world: null,
        ragdolls: [],
        
        // Materials
        matGround: null,
        matBody: null,
        
        init(scene) {
            console.log("RagdollManager: Initializing Cannon.js System...");
            this.scene = scene;
            
            if (typeof CANNON === 'undefined') {
                console.error("RagdollManager: Cannon.js not loaded!");
                return;
            }

            // 1. Init World
            this.world = new CANNON.World();
            this.world.gravity.set(0, -15.0, 0); // Good gravity for weight
            this.world.broadphase = new CANNON.NaiveBroadphase();
            this.world.solver.iterations = 20; 
            this.world.solver.tolerance = 0.001;

            // 2. Materials
            this.matGround = new CANNON.Material();
            this.matBody = new CANNON.Material();
            
            const contactMat = new CANNON.ContactMaterial(this.matGround, this.matBody, {
                friction: 0.8,    // Increased friction against ground
                restitution: 0.0  
            });
            this.world.addContactMaterial(contactMat);

            // 3. Static Environment (Floor)
            const groundShape = new CANNON.Plane();
            const groundBody = new CANNON.Body({ mass: 0, material: this.matGround });
            groundBody.addShape(groundShape);
            groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.world.addBody(groundBody);
            
            // 4. Scan Map
            this.scanStaticGeometry();
        },
        
        scanStaticGeometry() {
            if (!this.scene) return;
            
            this.scene.traverse(obj => {
                if (obj.userData.collidable && obj.isMesh && !obj.userData.type) {
                    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
                    const bbox = obj.geometry.boundingBox;
                    const size = new THREE.Vector3();
                    bbox.getSize(size);
                    const center = new THREE.Vector3();
                    bbox.getCenter(center);
                    
                    obj.updateMatrixWorld();
                    center.applyMatrix4(obj.matrixWorld);
                    
                    const scale = new THREE.Vector3();
                    scale.setFromMatrixScale(obj.matrixWorld);
                    size.multiply(scale);
                    
                    const halfExtents = new CANNON.Vec3(size.x/2, size.y/2, size.z/2);
                    const shape = new CANNON.Box(halfExtents);
                    const body = new CANNON.Body({ mass: 0, material: this.matGround });
                    body.addShape(shape);
                    body.position.set(center.x, center.y, center.z);
                    body.quaternion.copy(obj.quaternion);
                    
                    this.world.addBody(body);
                }
            });
        },

        spawn(unusedMesh, color, startPos, rotationY, impulse, hitOffset, initialVelocity) {
            if (!this.world || !window.TacticalShooter.PlayerModelBuilder) return;

            const builder = window.TacticalShooter.PlayerModelBuilder;
            const built = builder.build(color || '#555555'); 
            const root = built.mesh;
            const parts = built.parts;
            
            root.position.copy(startPos);
            root.rotation.y = rotationY;
            root.updateMatrixWorld(true);
            
            const bodies = {};
            const meshes = {};
            const constraints = [];
            
            const momentum = new CANNON.Vec3(0, 0, 0);
            if (initialVelocity) {
                momentum.set(initialVelocity.x * 0.5, initialVelocity.y * 0.5, initialVelocity.z * 0.5);
            }

            // Helper: Create Body & Detach Mesh
            const createPart = (name, mesh, size, mass, shapeType = 'box') => {
                const pos = new THREE.Vector3();
                const quat = new THREE.Quaternion();
                mesh.getWorldPosition(pos);
                mesh.getWorldQuaternion(quat);
                
                if(mesh.parent) mesh.parent.remove(mesh);
                this.scene.add(mesh);
                
                mesh.visible = true; 
                mesh.frustumCulled = false;
                
                let shape;
                if (shapeType === 'box') {
                    shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
                } else if (shapeType === 'sphere') {
                    shape = new CANNON.Sphere(size.x); 
                } else {
                    shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
                }
                
                const body = new CANNON.Body({ mass: mass, material: this.matBody });
                body.addShape(shape);
                body.position.set(pos.x, pos.y, pos.z);
                body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
                
                body.velocity.copy(momentum);

                // HIGH DAMPING prevents wild swinging and makes limbs settle faster
                body.linearDamping = 0.5;  
                body.angularDamping = 0.5; 

                this.world.addBody(body);
                
                bodies[name] = body;
                meshes[name] = mesh;
                
                return body;
            };
            
            // --- PARTS ---
            
            // 1. Hips (Root)
            const hips = createPart('hips', parts.legs, {x:0.28, y:0.15, z:0.2}, 15);
            
            // 2. Torso
            const torsoMesh = parts.torso.children.find(c => c.isMesh) || parts.torso;
            const torso = createPart('torso', torsoMesh, {x:0.3, y:0.35, z:0.22}, 20);
            
            // 3. Head
            const headMesh = parts.head.children.find(c => c.isMesh) || parts.head;
            const head = createPart('head', headMesh, {x:0.15}, 5, 'sphere');
            
            // 4. Arms
            const lArm = createPart('lArm', parts.leftArm.children[0], {x:0.1, y:0.28, z:0.1}, 5); 
            const rArm = createPart('rArm', parts.rightArm.children[0], {x:0.1, y:0.28, z:0.1}, 5);
            
            const lForeMesh = parts.leftArm.userData.elbow.children[0];
            const rForeMesh = parts.rightArm.userData.elbow.children[0];
            const lFore = createPart('lFore', lForeMesh, {x:0.09, y:0.28, z:0.09}, 3);
            const rFore = createPart('rFore', rForeMesh, {x:0.09, y:0.28, z:0.09}, 3);
            
            // 5. Legs
            const lLegMesh = parts.leftLeg.children[0]; 
            const rLegMesh = parts.rightLeg.children[0];
            const lLeg = createPart('lLeg', lLegMesh, {x:0.14, y:0.38, z:0.14}, 8);
            const rLeg = createPart('rLeg', rLegMesh, {x:0.14, y:0.38, z:0.14}, 8);
            
            const lShinMesh = parts.leftLeg.userData.knee.children[0];
            const rShinMesh = parts.rightLeg.userData.knee.children[0];
            const lShin = createPart('lShin', lShinMesh, {x:0.12, y:0.38, z:0.12}, 5);
            const rShin = createPart('rShin', rShinMesh, {x:0.12, y:0.38, z:0.12}, 5);

            // --- CONSTRAINTS ---
            const addJoint = (bodyA, bodyB, pivotA, pivotB, axisA, axisB, type='cone', options={}) => {
                let c;
                if (type === 'cone') {
                    const limit = options.angle || 0.5;
                    const twist = options.twistAngle !== undefined ? options.twistAngle : 0.3;
                    c = new CANNON.ConeTwistConstraint(bodyA, bodyB, {
                        pivotA: new CANNON.Vec3(pivotA.x, pivotA.y, pivotA.z),
                        pivotB: new CANNON.Vec3(pivotB.x, pivotB.y, pivotB.z),
                        axisA: new CANNON.Vec3(axisA.x, axisA.y, axisA.z),
                        axisB: new CANNON.Vec3(axisB.x, axisB.y, axisB.z),
                        angle: limit,
                        twistAngle: twist
                    });
                } else if (type === 'hinge') {
                    c = new CANNON.HingeConstraint(bodyA, bodyB, {
                        pivotA: new CANNON.Vec3(pivotA.x, pivotA.y, pivotA.z),
                        pivotB: new CANNON.Vec3(pivotB.x, pivotB.y, pivotB.z),
                        axisA: new CANNON.Vec3(axisA.x, axisA.y, axisA.z),
                        axisB: new CANNON.Vec3(axisB.x, axisB.y, axisB.z),
                        collideConnected: false
                    });
                    if (options.min !== undefined) c.lowerLimit = options.min;
                    if (options.max !== undefined) c.upperLimit = options.max;
                }
                
                c.collideConnected = false;
                this.world.addConstraint(c);
                constraints.push(c);
            };

            // Spine
            addJoint(hips, torso, {x:0, y:0.1, z:0}, {x:0, y:-0.22, z:0}, {x:0, y:1, z:0}, {x:0, y:-1, z:0}, 'cone', {angle: 0.1});
            
            // Neck - HINGE X - Pitch control to prevent snapping back
            addJoint(torso, head, 
                {x:0, y:0.20, z:0}, 
                {x:0, y:-0.20, z:0}, 
                {x:1, y:0, z:0}, 
                {x:1, y:0, z:0}, 
                'hinge', 
                {min: -0.5, max: 0.1}
            );
            
            // Shoulders
            addJoint(torso, lArm, {x:-0.2, y:0.2, z:0}, {x:0, y:0.18, z:0}, {x:-1, y:0, z:0}, {x:0, y:1, z:0}, 'cone', {angle: 0.8});
            addJoint(torso, rArm, {x:0.2, y:0.2, z:0},  {x:0, y:0.18, z:0}, {x:1, y:0, z:0},  {x:0, y:1, z:0}, 'cone', {angle: 0.8});
            
            // Elbows
            addJoint(lArm, lFore, {x:0, y:-0.18, z:0}, {x:0, y:0.16, z:0}, {x:1, y:0, z:0}, {x:1, y:0, z:0}, 'hinge', {min: -0.1, max: 2.0});
            addJoint(rArm, rFore, {x:0, y:-0.18, z:0}, {x:0, y:0.16, z:0}, {x:1, y:0, z:0}, {x:1, y:0, z:0}, 'hinge', {min: -0.1, max: 2.0});
            
            // Hips - TIGHTENED to prevent leg swinging
            // Reduced angle from 0.2 to 0.05
            addJoint(hips, lLeg, {x:-0.1, y:-0.1, z:0}, {x:0, y:0.22, z:0}, {x:0, y:-1, z:0}, {x:0, y:1, z:0}, 'cone', {angle: 0.05, twistAngle: 0.05});
            addJoint(hips, rLeg, {x:0.1, y:-0.1, z:0},  {x:0, y:0.22, z:0}, {x:0, y:-1, z:0}, {x:0, y:1, z:0}, 'cone', {angle: 0.05, twistAngle: 0.05});
            
            // Knees
            addJoint(lLeg, lShin, {x:0, y:-0.22, z:0}, {x:0, y:0.22, z:0}, {x:1, y:0, z:0}, {x:1, y:0, z:0}, 'hinge', {min: -2.0, max: 0.1});
            addJoint(rLeg, rShin, {x:0, y:-0.22, z:0}, {x:0, y:0.22, z:0}, {x:1, y:0, z:0}, {x:1, y:0, z:0}, 'hinge', {min: -2.0, max: 0.1});

            // --- FORCE APPLICATION ---
            if (impulse) {
                let impactBody = torso;
                let impactPoint = torso.position.clone();

                if (hitOffset) {
                    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), rotationY);
                    const localOffset = hitOffset.clone().applyQuaternion(q);
                    const worldHitPos = startPos.clone().add(new THREE.Vector3(0, 0.9, 0)).add(localOffset);
                    
                    let minDist = Infinity;
                    const checkPoint = new CANNON.Vec3(worldHitPos.x, worldHitPos.y, worldHitPos.z);
                    
                    for (const key in bodies) {
                        const b = bodies[key];
                        const dist = b.position.distanceTo(checkPoint);
                        if (dist < minDist) {
                            minDist = dist;
                            impactBody = b;
                        }
                    }
                    impactPoint = checkPoint;
                }

                const strength = 20.0; 
                const ix = Math.max(-1, Math.min(1, impulse.x));
                const iy = Math.max(-1, Math.min(1, impulse.y));
                const iz = Math.max(-1, Math.min(1, impulse.z));
                
                const force = new CANNON.Vec3(ix * strength, iy * strength, iz * strength);
                impactBody.applyImpulse(force, impactPoint);
            }

            this.ragdolls.push({
                bodies: bodies,
                meshes: meshes,
                constraints: constraints,
                life: 10.0
            });
        },

        update(dt) {
            if (!this.world) return;
            this.world.step(Math.min(dt, 0.1));
            
            for (let i = this.ragdolls.length - 1; i >= 0; i--) {
                const rd = this.ragdolls[i];
                rd.life -= dt;
                
                if (rd.life <= 0) {
                    this.disposeRagdoll(rd);
                    this.ragdolls.splice(i, 1);
                    continue;
                }
                
                for (const name in rd.bodies) {
                    const b = rd.bodies[name];
                    const m = rd.meshes[name];
                    if (b && m) {
                        m.position.copy(b.position);
                        m.quaternion.copy(b.quaternion);
                    }
                }
            }
        },

        disposeRagdoll(rd) {
            for (const name in rd.bodies) {
                this.world.removeBody(rd.bodies[name]);
            }
            for (const name in rd.meshes) {
                const m = rd.meshes[name];
                this.scene.remove(m);
                if (m.geometry) m.geometry.dispose();
            }
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.RagdollManager = RagdollManager;
})();
