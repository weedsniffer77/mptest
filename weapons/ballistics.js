
// js/weapons/ballistics.js
(function() {
    const Ballistics = {
        raycaster: null,
        scene: null,
        
        init(scene) {
            console.log('Ballistics: Initializing...');
            this.scene = scene;
            this.raycaster = new THREE.Raycaster();
            console.log('Ballistics: ✓ Ready');
        },
        
        // NEW: Zeroing Helper
        getCrosshairTarget(camera, maxDistance) {
            // Raycast from center of screen (0,0 NDC)
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            this.raycaster.far = maxDistance;
            
            const potentialTargets = [];
            this.scene.traverse((object) => {
                // Hit anything solid that blocks bullets
                if (object.isMesh && object.userData.collidable === true && !object.userData.bulletTransparent) {
                    potentialTargets.push(object);
                }
            });
            
            const intersects = this.raycaster.intersectObjects(potentialTargets, false);
            
            if (intersects.length > 0) {
                return intersects[0].point;
            }
            
            // If nothing hit, return point at max range along camera forward vector
            const target = new THREE.Vector3();
            target.copy(this.raycaster.ray.direction).multiplyScalar(maxDistance).add(this.raycaster.ray.origin);
            return target;
        },
        
        fireRaycast(origin, direction, maxDistance, spread) {
            // Apply spread
            const spreadDir = direction.clone();
            
            if (spread > 0) {
                const spreadX = (Math.random() - 0.5) * spread;
                const spreadY = (Math.random() - 0.5) * spread;
                
                const right = new THREE.Vector3(1, 0, 0);
                right.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 0, -1), 
                    direction
                ));
                
                const up = new THREE.Vector3(0, 1, 0);
                up.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 0, -1), 
                    direction
                ));
                
                spreadDir.add(right.multiplyScalar(spreadX));
                spreadDir.add(up.multiplyScalar(spreadY));
                spreadDir.normalize();
            }
            
            // Perform raycast
            this.raycaster.set(origin, spreadDir);
            this.raycaster.far = maxDistance;
            
            const potentialTargets = [];
            this.scene.traverse((object) => {
                if (object.isMesh && object.userData.collidable === true && !object.userData.bulletTransparent) {
                    potentialTargets.push(object);
                }
            });
            
            const intersects = this.raycaster.intersectObjects(potentialTargets, false);
            
            if (intersects.length > 0) {
                const hit = intersects[0];
                
                return {
                    hit: true,
                    point: hit.point,
                    normal: hit.face ? hit.face.normal.clone().applyMatrix3(
                        new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
                    ) : new THREE.Vector3(0, 1, 0),
                    distance: hit.distance,
                    object: hit.object,
                    // Return ID if this is a player
                    playerId: hit.object.userData.playerId || null
                };
            }
            
            return {
                hit: false,
                point: origin.clone().add(spreadDir.multiplyScalar(maxDistance)),
                normal: new THREE.Vector3(0, 1, 0),
                distance: maxDistance,
                object: null,
                playerId: null
            };
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.Ballistics = Ballistics;
})();
