
// js/ui/tactical_map/tactical_camera.js
(function() {
    const TacticalCamera = {
        camera: null,
        isActive: false,

        init() {
            // Frustum size 80 units wide (matches Killhouse map width)
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 100;
            
            this.camera = new THREE.OrthographicCamera(
                frustumSize * aspect / -2,
                frustumSize * aspect / 2,
                frustumSize / 2,
                frustumSize / -2,
                1,
                1000
            );
            
            // Looking straight down
            this.camera.position.set(0, 100, 0);
            this.camera.lookAt(0, 0, 0);
            this.camera.rotation.z = Math.PI; // Orient so 'Up' is North?
            
            window.addEventListener('resize', () => this.onResize());
        },

        activate() {
            this.isActive = true;
            this.onResize(); // Ensure aspect is correct
        },

        deactivate() {
            this.isActive = false;
        },

        onResize() {
            if (!this.camera) return;
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = 100; // Constant map scale
            
            this.camera.left = -frustumSize * aspect / 2;
            this.camera.right = frustumSize * aspect / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = -frustumSize / 2;
            this.camera.updateProjectionMatrix();
        }
    };

    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.TacticalCamera = TacticalCamera;
})();
