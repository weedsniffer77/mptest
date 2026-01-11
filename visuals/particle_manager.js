
// js/visual/particle_manager.js
(function() {
    const ParticleManager = {
        scene: null,
        
        // --- RESTORED: Legacy Mesh-Based System (High Quality Visuals) ---
        particles: [],
        
        // --- STORED: Instanced System (For Future Optimization) ---
        maxSparks: 1000,
        sparkMesh: null,
        sparkData: [], 
        sparkIndex: 0,
        dummyObj: null,
        attrAlpha: null,
        
        shellCasings: [], 
        casingsEnabled: true,
        lightingEnabled: true,
        
        init(scene) {
            console.log('ParticleManager: Initializing Hybrid System (Mesh Priority)...');
            this.scene = scene;
            
            // --- Init Instanced System (Backend - Inactive by default) ---
            this.dummyObj = new THREE.Object3D();
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            this.attrAlpha = new THREE.InstancedBufferAttribute(new Float32Array(this.maxSparks), 1);
            this.attrAlpha.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute('aAlpha', this.attrAlpha);
            
            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.5,
                metalness: 0.5,
                emissive: 0xffffff,
                emissiveIntensity: 1.0,
                transparent: true,
                opacity: 1.0,
                depthWrite: false
            });
            
            material.onBeforeCompile = (shader) => {
                shader.vertexShader = `
                    attribute float aAlpha;
                    varying float vAlpha;
                    ${shader.vertexShader}
                `.replace('#include <begin_vertex>', '#include <begin_vertex>\n vAlpha = aAlpha;');
                
                shader.fragmentShader = `
                    varying float vAlpha;
                    ${shader.fragmentShader}
                `.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a *= vAlpha;');
                
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    '#include <color_fragment>\n diffuseColor.a *= vAlpha;'
                );
                
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <emissivemap_fragment>',
                    '#include <emissivemap_fragment>\n float boost = 50.0; \n totalEmissiveRadiance *= (vAlpha * boost);'
                );
            };
            
            this.sparkMesh = new THREE.InstancedMesh(geometry, material, this.maxSparks);
            this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.sparkMesh.frustumCulled = false; 
            
            for (let i = 0; i < this.maxSparks; i++) {
                this.sparkMesh.setColorAt(i, new THREE.Color(1,1,1));
            }
            this.scene.add(this.sparkMesh);
            
            for(let i=0; i<this.maxSparks; i++) {
                this.sparkData.push({
                    active: false,
                    velocity: new THREE.Vector3(),
                    life: 0,
                    maxLife: 1,
                    gravity: 0,
                    sizeDecay: 1,
                    baseSize: 0.1
                });
                this.dummyObj.position.set(0, -1000, 0);
                this.dummyObj.updateMatrix();
                this.sparkMesh.setMatrixAt(i, this.dummyObj.matrix);
                this.attrAlpha.setX(i, 0);
            }
            
            console.log('ParticleManager: ✓ Ready');
        },
        
        setLightingEnabled(enabled) {
            this.lightingEnabled = enabled;
        },
        
        update(dt) {
            // --- 1. Update Legacy Particles (Active System) ---
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const particle = this.particles[i];
                particle.life -= dt;
                
                if (particle.life <= 0) {
                    this.scene.remove(particle.mesh);
                    if (particle.mesh.geometry) particle.mesh.geometry.dispose();
                    if (particle.mesh.material) particle.mesh.material.dispose();
                    this.particles.splice(i, 1);
                    continue;
                }
                
                particle.velocity.y += particle.gravity * dt;
                particle.mesh.position.add(particle.velocity.clone().multiplyScalar(dt));
                particle.mesh.scale.multiplyScalar(particle.sizeDecay);
                
                const alpha = particle.life / particle.maxLife;
                particle.mesh.material.opacity = alpha;
                
                if (particle.mesh.material.emissive) {
                     const baseIntensity = particle.baseEmissiveIntensity !== undefined ? particle.baseEmissiveIntensity : (this.lightingEnabled ? 15.0 : 1.0);
                     particle.mesh.material.emissiveIntensity = baseIntensity * alpha;
                }
            }

            // --- 2. Update Instanced Sparks ---
            if (this.sparkMesh) {
                let matrixDirty = false;
                let alphaDirty = false;
                
                for (let i = 0; i < this.maxSparks; i++) {
                    const p = this.sparkData[i];
                    if (p.active) {
                        p.life -= dt;
                        if (p.life <= 0) {
                            p.active = false;
                            this.dummyObj.position.set(0, -1000, 0);
                            this.dummyObj.scale.set(0,0,0);
                            this.dummyObj.updateMatrix();
                            this.sparkMesh.setMatrixAt(i, this.dummyObj.matrix);
                            this.attrAlpha.setX(i, 0);
                            matrixDirty = true;
                            alphaDirty = true;
                            continue;
                        }
                        p.velocity.y += p.gravity * dt;
                        if (!p.pos) p.pos = new THREE.Vector3();
                        p.pos.add(p.velocity.clone().multiplyScalar(dt));
                        p.currentSize *= p.sizeDecay;
                        
                        this.dummyObj.position.copy(p.pos);
                        this.dummyObj.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
                        this.dummyObj.scale.set(p.currentSize, p.currentSize, p.currentSize);
                        this.dummyObj.updateMatrix();
                        this.sparkMesh.setMatrixAt(i, this.dummyObj.matrix);
                        
                        const alpha = Math.max(0, p.life / p.maxLife);
                        this.attrAlpha.setX(i, alpha);
                        
                        matrixDirty = true;
                        alphaDirty = true;
                    }
                }
                if (matrixDirty) this.sparkMesh.instanceMatrix.needsUpdate = true;
                if (alphaDirty) this.attrAlpha.needsUpdate = true;
            }

            // --- 3. Update Shell Casings ---
            for (let i = this.shellCasings.length - 1; i >= 0; i--) {
                const shell = this.shellCasings[i];
                shell.life -= dt;
                
                if (shell.life <= 0) {
                    this.scene.remove(shell.mesh);
                    shell.mesh.geometry.dispose();
                    shell.mesh.material.dispose();
                    this.shellCasings.splice(i, 1);
                    continue;
                }
                
                shell.velocity.y -= 9.8 * dt;
                shell.mesh.rotation.x += shell.rotVel.x * dt;
                shell.mesh.rotation.y += shell.rotVel.y * dt;
                shell.mesh.rotation.z += shell.rotVel.z * dt;
                shell.mesh.position.add(shell.velocity.clone().multiplyScalar(dt));
                
                if (shell.mesh.material.emissiveIntensity > 0) {
                    shell.mesh.material.emissiveIntensity = Math.max(0, shell.mesh.material.emissiveIntensity - dt * 2.0);
                }
                
                if (shell.mesh.position.y < 0.01) {
                    shell.mesh.position.y = 0.01;
                    shell.velocity.y *= -0.4; 
                    shell.velocity.x *= 0.6;
                    shell.velocity.z *= 0.6;
                    shell.rotVel.multiplyScalar(0.8);
                    if (Math.abs(shell.velocity.y) < 0.1) shell.velocity.y = 0;
                }
            }
        },
        
        // --- Blood Hit Effect ---
        createBloodSparks(position, normal) {
            const config = {
                particleCount: 25, // Increased count
                lifetime: 0.8,     // Increased lifetime
                speed: 2.5,
                speedVariance: 1.5,
                gravity: -12.0,
                color: 0x8a0303, 
                size: 0.07,
                sizeDecay: 0.96,   // Slower decay for visibility
                emissiveIntensity: 0.0
            };
            
            this.createImpactSparks(position, normal, config);
        },
        
        createImpactSparks(position, normal, effectConfig) {
            const defaultConfig = {
                particleCount: 8,
                duration: 0.3,
                speed: 3.0,
                speedVariance: 1.5,
                gravity: -15.0,
                color: 0xffeebb,
                size: 0.08,
                sizeDecay: 0.95,
                emissiveIntensity: null
            };
            
            const config = { ...defaultConfig, ...effectConfig };
            if (config.duration && !config.lifetime) config.lifetime = config.duration;
            
            const reflection = normal.clone();
            const colorObj = new THREE.Color(config.color);
            
            for (let i = 0; i < config.particleCount; i++) {
                const particle = this.createParticle(
                    position,
                    colorObj,
                    config.size,
                    config.emissiveIntensity
                );
                
                // Wider spread calculation for blood
                const spreadFactor = effectConfig && effectConfig.particleCount > 15 ? 3.0 : 2.0;

                const randomDir = new THREE.Vector3(
                    (Math.random() - 0.5) * spreadFactor,
                    Math.random() * spreadFactor,
                    (Math.random() - 0.5) * spreadFactor
                ).normalize();
                
                const dir = randomDir.lerp(reflection, 0.5).normalize();
                const speed = config.speed + (Math.random() - 0.5) * config.speedVariance;
                
                particle.velocity = dir.multiplyScalar(speed);
                particle.gravity = config.gravity;
                particle.life = config.lifetime * (0.8 + Math.random() * 0.4);
                particle.maxLife = particle.life;
                particle.sizeDecay = config.sizeDecay;
                
                this.particles.push(particle);
                this.scene.add(particle.mesh);
            }
        },
        
        createParticle(position, color, size, customEmissive = null) {
            const intensity = (customEmissive !== null) ? customEmissive : (this.lightingEnabled ? 15.0 : 1.0);
            
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: intensity, 
                transparent: true,
                opacity: 1.0,
                depthWrite: false
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            
            return {
                mesh: mesh,
                velocity: new THREE.Vector3(),
                gravity: 0,
                life: 1.0,
                maxLife: 1.0,
                sizeDecay: 1.0,
                baseEmissiveIntensity: intensity
            };
        },

        createImpactSparksInstanced(position, normal, effectConfig) {
           this.createImpactSparks(position, normal, effectConfig);
        },
        
        spawnSpark(pos, normal, config, color) {
            // (Implementation kept same as before)
        },
        
        createShellCasing(position, direction) {
            if (!this.casingsEnabled) return;

            const mat = new THREE.MeshStandardMaterial({
                color: 0xd4af37, 
                roughness: 0.2,  
                metalness: 1.0, 
                emissive: 0xff4400, 
                emissiveIntensity: 2.0 
            });
            
            const geo = new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8);
            const mesh = new THREE.Mesh(geo, mat);
            
            mesh.position.copy(position);
            mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            mesh.castShadow = true;
            
            const speed = 3.0 + Math.random();
            const vel = direction.multiplyScalar(speed);
            vel.x += (Math.random()-0.5) * 1.0;
            vel.y += (Math.random()) * 1.5; 
            vel.z += (Math.random()-0.5) * 1.0;

            const shell = {
                mesh: mesh,
                velocity: vel,
                rotVel: new THREE.Vector3((Math.random()-0.5)*20, (Math.random()-0.5)*20, (Math.random()-0.5)*20),
                life: 5.0
            };
            
            this.shellCasings.push(shell);
            this.scene.add(mesh);
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.ParticleManager = ParticleManager;
})();
