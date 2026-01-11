
// js/data/weapons/pistol/pistol_model.js
(function() {
    // Attach buildMesh to the existing PISTOL entry
    const weaponDef = window.TacticalShooter.GameData.Weapons["PISTOL"];
    
    if (!weaponDef) {
        console.error("Pistol Model Error: Attributes not loaded first!");
        return;
    }

    weaponDef.buildMesh = function() {
        if (!window.THREE) return null;
        const THREE = window.THREE;
        const group = new THREE.Group();
        
        // Materials
        const matMetal = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });
        const matFrame = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.2 }); 
        const matGrip = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });
        const matBarrel = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.9 });
        const matGlow = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00, 
            emissive: 0x00ff00, 
            emissiveIntensity: 4.0 
        });
        const matChamber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }); 
        
        // --- STATIONARY FRAME ---
        const frameGeo = new THREE.BoxGeometry(0.026, 0.018, 0.22);
        const frame = new THREE.Mesh(frameGeo, matFrame);
        frame.position.set(0, 0, -0.02); 
        frame.castShadow = true;
        group.add(frame);
        
        // Grip (Extended Backwards 35%)
        // Original Depth: 0.045 -> New: 0.06075
        // Position Shifted to keep front face aligned: 0.06 -> 0.067875
        const gripGeo = new THREE.BoxGeometry(0.03, 0.1, 0.06075);
        const grip = new THREE.Mesh(gripGeo, matGrip);
        grip.position.set(0, -0.05, 0.067875);
        grip.rotation.x = -0.25; 
        grip.castShadow = true;
        frame.add(grip);
        
        // Trigger Guard
        const gFront = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.005), matFrame);
        gFront.position.set(0, -0.025, -0.035); 
        gFront.rotation.x = 0.3; 
        frame.add(gFront);
            
        const gBot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.08), matFrame);
        gBot.position.set(0, -0.05, 0.0); 
        frame.add(gBot);
        
        // --- TRIGGER (Moving) ---
        const triggerPivot = new THREE.Group();
        triggerPivot.position.set(0, -0.015, 0.025); 
        frame.add(triggerPivot);
        
        const tGeo = new THREE.BoxGeometry(0.006, 0.025, 0.008);
        const tMesh = new THREE.Mesh(tGeo, matGrip);
        tMesh.position.set(0, -0.012, 0); 
        tMesh.rotation.x = 0.2;
        triggerPivot.add(tMesh);
        
        // Barrel (Adjusted: Tip retracted 0.5cm, Base stationary)
        // New Length: 0.225, New Pos: -0.0325
        const barrelGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.225, 12);
        const barrel = new THREE.Mesh(barrelGeo, matBarrel);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.0325); 
        group.add(barrel);

        // Bore (Moved to match new barrel tip at -0.145)
        const boreGeo = new THREE.CircleGeometry(0.006, 12);
        const matBore = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const bore = new THREE.Mesh(boreGeo, matBore);
        bore.position.set(0, 0.02, -0.1455); 
        bore.rotation.y = Math.PI; // Face forward
        group.add(bore);

        // Muzzle Point
        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.position.set(0, 0.02, -0.15); // Just in front of bore
        muzzlePoint.rotation.set(0, 0, 0); 
        group.add(muzzlePoint);
        
        // Ejection Point
        const ejectionPoint = new THREE.Object3D();
        ejectionPoint.position.set(0.015, 0.025, 0.02); 
        group.add(ejectionPoint);
        
        // --- MOVING SLIDE ---
        const slideMesh = new THREE.Group();
        
        // Slide Body (Adjusted: Extended back 0.25cm)
        // New Length: 0.2325, New Pos: -0.00375
        const slideGeo = new THREE.BoxGeometry(0.028, 0.028, 0.2325);
        const slideBody = new THREE.Mesh(slideGeo, matMetal);
        slideBody.position.z = -0.00375; 
        slideMesh.add(slideBody);
        
        const portGeo = new THREE.PlaneGeometry(0.02, 0.01);
        const portMesh = new THREE.Mesh(portGeo, matChamber);
        portMesh.position.set(0.0141, 0.005, 0.015); 
        portMesh.rotation.y = Math.PI / 2;
        slideMesh.add(portMesh);
        
        const rearSightL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.01), matMetal);
        rearSightL.position.set(-0.006, 0.0165, 0.095); 
        slideMesh.add(rearSightL);
        
        const rearSightR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.01), matMetal);
        rearSightR.position.set(0.006, 0.0165, 0.095); 
        slideMesh.add(rearSightR);
        
        const lDot = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.001), matGlow);
        lDot.position.set(-0.006, 0.0165, 0.1005);
        slideMesh.add(lDot);
        
        const rDot = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.001), matGlow);
        rDot.position.set(0.006, 0.0165, 0.1005);
        slideMesh.add(rDot);
        
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.008, 0.01), matMetal);
        frontSight.position.set(0, 0.0165, -0.105); 
        slideMesh.add(frontSight);
        
        const fDot = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.001), matGlow);
        fDot.position.set(0, 0.0165, -0.104);
        slideMesh.add(fDot);
        
        slideMesh.position.set(0, 0.02, 0);
        slideMesh.castShadow = true;
        group.add(slideMesh);
        
        // --- HAND POINTS (RIGGING) ---
        // Right Hand: Center of Grip
        const handPointRight = new THREE.Object3D();
        handPointRight.name = "HandPoint_R";
        handPointRight.position.set(0, -0.06, 0.06);
        handPointRight.rotation.x = -0.25;
        group.add(handPointRight);
        
        // Left Hand: Also on Grip (Enveloping Right Hand)
        // Positioned identical to Right Hand so they overlap/cup
        const handPointLeft = new THREE.Object3D();
        handPointLeft.name = "HandPoint_L";
        handPointLeft.position.set(0, -0.06, 0.06);
        handPointLeft.rotation.x = -0.25;
        group.add(handPointLeft);

        return {
            mesh: group,
            parts: {
                trigger: triggerPivot,
                slide: slideMesh,
                muzzle: muzzlePoint,
                ejection: ejectionPoint,
                handRight: handPointRight,
                handLeft: handPointLeft
            }
        };
    };
    console.log('Weapon Loaded: PISTOL (Model)');
})();
