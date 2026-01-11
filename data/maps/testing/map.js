
// js/data/maps/testing/map.js
(function() {
    const TestingMap = {
        id: "TESTING",
        name: "Test Grid",
        
        geometry: [],
        
        init(scene, materialLibrary) {
            console.log('TestingMap: Building geometry...');
            this.geometry = [];
            
            const matFloor = materialLibrary.getMaterial('floor');
            const matWall = materialLibrary.getMaterial('wall');
            const matPlatform = materialLibrary.getMaterial('platform');
            const matCover = materialLibrary.getMaterial('cover');
            
            const MapAssets = window.TacticalShooter.MapAssets;
            if (!MapAssets) {
                console.error('MapAssets not loaded!');
                return;
            }

            // --- SEEDED RNG SETUP ---
            // Simple LCG for deterministic generation across all clients
            let seed = 12345;
            const seededRandom = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
            
            // Inject Seeded RNG into MapAssets
            if (MapAssets.setRNG) MapAssets.setRNG(seededRandom);

            // -- 1. Foundation --
            // 80x50m Playable area. Floor top is at y=0.
            this.createBlock(scene, matFloor, 0, -1, 0, 80, 2, 50);
            
            // -- 2. Perimeter Walls --
            this.createBlock(scene, matWall, 0, 4, -25, 80, 8, 1);
            this.createBlock(scene, matWall, 0, 4, 25, 80, 8, 1);
            this.createBlock(scene, matWall, -40, 4, 0, 1, 8, 50);
            this.createBlock(scene, matWall, 40, 4, 0, 1, 8, 50);
            
            // -- 3. Central Structure (The Box) --
            // Boxes at +/- 15. Top Y = 4.
            this.createBlock(scene, matWall, -15, 2, 0, 10, 4, 20); 
            this.createBlock(scene, matWall, 15, 2, 0, 10, 4, 20);
            
            // Skywalk (Y=4)
            this.createBlock(scene, matPlatform, 0, 4, 0, 20, 0.3, 6);
            
            // Skywalk Railing/Cover
            this.createBlock(scene, matCover, 0, 4.5, -3, 20, 1, 0.2);
            this.createBlock(scene, matCover, 0, 4.5, 3, 20, 1, 0.2);
            
            // -- 4. Ramps --
            this.createRamp(scene, matPlatform, -15, 2, 14, 4, 8, 4, true); 
            this.createRamp(scene, matPlatform, 15, 2, -14, 4, 8, 4, false);
            
            // --- INVISIBLE RAMP BLOCKERS (Solid Wedges) ---
            // These fill the acute angle under the ramp. 
            // Calculated to sit -0.1 below the visual ramp surface to avoid conflict on top
            // while blocking prone players underneath.
            // Ramp rises 4m over 8m length. 
            
            const blockerMat = new THREE.MeshBasicMaterial({ visible: false, wireframe: false, side: THREE.DoubleSide });
            
            // Left Ramp Base (Z=16 to 18 is the low part). Width 4. Height 0.9.
            this.createWedge(scene, blockerMat, -15, 0, 17, 4, 0.9, 2, "Z-");
            
            // Right Ramp Base (Z=-16 to -18 is the low part). Width 4. Height 0.9.
            this.createWedge(scene, blockerMat, 15, 0, -17, 4, 0.9, 2, "Z+");

            // -- 5. Static Props & Safety Tracking --
            const placedItems = []; // {x, y, z, r}
            
            // Helper to check for overlap against ALL placed items
            const isPositionClear = (x, y, z, r) => {
                // Check against other props
                for (let item of placedItems) {
                    // Ignore if vertical separation is significant (different floors)
                    if (Math.abs(item.y - y) > 2.5) continue;
                    
                    const dx = x - item.x;
                    const dz = z - item.z;
                    const distSq = dx*dx + dz*dz;
                    const minDist = item.r + r + 0.3; 
                    if (distSq < minDist * minDist) return false;
                }
                
                // Static Structure Checks (Only for Ground Floor y~0)
                if (y < 1.0) {
                    // Perimeter Walls (Slightly increased buffer to 2.5m from 2m)
                    if (Math.abs(x) > 37.5 || Math.abs(z) > 22.5) return false;
                    // Center Structure
                    if (x > -21 && x < 21 && z > -11 && z < 11) return false;
                    // Ramp Left
                    if (x > -19 && x < -11 && z > 9 && z < 20) return false;
                    // Ramp Right
                    if (x > 11 && x < 19 && z > -20 && z < -9) return false;
                }
                
                return true;
            };
            
            // Register Manually Placed Barriers
            const registerBarrierChain = (startX, startZ, count, rot, length = 3.0) => {
                const dirX = Math.sin(rot);
                const dirZ = Math.cos(rot);
                for(let i=0; i<count; i++) {
                    const px = startX + (dirX * length * i);
                    const pz = startZ + (dirZ * length * i);
                    placedItems.push({x: px, y: 0, z: pz, r: 1.5});
                }
            };
            
            // Ground Floor Manual Barriers
            this.createBarrierWall(scene, materialLibrary, -30, -15, 3, 0.2); 
            registerBarrierChain(-30, -15, 3, 0.2);
            
            this.createBarrierWall(scene, materialLibrary, -25, 15, 3, -0.2); 
            registerBarrierChain(-25, 15, 3, -0.2);
            
            this.createBarrierWall(scene, materialLibrary, 30, 15, 3, Math.PI + 0.2);
            registerBarrierChain(30, 15, 3, Math.PI + 0.2);
            
            this.createBarrierWall(scene, materialLibrary, 25, -15, 3, Math.PI - 0.2);
            registerBarrierChain(25, -15, 3, Math.PI - 0.2);
            
            this.createBarrierWall(scene, materialLibrary, 0, 20, 2, Math.PI / 2);
            registerBarrierChain(0, 20, 2, Math.PI / 2);
            
            this.createBarrierWall(scene, materialLibrary, 0, -20, 2, Math.PI / 2);
            registerBarrierChain(0, -20, 2, Math.PI / 2);

            // -- 6. Procedural Scattering --
            
            // --- A. Ground Floor Generation ---
            // Reduced count from 35 to 32
            let count = 0;
            let attempts = 0;
            const groundY = 0;
            
            while (count < 32 && attempts < 400) {
                attempts++;
                
                let rx, rz;
                const zoneSelector = seededRandom();
                
                // Target side halls
                if (zoneSelector < 0.45) { // North Hall
                    rx = (seededRandom() - 0.5) * 70; 
                    rz = -12 - (seededRandom() * 10); 
                } else if (zoneSelector < 0.9) { // South Hall
                    rx = (seededRandom() - 0.5) * 70;
                    rz = 12 + (seededRandom() * 10);
                } else { // Random
                    rx = (seededRandom() - 0.5) * 70;
                    rz = (seededRandom() - 0.5) * 40;
                }
                
                const typeRoll = seededRandom();
                let radius = 0.5;
                
                if (typeRoll < 0.15) { 
                    // Oil Drum
                    radius = 0.5;
                    if (!isPositionClear(rx, groundY, rz, radius)) continue;
                    
                    MapAssets.createBarrel(scene, materialLibrary, rx, groundY, rz, this.geometry);
                    placedItems.push({x: rx, y: groundY, z: rz, r: radius});
                    
                } else if (typeRoll < 0.30) {
                    // Concrete Barrier
                    radius = 1.0;
                    if (!isPositionClear(rx, groundY, rz, radius)) continue;
                    
                    const rot = seededRandom() * Math.PI;
                    MapAssets.createConcreteBarrier(scene, materialLibrary, rx, groundY, rz, rot, this.geometry);
                    placedItems.push({x: rx, y: groundY, z: rz, r: radius});
                    
                } else if (typeRoll < 0.95) { // Wood Obstacles (High chance)
                    // Wood Obstacles (Mixed)
                    const subType = seededRandom();
                    
                    if (subType < 0.15) {
                        // Standard Stack (Low)
                        radius = 0.8;
                        if (!isPositionClear(rx, groundY, rz, radius)) continue;
                        const stacks = 1 + Math.floor(seededRandom() * 2);
                        MapAssets.createPalletStack(scene, materialLibrary, rx, groundY, rz, stacks, 1.2, this.geometry);
                        placedItems.push({x: rx, y: groundY, z: rz, r: radius});
                        
                    } else if (subType < 0.90) { 
                        // NEW: Plank Pyramid (High freq)
                        // Increased radius check to prevent clipping (2.5m)
                        radius = 2.5; 
                        if (!isPositionClear(rx, groundY, rz, radius)) continue;
                        
                        const rot = seededRandom() * Math.PI;
                        MapAssets.createPlankStack(scene, materialLibrary, rx, groundY, rz, rot, this.geometry);
                        placedItems.push({x: rx, y: groundY, z: rz, r: radius});
                        
                    } else {
                        // Old Box Pyramid
                        radius = 1.2;
                        if (!isPositionClear(rx, groundY, rz, radius)) continue;
                        const isBig = seededRandom() > 0.5;
                        MapAssets.createPalletPyramid(scene, materialLibrary, rx, groundY, rz, isBig, this.geometry);
                        placedItems.push({x: rx, y: groundY, z: rz, r: radius});
                    }
                    
                } else {
                     // Container (Large)
                     radius = 4.0; 
                     if (!isPositionClear(rx, groundY, rz, radius)) continue;
                     
                     if (Math.abs(rx) > 25) { 
                        const rot = seededRandom() * Math.PI * 0.5;
                        MapAssets.createContainer(scene, materialLibrary, rx, groundY, rz, 'containerBlue', rot, this.geometry);
                        placedItems.push({x: rx, y: groundY, z: rz, r: radius});
                     }
                }
                count++;
            }
            
            // --- B. Second Floor Generation ---
            const roofY = 4.0;
            let roofCount = 0;
            let roofAttempts = 0;
            
            while (roofCount < 12 && roofAttempts < 100) {
                roofAttempts++;
                
                const locRoll = seededRandom();
                let rx, rz;
                
                if (locRoll < 0.4) {
                    rx = -20 + seededRandom()*10;
                    rz = -9 + seededRandom()*18;
                } else if (locRoll < 0.8) {
                    rx = 10 + seededRandom()*10;
                    rz = -9 + seededRandom()*18;
                } else {
                    rx = -9 + seededRandom()*18;
                    rz = -2 + seededRandom()*4;
                }
                
                // EXCLUSION: Bridge is width 20 (-10 to 10), depth 6 (-3 to 3).
                // Widened slightly to ensure clearance.
                if (Math.abs(rx) < 12 && Math.abs(rz) < 5) continue;
                
                const typeRoll = seededRandom();
                let radius = 0.6;
                
                if (typeRoll < 0.55) { // High plank chance
                    // Plank Pyramid on roof
                    radius = 2.2; // Increased slightly for roof too
                    if (!isPositionClear(rx, roofY, rz, radius)) continue;
                    const rot = seededRandom() * Math.PI;
                    MapAssets.createPlankStack(scene, materialLibrary, rx, roofY, rz, rot, this.geometry);
                    placedItems.push({x: rx, y: roofY, z: rz, r: radius});
                    
                } else if (typeRoll < 0.75) {
                    radius = 1.0;
                    if (!isPositionClear(rx, roofY, rz, radius)) continue;
                    let rot = seededRandom()*Math.PI;
                    if (locRoll >= 0.8) rot = Math.PI/2 + (seededRandom()-0.5)*0.5;
                    MapAssets.createConcreteBarrier(scene, materialLibrary, rx, roofY, rz, rot, this.geometry);
                    placedItems.push({x: rx, y: roofY, z: rz, r: radius});
                    
                } else {
                    radius = 0.5;
                    if (!isPositionClear(rx, roofY, rz, radius)) continue;
                    MapAssets.createBarrel(scene, materialLibrary, rx, roofY, rz, this.geometry);
                    placedItems.push({x: rx, y: roofY, z: rz, r: radius});
                }
                roofCount++;
            }
            
            // RESET RNG to default to avoid side effects elsewhere
            if (MapAssets.setRNG) MapAssets.setRNG(Math.random);

            console.log('TestingMap: ✓ Geometry complete');
        },
        
        // --- Helper Builders ---
        
        createBarrierWall(scene, library, startX, startZ, count, rotationY) {
            const MapAssets = window.TacticalShooter.MapAssets;
            const barrierLength = 3.0; 
            const dirX = Math.sin(rotationY);
            const dirZ = Math.cos(rotationY);
            for (let i = 0; i < count; i++) {
                const px = startX + (dirX * barrierLength * i);
                const pz = startZ + (dirZ * barrierLength * i);
                MapAssets.createConcreteBarrier(scene, library, px, 0, pz, rotationY, this.geometry);
            }
        },
        
        createBlock(scene, material, x, y, z, w, h, d) {
            const geo = new THREE.BoxGeometry(w, h, d);
            // Use shared scaler if texture map
            if (material.map) {
                window.TacticalShooter.MapAssets.scaleUVs(geo, w, h, d);
            }
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            if (material.visible) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
            mesh.userData.collidable = true;
            scene.add(mesh);
            this.geometry.push(mesh);
            return mesh;
        },
        
        createRamp(scene, material, x, y, z, w, len, rise, slopeUpZ) {
            const angle = Math.atan2(rise, len);
            const hypotenuse = Math.sqrt(len*len + rise*rise);
            const geo = new THREE.BoxGeometry(w, 0.5, hypotenuse);
            // Use shared scaler
            window.TacticalShooter.MapAssets.scaleUVs(geo, w, 0.5, hypotenuse);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y, z);
            if (slopeUpZ) mesh.rotation.x = angle; else mesh.rotation.x = -angle;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.collidable = true;
            scene.add(mesh);
            this.geometry.push(mesh);
            return mesh;
        },

        createWedge(scene, material, x, y, z, w, h, d, direction) {
            const hw = w / 2;
            const hd = d / 2;
            
            // Heights - Using an offset of -0.1 relative to slope to act as a safe blocker
            // The top vertices will be slightly below the visual ramp surface.
            const hOffset = -0.1;
            const yF = direction === "Z+" ? h + hOffset : 0; // Front (+Z)
            const yB = direction === "Z-" ? h + hOffset : 0; // Back (-Z)
            
            const vertices = [
                // Bottom (y=0)
                -hw, 0, -hd,   hw, 0, -hd,   -hw, 0, hd,
                 hw, 0, -hd,   hw, 0, hd,    -hw, 0, hd,
                 
                // Slope Top
                // Triangle 1: Front-Left, Back-Left, Back-Right
                -hw, yF, hd,   -hw, yB, -hd,   hw, yB, -hd,
                // Triangle 2: Front-Left, Back-Right, Front-Right
                -hw, yF, hd,    hw, yB, -hd,   hw, yF, hd,
                
                // Side Left (-X)
                -hw, 0, -hd,   -hw, 0, hd,    -hw, yB, -hd,
                -hw, 0, hd,    -hw, yF, hd,   -hw, yB, -hd,

                // Side Right (+X)
                hw, 0, -hd,    hw, yB, -hd,   hw, 0, hd,
                hw, 0, hd,     hw, yF, hd,    hw, yB, -hd,
            ];
            
            // Vertical Back/Front Face (Closing the wedge)
            if (direction === "Z-") {
                // Vertical at Back (-Z)
                vertices.push(
                    -hw, 0, -hd,  hw, 0, -hd,  -hw, yB, -hd,
                     hw, 0, -hd,  hw, yB, -hd, -hw, yB, -hd
                );
            } else {
                // Vertical at Front (+Z)
                vertices.push(
                    -hw, 0, hd,   -hw, yF, hd,   hw, 0, hd,
                     hw, 0, hd,   -hw, yF, hd,   hw, yF, hd
                );
            }
            
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            mesh.userData.collidable = true;
            mesh.userData.bulletTransparent = true; // Don't block bullets
            
            scene.add(mesh);
            this.geometry.push(mesh);
            return mesh;
        },
        
        cleanup(scene) {
            this.geometry.forEach(obj => {
                scene.remove(obj);
                obj.geometry.dispose();
            });
            this.geometry = [];
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.TestingMap = TestingMap;
})();
