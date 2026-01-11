// js/render/shader/shadow_manager.js
(function() {
    const ShadowManager = {
        renderer: null,
        directionalLight: null,
        
        // CSM configuration
        useCascades: true,
        cascadeCount: 3,
        shadowMapSize: 2048,
        
        // Shadow quality settings - TUNED TO ELIMINATE RIPPLING
        config: {
            bias: -0.0005,      // Slightly increased from -0.0001 to reduce artifacts
            normalBias: 0.05,   // Increased from 0.02 to reduce surface rippling
            radius: 2.5         // Slightly increased from 2.0 for smoother edges
        },
        
        init(renderer) {
            console.log('ShadowManager: Initializing improved shadow system...');
            this.renderer = renderer;
            
            // Enable high-quality shadows
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = true;
            
            console.log('ShadowManager: ✓ Ready');
            console.log(`  - Shadow map size: ${this.shadowMapSize}x${this.shadowMapSize}`);
            console.log(`  - Shadow type: PCFSoftShadowMap`);
        },
        
        setupDirectionalLight(light, camera) {
            this.directionalLight = light;
            
            // Enable shadows on the light
            light.castShadow = true;
            
            // Configure shadow camera for optimal coverage
            const d = 50; // Coverage distance
            light.shadow.camera.left = -d;
            light.shadow.camera.right = d;
            light.shadow.camera.top = d;
            light.shadow.camera.bottom = -d;
            light.shadow.camera.near = 0.5;
            light.shadow.camera.far = 200;
            
            // High resolution shadow map
            light.shadow.mapSize.width = this.shadowMapSize;
            light.shadow.mapSize.height = this.shadowMapSize;
            
            // Bias settings to reduce shadow acne and rippling
            light.shadow.bias = this.config.bias;
            light.shadow.normalBias = this.config.normalBias;
            light.shadow.radius = this.config.radius;
            
            // Update shadow camera
            light.shadow.camera.updateProjectionMatrix();
            
            console.log('ShadowManager: Directional light shadows configured');
            console.log(`  - Shadow frustum: ${d*2}x${d*2}x${light.shadow.camera.far-light.shadow.camera.near}`);
        },
        
        updateShadowCamera(playerPosition) {
            if (!this.directionalLight) return;
            
            // Center shadow camera on player for better shadow quality
            const shadowCam = this.directionalLight.shadow.camera;
            const lightPos = this.directionalLight.position.clone().normalize();
            
            // Position shadow camera to follow player
            const centerOffset = playerPosition.clone();
            centerOffset.y = 0; // Keep on ground plane
            
            // Move light position relative to player
            const dist = 80;
            this.directionalLight.position.copy(lightPos.multiplyScalar(dist).add(centerOffset));
            
            // Update shadow camera to look at player area
            shadowCam.position.copy(this.directionalLight.position);
            shadowCam.lookAt(centerOffset);
            shadowCam.updateMatrixWorld(true);
        },
        
        // Update shadow settings at runtime
        setShadowQuality(quality) {
            if (!this.directionalLight) return;
            
            const settings = {
                low: {
                    mapSize: 1024,
                    radius: 3.0,
                    bias: -0.001
                },
                medium: {
                    mapSize: 2048,
                    radius: 2.5,
                    bias: -0.0005
                },
                high: {
                    mapSize: 4096,
                    radius: 2.0,
                    bias: -0.0002
                }
            };
            
            const config = settings[quality] || settings.medium;
            
            this.shadowMapSize = config.mapSize;
            this.directionalLight.shadow.mapSize.width = config.mapSize;
            this.directionalLight.shadow.mapSize.height = config.mapSize;
            this.directionalLight.shadow.radius = config.radius;
            this.directionalLight.shadow.bias = config.bias;
            
            // Force shadow map regeneration
            this.directionalLight.shadow.map?.dispose();
            this.directionalLight.shadow.map = null;
            this.directionalLight.shadow.needsUpdate = true;
            
            console.log(`ShadowManager: Quality set to ${quality} (${config.mapSize}x${config.mapSize})`);
        },
        
        // Enable/disable shadows
        setShadowsEnabled(enabled) {
            if (this.renderer) {
                this.renderer.shadowMap.enabled = enabled;
                this.renderer.shadowMap.needsUpdate = true;
                console.log(`ShadowManager: Shadows ${enabled ? 'enabled' : 'disabled'}`);
            }
        },
        
        // Debug: visualize shadow camera frustum
        getShadowCameraHelper() {
            if (this.directionalLight) {
                return new THREE.CameraHelper(this.directionalLight.shadow.camera);
            }
            return null;
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.ShadowManager = ShadowManager;
})();