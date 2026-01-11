
// js/data/player/player_model.js
(function() {
    const PlayerModelBuilder = {
        
        // Config for modular parts
        dimensions: {
            totalHeight: 1.85,
            
            head: { w: 0.225, h: 0.3, d: 0.25 }, 
            torso: { w: 0.35, h: 0.55, d: 0.25 },
            waist: { w: 0.32, h: 0.15, d: 0.22 },
            
            armUpper: { w: 0.12, h: 0.35, d: 0.12 },
            armLower: { w: 0.10, h: 0.35, d: 0.10 },
            
            legUpper: { w: 0.16, h: 0.45, d: 0.16 },
            legLower: { w: 0.14, h: 0.45, d: 0.14 },
            foot:     { w: 0.12, h: 0.10, d: 0.28 }
        },
        
        _materials: null,

        getMaterials() {
            if (this._materials) return this._materials;
            
            const THREE = window.THREE;
            const unifiedColor = 0x444444; // Tactical Grey

            this._materials = {
                suit: new THREE.MeshStandardMaterial({ color: unifiedColor, roughness: 0.9, metalness: 0.1 }),
                bodyMat: new THREE.MeshStandardMaterial({ color: unifiedColor, roughness: 0.8, metalness: 0.1 }),
                headMat: new THREE.MeshStandardMaterial({ color: unifiedColor, roughness: 0.8, metalness: 0.1 }),
                skin: new THREE.MeshStandardMaterial({ color: 0xdcb898, roughness: 0.9, metalness: 0.0 })
            };
            return this._materials;
        },

        build(ignoredTeamColor) {
            const THREE = window.THREE;
            const group = new THREE.Group();
            group.name = "PlayerRoot";

            // BodyGroup: Container for everything that moves down when crouching
            const bodyGroup = new THREE.Group();
            group.add(bodyGroup);
            
            const D = this.dimensions;
            const M = this.getMaterials();
            
            // --- 1. LOWER BODY ---
            
            // Hips/Waist (Center pivot at 0.9m)
            const hips = new THREE.Mesh(new THREE.BoxGeometry(D.waist.w, D.waist.h, D.waist.d), M.suit);
            hips.position.y = 0.925; 
            hips.castShadow = true;
            hips.name = "Torso"; // Waist counts as torso hit
            bodyGroup.add(hips);
            
            // Legs Helper (Rigged)
            const createLeg = (side) => { // -1 left, 1 right
                const legRoot = new THREE.Group();
                const xOffset = side * 0.1;
                // Pivot at Hip Height
                legRoot.position.set(xOffset, 0.9, 0); 
                
                // Upper Leg Group (Thigh)
                const upperGeo = new THREE.BoxGeometry(D.legUpper.w, D.legUpper.h, D.legUpper.d);
                const upper = new THREE.Mesh(upperGeo, M.suit);
                upper.position.set(0, -D.legUpper.h / 2, 0);
                upper.castShadow = true;
                upper.name = "Leg";
                legRoot.add(upper);
                
                // Lower Leg Group (Knee)
                const kneeGroup = new THREE.Group();
                kneeGroup.position.set(0, -D.legUpper.h, 0);
                legRoot.add(kneeGroup);
                
                // Lower Mesh
                const lowerGeo = new THREE.BoxGeometry(D.legLower.w, D.legLower.h, D.legLower.d);
                const lower = new THREE.Mesh(lowerGeo, M.suit);
                lower.position.set(0, -D.legLower.h / 2, 0);
                lower.castShadow = true;
                lower.name = "Leg";
                kneeGroup.add(lower);
                
                // Foot
                const footGeo = new THREE.BoxGeometry(D.foot.w, D.foot.h, D.foot.d);
                const foot = new THREE.Mesh(footGeo, M.suit);
                foot.position.set(0, -D.legLower.h, -0.10); 
                foot.castShadow = true;
                foot.name = "Leg";
                kneeGroup.add(foot);
                
                // Link knee for animation
                kneeGroup.userData = { foot: foot };
                legRoot.userData = { knee: kneeGroup };
                
                return legRoot;
            };
            
            const leftLeg = createLeg(-1);
            const rightLeg = createLeg(1);
            bodyGroup.add(leftLeg);
            bodyGroup.add(rightLeg);
            
            // --- 2. UPPER BODY ---
            
            // Torso Group (Pivot point for leaning)
            const torsoGroup = new THREE.Group();
            torsoGroup.position.y = 1.0;
            bodyGroup.add(torsoGroup);
            
            const torsoGeo = new THREE.BoxGeometry(D.torso.w, D.torso.h, D.torso.d);
            const torso = new THREE.Mesh(torsoGeo, M.bodyMat); 
            torso.position.y = D.torso.h / 2; 
            torso.castShadow = true;
            torso.name = "Torso";
            torsoGroup.add(torso);
            
            // --- 3. HEAD ---
            const headGroup = new THREE.Group();
            headGroup.position.y = D.torso.h; 
            torsoGroup.add(headGroup);
            
            const headGeo = new THREE.BoxGeometry(D.head.w, D.head.h, D.head.d);
            const head = new THREE.Mesh(headGeo, M.headMat); 
            head.position.y = D.head.h / 2;
            head.castShadow = true;
            head.name = "Head";
            headGroup.add(head);
            
            // --- 4. ARMS (HIERARCHICAL) ---
            
            const createArm = (side) => { // -1 left, 1 right
                const armGroup = new THREE.Group(); // SHOULDER PIVOT
                const xOffset = side * (D.torso.w/2 + D.armUpper.w/2);
                
                // Shoulder height
                const shoulderY = D.torso.h; 
                armGroup.position.set(xOffset, shoulderY - 0.05, 0); 
                
                // Upper Arm Mesh
                const upperGeo = new THREE.BoxGeometry(D.armUpper.w, D.armUpper.h, D.armUpper.d);
                const upper = new THREE.Mesh(upperGeo, M.bodyMat); 
                upper.position.y = -D.armUpper.h / 2; // Hanging down
                upper.castShadow = true;
                upper.name = "Arm";
                armGroup.add(upper);
                
                // Elbow Group (Forearm Pivot)
                const elbowGroup = new THREE.Group();
                elbowGroup.position.y = -D.armUpper.h; // At bottom of upper arm
                armGroup.add(elbowGroup);
                
                // Lower Arm Mesh (Forearm)
                const lowerGeo = new THREE.BoxGeometry(D.armLower.w, D.armLower.h, D.armLower.d);
                const lower = new THREE.Mesh(lowerGeo, M.bodyMat); 
                lower.position.y = -D.armLower.h / 2; // Hanging down from elbow
                lower.castShadow = true;
                lower.name = "Arm";
                elbowGroup.add(lower);
                
                // Link elbow for animation
                armGroup.userData = { elbow: elbowGroup };
                
                return armGroup;
            };
            
            const leftArm = createArm(-1);
            const rightArm = createArm(1);
            
            torsoGroup.add(leftArm);
            torsoGroup.add(rightArm);
            
            return {
                mesh: group,
                parts: {
                    bodyGroup: bodyGroup,
                    head: headGroup,
                    torso: torsoGroup,
                    legs: hips,
                    leftLeg: leftLeg,
                    rightLeg: rightLeg,
                    leftArm: leftArm,   // Shoulder Pivot
                    rightArm: rightArm, // Shoulder Pivot
                }
            };
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.PlayerModelBuilder = PlayerModelBuilder;
})();
