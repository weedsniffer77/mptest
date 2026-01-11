
// js/data/map_assets.js
(function() {
    const MapAssets = {
        
        rng: Math.random, // Default to Math.random

        setRNG(fn) {
            this.rng = fn || Math.random;
        },

        scaleUVs(geometry, w, h, d) {
            const uvs = geometry.attributes.uv;
            for (let i = 0; i < uvs.count; i += 4) {
                let uScale = 1;
                let vScale = 1;
                const faceIndex = i / 4;
                if (faceIndex === 0 || faceIndex === 1) { uScale = d; vScale = h; }
                else if (faceIndex === 2 || faceIndex === 3) { uScale = w; vScale = d; }
                else { uScale = w; vScale = h; }
                for (let j = 0; j < 4; j++) {
                    uvs.setXY(i + j, uvs.getX(i + j) * uScale, uvs.getY(i + j) * vScale);
                }
            }
            uvs.needsUpdate = true;
        },

        createBarrel(scene, library, x, y, z, geometryList) {
            const mat = library.getMaterial('barrelRed');
            // Height increased from 1.2 to 1.45 for better cover
            const h = 1.45;
            const r = 0.4;
            const geo = new THREE.CylinderGeometry(r, r, h, 16);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + h/2 - 0.02, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.collidable = true;
            mesh.rotation.y = this.rng() * Math.PI; // Use seeded RNG
            scene.add(mesh);
            if (geometryList) geometryList.push(mesh);
            return mesh;
        },
        
        createPalletStack(scene, library, x, y, z, count, scale = 1.2, geometryList) {
            const mat = library.getMaterial('palletWood');
            const w = scale;
            const d = scale * 0.8;
            const hPerPallet = 0.15;
            const totalH = count * hPerPallet;
            
            const geo = new THREE.BoxGeometry(w, totalH, d);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + totalH/2 - 0.02, z);
            mesh.rotation.y = this.rng() * 0.5; // Use seeded RNG
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.collidable = true;
            scene.add(mesh);
            if (geometryList) geometryList.push(mesh);
            return mesh;
        },
        
        createPalletLong(scene, library, x, y, z, rot, geometryList) {
             const mat = library.getMaterial('palletWood');
             const w = 2.4; // Double width
             const d = 1.0;
             const h = 0.45; // 3 high approx
             
             const geo = new THREE.BoxGeometry(w, h, d);
             const mesh = new THREE.Mesh(geo, mat);
             mesh.position.set(x, y + h/2 - 0.02, z);
             mesh.rotation.y = rot;
             mesh.castShadow = true;
             mesh.receiveShadow = true;
             mesh.userData.collidable = true;
             scene.add(mesh);
             if (geometryList) geometryList.push(mesh);
             return mesh;
        },
        
        createPlankStack(scene, library, x, y, z, rotation, geometryList) {
            const mat = library.getMaterial('palletWood');
            // Dimensions of a single long plank
            const pL = 3.2; 
            const pW = 0.4; 
            const pH = 0.12; 
            
            const spawnPlank = (ox, oy, oz, r) => {
                 const geo = new THREE.BoxGeometry(pW, pH, pL);
                 const mesh = new THREE.Mesh(geo, mat);
                 mesh.position.set(x + ox, y + oy + pH/2 - 0.02, z + oz);
                 mesh.rotation.y = r + (this.rng()-0.5)*0.08; // Use seeded RNG
                 mesh.castShadow = true;
                 mesh.receiveShadow = true;
                 mesh.userData.collidable = true;
                 scene.add(mesh);
                 if (geometryList) geometryList.push(mesh);
            };

            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            
            const offset = (localX, localY, localZ) => {
                 const rx = localX * cos - localZ * sin;
                 const rz = localX * sin + localZ * cos;
                 return {x: rx, y: localY, z: rz};
            };
            
            const stride = pW + 0.05; // width + gap
            
            // 3 Bottom
            const b1 = offset(-stride, 0, 0);
            const b2 = offset(0, 0, 0);
            const b3 = offset(stride, 0, 0);
            
            spawnPlank(b1.x, 0, b1.z, rotation);
            spawnPlank(b2.x, 0, b2.z, rotation);
            spawnPlank(b3.x, 0, b3.z, rotation);
            
            // 2 Middle
            const m1 = offset(-stride/2, pH, 0);
            const m2 = offset(stride/2, pH, 0);
            
            spawnPlank(m1.x, m1.y, m1.z, rotation);
            spawnPlank(m2.x, m2.y, m2.z, rotation);
            
            // 1 Top
            const t1 = offset(0, pH*2, 0);
            spawnPlank(t1.x, t1.y, t1.z, rotation);
        },
        
        createPalletPyramid(scene, library, x, y, z, isLarge, geometryList) {
            const pW = 1.2;
            const pD = 1.0;
            const pH = 0.15;
            
            const spawnOne = (ox, oy, oz, r) => {
                const geo = new THREE.BoxGeometry(pW, pH*2, pD); 
                const mesh = new THREE.Mesh(geo, library.getMaterial('palletWood'));
                mesh.position.set(x + ox, y + oy + pH - 0.02, z + oz);
                mesh.rotation.y = r + (this.rng()-0.5)*0.1; // Use seeded RNG
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.collidable = true;
                scene.add(mesh);
                if (geometryList) geometryList.push(mesh);
            };
            
            const baseRot = this.rng() * Math.PI; // Use seeded RNG
            const cos = Math.cos(baseRot);
            const sin = Math.sin(baseRot);
            const offset = (lx, lz) => {
                return { x: lx * cos - lz * sin, z: lx * sin + lz * cos };
            };

            if (isLarge) {
                // 3 base
                const o1 = offset(-pW, 0); const o2 = offset(0, 0); const o3 = offset(pW, 0);
                spawnOne(o1.x, 0, o1.z, baseRot); spawnOne(o2.x, 0, o2.z, baseRot); spawnOne(o3.x, 0, o3.z, baseRot);
                // 2 mid
                const m1 = offset(-pW/2, 0); const m2 = offset(pW/2, 0);
                spawnOne(m1.x, pH*2, m1.z, baseRot); spawnOne(m2.x, pH*2, m2.z, baseRot);
                // 1 top
                const t1 = offset(0, 0);
                spawnOne(t1.x, pH*4, t1.z, baseRot);
            } else {
                // 2 base
                const o1 = offset(-pW/2, 0); const o2 = offset(pW/2, 0);
                spawnOne(o1.x, 0, o1.z, baseRot); spawnOne(o2.x, 0, o2.z, baseRot);
                // 1 top
                const t1 = offset(0, 0);
                spawnOne(t1.x, pH*2, t1.z, baseRot);
            }
        },
        
        createContainer(scene, library, x, y, z, matName, rotationY, geometryList) {
            const mat = library.getMaterial(matName);
            const w = 2.4;
            const h = 2.6;
            const l = 6.0;
            const geo = new THREE.BoxGeometry(w, h, l);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + h/2 - 0.05, z);
            mesh.rotation.y = rotationY;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.collidable = true;
            scene.add(mesh);
            if (geometryList) geometryList.push(mesh);
            return mesh;
        },
        
        createConcreteBarrier(scene, library, x, y, z, rotation, geometryList) {
            const mat = library.getMaterial('concrete');
            const shape = new THREE.Shape();
            // Original Y coords: 0, 0.25, 1.4. 
            // 105% of 1.4 is 1.47
            shape.moveTo(0.3, 0);
            shape.lineTo(0.15, 0.30);
            shape.lineTo(0.1, 1.47); // ADJUSTED
            shape.lineTo(-0.1, 1.47); // ADJUSTED
            shape.lineTo(-0.15, 0.30);
            shape.lineTo(-0.3, 0);
            shape.lineTo(0.3, 0);
            
            const extrudeSettings = { steps: 1, depth: 3.0, bevelEnabled: false };
            const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geo.translate(0, 0, -1.5);
            
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y - 0.02, z);
            mesh.rotation.y = rotation;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.collidable = true;
            scene.add(mesh);
            if (geometryList) geometryList.push(mesh);
            return mesh;
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.MapAssets = MapAssets;
})();
