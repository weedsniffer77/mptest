
// js/render/material_library.js
(function() {
    const MaterialLibrary = {
        materials: {},
        gridTexture: null,
        
        // Material categories for easy management
        categories: {
            structural: [],
            metal: [],
            organic: [],
            painted: []
        },
        
        init() {
            console.log('MaterialLibrary: Building enhanced PBR materials...');
            
            // Create textures
            this.gridTexture = this.createGridTexture();
            
            // Color palette
            const colors = {
                wood: 0x8f6a4e,
                containerBlue: 0x2c5a85,
                concreteBase: 0x555555,
                floorBase: 0x777777,
                wallBase: 0xcccccc 
            };
            
            // ===== STRUCTURAL MATERIALS =====
            
            // Floor - Polished concrete with slight reflectivity
            this.materials.floor = new THREE.MeshStandardMaterial({
                name: 'floor',
                color: colors.floorBase,
                map: this.gridTexture,
                roughness: 0.9,  // Rougher to remove direct sun reflection
                metalness: 0.0,   // Non-metallic
                envMapIntensity: 0.1,  // Reduced reflection intensity
                aoMapIntensity: 1.0
            });
            this.categories.structural.push(this.materials.floor);
            
            // Wall - Painted concrete
            this.materials.wall = new THREE.MeshStandardMaterial({
                name: 'wall',
                color: colors.wallBase,
                map: this.gridTexture,
                roughness: 1.0,   // FULLY ROUGH to prevent specular bloom on white surface
                metalness: 0.0,
                envMapIntensity: 0.05, // Minimal environment reflection
                aoMapIntensity: 1.2
            });
            this.categories.structural.push(this.materials.wall);
            
            // Platform - Metal grating (The Ramps)
            this.materials.platform = new THREE.MeshStandardMaterial({
                name: 'platform',
                color: 0xaaaaaa, 
                map: this.gridTexture,
                roughness: 1.0,  // FULLY ROUGH to prevent specular bloom
                metalness: 0.0,   // Removed metalness to avoid shine
                envMapIntensity: 0.1, 
                aoMapIntensity: 1.0
            });
            this.categories.structural.push(this.materials.platform);
            
            // Cover - Tactical barrier material
            this.materials.cover = new THREE.MeshStandardMaterial({
                name: 'cover',
                color: 0x557799,
                map: this.gridTexture,
                roughness: 0.6,
                metalness: 0.3,
                envMapIntensity: 0.5,
                aoMapIntensity: 1.1
            });
            this.categories.structural.push(this.materials.cover);
            
            // ===== CONCRETE/STONE MATERIALS =====
            
            // Concrete barriers - Rough, porous surface
            this.materials.concrete = new THREE.MeshStandardMaterial({
                name: 'concrete',
                color: colors.concreteBase,
                roughness: 0.95,  // Very rough, diffuse
                metalness: 0.0,
                envMapIntensity: 0.1,  // Minimal reflections
                aoMapIntensity: 1.3    // Enhanced AO for depth
            });
            this.categories.structural.push(this.materials.concrete);
            
            // ===== METAL MATERIALS =====
            
            // Painted metal barrel - Red
            this.materials.barrelRed = new THREE.MeshStandardMaterial({
                name: 'barrelRed',
                color: 0xaa2222, 
                roughness: 0.7,   
                metalness: 0.2,   
                envMapIntensity: 0.3, 
                aoMapIntensity: 1.0
            });
            this.categories.metal.push(this.materials.barrelRed);
            
            // Shipping containers - Painted steel
            this.materials.containerBlue = new THREE.MeshStandardMaterial({
                name: 'containerBlue',
                color: colors.containerBlue,
                roughness: 0.5,   
                metalness: 0.4,
                envMapIntensity: 0.6,
                aoMapIntensity: 1.1
            });
            this.categories.painted.push(this.materials.containerBlue);
            
            // Rusty container
            this.materials.containerRust = new THREE.MeshStandardMaterial({
                name: 'containerRust',
                color: 0xcd7f32,
                roughness: 0.85,  
                metalness: 0.2,   
                envMapIntensity: 0.3,
                aoMapIntensity: 1.2
            });
            this.categories.painted.push(this.materials.containerRust);
            
            // ===== ORGANIC MATERIALS =====
            
            // Wood pallets - Natural wood
            this.materials.palletWood = new THREE.MeshStandardMaterial({
                name: 'palletWood',
                color: colors.wood,
                roughness: 0.9,   
                metalness: 0.0,
                envMapIntensity: 0.15,  
                aoMapIntensity: 1.4     
            });
            this.categories.organic.push(this.materials.palletWood);
            
            // Enable shadow receiving on all materials
            Object.values(this.materials).forEach(mat => {
                if (mat.isMaterial) {
                    // Enable features for better lighting
                    mat.shadowSide = THREE.FrontSide;
                    
                    // Ensure proper light interaction
                    mat.needsUpdate = true;
                }
            });
            
            console.log('MaterialLibrary: ✓ Enhanced PBR materials ready');
            console.log(`  - ${this.categories.structural.length} structural materials`);
            console.log(`  - ${this.categories.metal.length} metal materials`);
            console.log(`  - ${this.categories.painted.length} painted materials`);
            console.log(`  - ${this.categories.organic.length} organic materials`);
        },
        
        createGridTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Background - Clean base
            ctx.fillStyle = '#999999';
            ctx.fillRect(0, 0, 512, 512);
            
            // Grid lines - sharper edges
            ctx.strokeStyle = '#777777';
            ctx.lineWidth = 4; 
            ctx.strokeRect(0, 0, 512, 512);
            
            // Inner fill - slightly lighter
            ctx.fillStyle = '#aaaaaa';
            ctx.fillRect(4, 4, 504, 504);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.anisotropy = 16;  // Maximum anisotropic filtering
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            return texture;
        },
        
        getMaterial(name) {
            return this.materials[name] || this.materials.floor;
        },
        
        // Update environment map intensity for all materials
        updateEnvironmentIntensity(intensity) {
            Object.values(this.materials).forEach(mat => {
                if (mat.isMaterial && mat.envMapIntensity !== undefined) {
                    const baseMult = mat.envMapIntensity / (mat.userData.baseEnvIntensity || 1.0);
                    mat.envMapIntensity = baseMult * intensity;
                    mat.needsUpdate = true;
                }
            });
        },
        
        // Update AO intensity for all materials
        updateAOIntensity(intensity) {
            Object.values(this.materials).forEach(mat => {
                if (mat.isMaterial && mat.aoMapIntensity !== undefined) {
                    mat.aoMapIntensity = intensity;
                    mat.needsUpdate = true;
                }
            });
        }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.MaterialLibrary = MaterialLibrary;
})();
