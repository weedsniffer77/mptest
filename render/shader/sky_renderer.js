
// js/render/shader/sky_renderer.js
(function() {
    const SkyRenderer = {
        scene: null,
        skyMesh: null,
        sunGroup: null,
        lightingData: null,
        
        init(scene, lightingData) {
            console.log('SkyRenderer: Initializing atmospheric sky...');
            this.scene = scene;
            this.lightingData = lightingData;
            
            // Create sky dome
            this.createSky();
            
            // Create sun visual
            if (lightingData.sun && lightingData.sun.visual) {
                this.createSunVisual();
            }
            
            console.log('SkyRenderer: ✓ Sky and atmosphere ready');
        },
        
        update(camera) {
            // No manual raycast needed - Sprites handle occlusion via depth buffer
            if (this.sunGroup && camera) {
                this.sunGroup.lookAt(camera.position);
            }
        },
        
        createSky() {
            const atmo = this.lightingData.atmosphere;
            
            // Create sky dome geometry
            const skyGeo = new THREE.SphereGeometry(500, 32, 16);
            
            // Create gradient sky material using vertex colors
            const colors = [];
            const positions = skyGeo.attributes.position;
            
            const zenithColor = new THREE.Color(atmo.zenithColor);
            const horizonColor = new THREE.Color(atmo.horizonColor);
            const groundColor = new THREE.Color(atmo.groundColor);
            
            for (let i = 0; i < positions.count; i++) {
                const y = positions.getY(i);
                const vertexHeight = y / 500; // Normalized -1 to 1
                
                let color = new THREE.Color();
                
                if (vertexHeight > 0) {
                    // Sky - lerp from horizon to zenith
                    const t = vertexHeight;
                    color.lerpColors(horizonColor, zenithColor, t * t); // Squared for non-linear gradient
                } else {
                    // Below horizon - lerp from horizon to ground
                    const t = -vertexHeight;
                    color.lerpColors(horizonColor, groundColor, t);
                }
                
                colors.push(color.r, color.g, color.b);
            }
            
            skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            
            const skyMat = new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.BackSide,
                fog: false // Sky not affected by fog
            });
            
            this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
            this.skyMesh.renderOrder = -1; // Render first (behind everything)
            this.scene.add(this.skyMesh);
            
            console.log('  ✓ Sky dome created with gradient atmosphere');
        },
        
        createSunVisual() {
            const sunData = this.lightingData.sun;
            const visual = sunData.visual;
            
            this.sunGroup = new THREE.Group();
            
            // Position far away
            const pos = new THREE.Vector3(sunData.position.x, sunData.position.y, sunData.position.z).normalize().multiplyScalar(400);
            this.sunGroup.position.copy(pos);

            // 1. Halo/Glow Sprite (Smoother, larger)
            const glowTexture = this.createGlowTexture();
            const glowMat = new THREE.SpriteMaterial({
                map: glowTexture,
                color: new THREE.Color(visual.glowColor).multiplyScalar(2.0), // Boost for bloom
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true // CRITICAL: Allows occlusion by gun/walls
            });
            const glowSprite = new THREE.Sprite(glowMat);
            glowSprite.scale.set(visual.glowSize, visual.glowSize, 1.0);
            this.sunGroup.add(glowSprite);
            
            // 2. Core Sprite (Sharp, bright)
            const coreTexture = this.createCoreTexture();
            const coreMat = new THREE.SpriteMaterial({
                map: coreTexture,
                color: new THREE.Color(visual.coreColor).multiplyScalar(10.0), // High HDR for bloom
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: true
            });
            const coreSprite = new THREE.Sprite(coreMat);
            coreSprite.scale.set(visual.coreSize, visual.coreSize, 1.0);
            this.sunGroup.add(coreSprite);
            
            this.scene.add(this.sunGroup);
            console.log('  ✓ Sun sprites created with depth testing');
        },
        
        createCoreTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Sharp core, very bright center
            const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.2, 'rgba(255, 255, 240, 0.9)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 256);
            return new THREE.CanvasTexture(canvas);
        },
        
        createGlowTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Very smooth falloff for halo
            const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
            gradient.addColorStop(0, 'rgba(255, 240, 200, 0.4)'); 
            gradient.addColorStop(0.4, 'rgba(255, 220, 180, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 200, 150, 0.0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
            return new THREE.CanvasTexture(canvas);
        },
        
        updateSunPosition(x, y, z) {
            if (this.sunGroup) {
                 const pos = new THREE.Vector3(x, y, z).normalize().multiplyScalar(400);
                 this.sunGroup.position.copy(pos);
            }
        },
        
        dispose() {
            if (this.skyMesh) {
                this.scene.remove(this.skyMesh);
                this.skyMesh.geometry.dispose();
                this.skyMesh.material.dispose();
            }
            if (this.sunGroup) {
                this.scene.remove(this.sunGroup);
            }
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.SkyRenderer = SkyRenderer;
})();
