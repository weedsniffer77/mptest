
// js/render/shader/post_processor.js
(function() {
    const PostProcessor = {
        renderer: null,
        scene: null,
        camera: null,
        composer: null,
        renderPass: null,
        ssaoPass: null,
        bloomPass: null,
        outputPass: null,
        enabled: true,
        settings: {
            ssao: { enabled: false, kernelRadius: 16, minDistance: 0.005, maxDistance: 0.1 },
            bloom: { enabled: true, strength: 0.8, radius: 0.4, threshold: 0.9 },
            toneMapping: { enabled: true, exposure: 1.0 }
        },
        
        init(renderer, scene, camera, lightingData) {
            this.renderer = renderer;
            this.scene = scene;
            this.camera = camera;
            
            if (!renderer || !scene || !camera) {
                console.warn('PostProcessor: Invalid init params');
                return;
            }
            
            this.composer = new window.EffectComposer(renderer);
            this.renderPass = new window.RenderPass(scene, camera);
            this.composer.addPass(this.renderPass);
            
            if (window.SSAOPass && this.settings.ssao.enabled) {
                try { this.initSSAO(); } catch (e) { console.warn('SSAO Failed', e); }
            }
            
            const bConfig = (lightingData && lightingData.postProcessing && lightingData.postProcessing.bloom) 
                ? lightingData.postProcessing.bloom : this.settings.bloom;
            this.initBloom(bConfig);
            
            this.initToneMapping();
            
            this.outputPass = new window.OutputPass();
            this.composer.addPass(this.outputPass);
        },
        
        initSSAO() {
            this.ssaoPass = new window.SSAOPass(this.scene, this.camera);
            this.ssaoPass.kernelRadius = this.settings.ssao.kernelRadius;
            this.ssaoPass.minDistance = this.settings.ssao.minDistance;
            this.ssaoPass.maxDistance = this.settings.ssao.maxDistance;
            this.ssaoPass.enabled = this.settings.ssao.enabled;
            this.composer.addPass(this.ssaoPass);
        },
        
        initBloom(settings) {
            this.bloomPass = new window.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                settings.strength, settings.radius, settings.threshold
            );
            if (this.settings.bloom.enabled) this.composer.addPass(this.bloomPass);
        },
        
        initToneMapping() {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = this.settings.toneMapping.exposure;
        },
        
        render(dt) {
            if (!this.enabled || !this.composer) {
                if (this.renderer && this.scene && this.camera) {
                    this.renderer.render(this.scene, this.camera);
                }
                return;
            }
            this.composer.render(dt);
        },
        
        resize(width, height) {
            if (this.composer) this.composer.setSize(width, height);
            if (this.ssaoPass) this.ssaoPass.setSize(width, height);
        }
    };
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.PostProcessor = PostProcessor;
})();
