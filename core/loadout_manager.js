
// js/core/loadout_manager.js
(function() {
    window.TacticalShooter = window.TacticalShooter || {};
    
    const LoadoutManager = {
        // Current Loadout Configuration
        loadout: {
            primary: null,    // e.g., "M4A1" (Future)
            secondary: "PISTOL", // Default
            equipment: null
        },
        
        // Active Slot state
        activeSlot: "secondary", // "primary", "secondary"
        
        init() {
            console.log('LoadoutManager: Initializing...');
            // In the future, this would load from a saved profile or network payload
            this.validateLoadout();
        },
        
        validateLoadout() {
            // Ensure configured weapons actually exist in GameData
            const db = window.TacticalShooter.GameData.Weapons;
            
            if (this.loadout.primary && !db[this.loadout.primary]) {
                console.warn(`LoadoutManager: Primary weapon ${this.loadout.primary} invalid. Removed.`);
                this.loadout.primary = null;
            }
            if (this.loadout.secondary && !db[this.loadout.secondary]) {
                console.warn(`LoadoutManager: Secondary weapon ${this.loadout.secondary} invalid. Defaulting to PISTOL.`);
                this.loadout.secondary = "PISTOL";
            }
        },
        
        getActiveWeaponDef() {
            const weaponId = this.loadout[this.activeSlot];
            if (!weaponId) return null;
            
            const def = window.TacticalShooter.GameData.Weapons[weaponId];
            if (!def) {
                console.error(`LoadoutManager: Weapon ID ${weaponId} not found in database!`);
                return null;
            }
            return def;
        },
        
        switchWeapon(slot) {
            if (this.loadout[slot]) {
                this.activeSlot = slot;
                console.log(`LoadoutManager: Switched to ${slot} (${this.loadout[slot]})`);
                return this.getActiveWeaponDef();
            }
            return null;
        }
    };
    
    window.TacticalShooter.LoadoutManager = LoadoutManager;
})();
