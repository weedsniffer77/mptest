// js/render/shader/raytracer.js
(function() {
    const Raytracer = {
        scene: null,
        renderer: null,
        lights: {},
        lightingData: null,
        
        init(renderer) {
            console.log('Raytracer: Initializing lighting system...');
            this.renderer = renderer;
            console.log('Raytracer: ✓ Ready');
        },
        
        applyLighting(scene, renderer, lightingData) {
            console.log('Raytracer: Applying lighting configuration...');
            this.scene = scene;
            this.renderer = renderer;
            this.lightingData = lightingData;
            
            // Clear existing lights
            Object.values(this.lights).forEach(light => {
                if (light && light.parent) {
                    scene.remove(light);
                }
            });
            this.lights = {};
            
            // === SUN / DIRECTIONAL LIGHT ===
            if (lightingData.sun) {
                const sunData = lightingData.sun;
                const sunColor = new THREE.Color(sunData.color);
                
                const sunLight = new THREE.DirectionalLight(
                    sunColor,
                    sunData.intensity
                );
                
                sunLight.position.set(
                    sunData.position.x,
                    sunData.position.y,
                    sunData.position.z
                );
                
                scene.add(sunLight);
                this.lights.sun = sunLight;
                
                // Setup shadows via ShadowManager
                if (window.TacticalShooter.ShadowManager) {
                    window.TacticalShooter.ShadowManager.setupDirectionalLight(sunLight, null);
                }
                
                console.log(`  ✓ Sun: ${sunData.color} @ intensity ${sunData.intensity}`);
            }
            
            // === AMBIENT LIGHT ===
            if (lightingData.ambient) {
                const ambColor = new THREE.Color(lightingData.ambient.color);
                const ambLight = new THREE.AmbientLight(
                    ambColor,
                    lightingData.ambient.intensity
                );
                
                scene.add(ambLight);
                this.lights.ambient = ambLight;
                
                console.log(`  ✓ Ambient: ${lightingData.ambient.color} @ intensity ${lightingData.ambient.intensity}`);
            }
            
            // === HEMISPHERE LIGHT ===
            if (lightingData.hemisphere) {
                const skyColor = new THREE.Color(lightingData.hemisphere.skyColor);
                const groundColor = new THREE.Color(lightingData.hemisphere.groundColor);
                
                const hemiLight = new THREE.HemisphereLight(
                    skyColor,
                    groundColor,
                    lightingData.hemisphere.intensity
                );
                
                hemiLight.position.set(0, 50, 0);
                scene.add(hemiLight);
                this.lights.hemisphere = hemiLight;
                
                console.log(`  ✓ Hemisphere: sky ${lightingData.hemisphere.skyColor} / ground ${lightingData.hemisphere.groundColor}`);
            }
            
            // === FOG ===
            if (lightingData.fog && lightingData.fog.enabled) {
                const fogColor = new THREE.Color(lightingData.fog.color);
                
                // Use exponential squared fog for more realistic falloff
                scene.fog = new THREE.FogExp2(fogColor, lightingData.fog.density);
                
                console.log(`  ✓ Fog: ${lightingData.fog.color} @ density ${lightingData.fog.density}`);
            } else {
                scene.fog = null;
            }
            
            // === SCENE BACKGROUND ===
            // Set background to match fog/atmosphere for consistency
            if (lightingData.atmosphere) {
                // Use horizon color as background
                const bgColor = new THREE.Color(lightingData.atmosphere.horizonColor);
                scene.background = bgColor;
            }
            
            console.log('Raytracer: Lighting applied successfully');
        },
        
        // Update sun position (e.g., for time of day)
        updateSunPosition(x, y, z) {
            if (this.lights.sun) {
                this.lights.sun.position.set(x, y, z);
                
                // Update shadow camera if shadow manager exists
                if (window.TacticalShooter.ShadowManager) {
                    this.lights.sun.shadow.camera.updateProjectionMatrix();
                }
            }
        },
        
        // Update sun intensity
        updateSunIntensity(intensity) {
            if (this.lights.sun) {
                this.lights.sun.intensity = intensity;
            }
        },
        
        // Update ambient light intensity
        updateAmbientIntensity(intensity) {
            if (this.lights.ambient) {
                this.lights.ambient.intensity = intensity;
            }
        },
        
        // Get light for external manipulation
        getLight(name) {
            return this.lights[name];
        },
        
        // Update all lights based on time or conditions
        // Now uses data from initialization rather than hardcoded assumptions
        updateLighting(timeOfDay) {
            // timeOfDay: 0.0 = midnight, 0.5 = noon, 1.0 = midnight
            // Note: This logic assumes a dynamic cycle is active.
            // If the map uses static lighting, this should not be called.
            
            if (this.lights.sun && this.lightingData) {
                // Calculate sun angle
                const angle = timeOfDay * Math.PI * 2 - Math.PI / 2; // -90° at midnight, 90° at noon
                const radius = 100;
                
                this.lights.sun.position.x = Math.cos(angle) * radius;
                this.lights.sun.position.y = Math.sin(angle) * radius;
                this.lights.sun.position.z = this.lightingData.sun.position.z;
                
                // Fade sun intensity at night based on config max intensity
                const sunHeight = this.lights.sun.position.y;
                const dayIntensity = this.lightingData.sun.intensity;
                const nightIntensity = dayIntensity * 0.1;
                
                const t = THREE.MathUtils.clamp((sunHeight + 20) / 40, 0, 1);
                this.lights.sun.intensity = THREE.MathUtils.lerp(nightIntensity, dayIntensity, t);
                
                // Change sun color based on angle (golden hour effect)
                if (sunHeight < 20) {
                    const sunsetColor = new THREE.Color(0xffaa77);
                    const dayColor = new THREE.Color(this.lightingData.sun.color);
                    this.lights.sun.color.lerpColors(sunsetColor, dayColor, t);
                }
            }
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.Raytracer = Raytracer;
})();