
// js/core/input_manager.js
(function() {
    const InputManager = {
        keys: {},
        justPressed: {}, // Track frames where key was first pressed
        
        mouse: {
            movementX: 0,
            movementY: 0
        },
        
        // Default Bindings
        bindings: {
            Forward: 'KeyW',
            Backward: 'KeyS',
            Left: 'KeyA',
            Right: 'KeyD',
            Jump: 'Space',
            Crouch: 'ControlLeft',
            Prone: 'KeyP', 
            Sprint: 'ShiftLeft',
            ADS: 'KeyC', 
            Shoot: 'Mouse0', 
            LeanLeft: 'KeyQ',
            LeanRight: 'KeyE',
            Reload: 'KeyR',
            Inspect: 'KeyF',
            FreeCursor: 'AltLeft',
            Scoreboard: 'Tab', // New
            Menu: 'Escape'
        },
        
        defaultBindings: null,

        init() {
            console.log('InputManager: Initializing...');
            
            // Store defaults
            this.defaultBindings = { ...this.bindings };
            
            document.addEventListener('keydown', (e) => {
                if (!this.keys[e.code]) {
                    this.justPressed[e.code] = true;
                }
                this.keys[e.code] = true;
                
                // Allow UIManager to intercept keys for rebinding
                if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.listeningForKey) {
                    window.TacticalShooter.UIManager.handleRebind(e.code);
                    return;
                }

                // Handle Tab for Scoreboard (prevent focus shift)
                if (e.code === 'Tab') {
                    e.preventDefault();
                    if (window.TacticalShooter.UIManager) window.TacticalShooter.UIManager.toggleScoreboard(true);
                }

                // Hardcoded Menu Toggle for safety, mapped to action
                if (e.code === this.bindings.Menu || e.code === 'Escape') {
                    // Prevent toggling if in Menu Mode AND NOT in Lobby (i.e., prevent in Main Menu Connection screen, but allow in Lobby)
                    const GM = window.TacticalShooter.GameManager;
                    if (GM && GM.isMenuMode && GM.currentState !== 'LOBBY') return;
                    
                    // Prevent Menu if Dead (KIA screen is active)
                    const PS = window.TacticalShooter.PlayerState;
                    if (PS && PS.isDead) return;

                    if (window.TacticalShooter.UIManager) {
                        window.TacticalShooter.UIManager.toggleMenu();
                    }
                }
            });
            
            document.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
                this.justPressed[e.code] = false;
                
                if (e.code === 'Tab') {
                    if (window.TacticalShooter.UIManager) window.TacticalShooter.UIManager.toggleScoreboard(false);
                }
            });
            
            document.addEventListener('mousemove', (e) => {
                if (document.pointerLockElement === document.getElementById('game-canvas')) {
                    this.mouse.movementX = e.movementX || 0;
                    this.mouse.movementY = e.movementY || 0;
                }
            });
            
            document.addEventListener('mousedown', (e) => {
                const code = `Mouse${e.button}`;
                if (!this.keys[code]) {
                    this.justPressed[code] = true;
                }
                this.keys[code] = true;

                // Rebinding support for mouse
                if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.listeningForKey) {
                    // Prevent default click actions in UI during rebind
                    e.preventDefault(); 
                    e.stopPropagation();
                    window.TacticalShooter.UIManager.handleRebind(code);
                    return;
                }
            });
            
            document.addEventListener('mouseup', (e) => {
                const code = `Mouse${e.button}`;
                this.keys[code] = false;
                this.justPressed[code] = false;
            });
            
            document.addEventListener('contextmenu', (e) => e.preventDefault());
            
            const canvas = document.getElementById('game-canvas');
            const overlay = document.getElementById('pointer-lock-overlay');
            
            overlay.addEventListener('click', () => {
                canvas.requestPointerLock();
            });
            
            document.addEventListener('pointerlockchange', () => {
                if (document.pointerLockElement === canvas) {
                    overlay.classList.add('hidden');
                    if (window.TacticalShooter.UIManager) {
                        window.TacticalShooter.UIManager.closeMenu();
                    }
                } else {
                    // UNLOCKED
                    
                    // 1. DEATH CHECK: If dead, ensure cursor is visible and STOP here (don't open menu)
                    if (window.TacticalShooter.PlayerState && window.TacticalShooter.PlayerState.isDead) {
                        if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.cursorElement) {
                            window.TacticalShooter.UIManager.cursorElement.style.display = 'block';
                        }
                        return; 
                    }

                    // 2. Intentional Unlock via Free Cursor Key
                    const freeCursorKey = this.bindings.FreeCursor;
                    if (this.keys[freeCursorKey]) {
                        // Just show cursor, no menu
                        if (window.TacticalShooter.UIManager) {
                             // Assuming UIManager handles cursor logic based on pointer lock state already, 
                             // but we reinforce it here implicitly by doing nothing.
                        }
                    } else {
                        // 3. Unintentional/ESC Unlock: Open Menu
                        const multiplayerMenu = document.getElementById('multiplayer-menu');
                        // If we are in the main menu (pre-game), do not trigger in-game menu logic
                        if (multiplayerMenu && multiplayerMenu.style.display !== 'none') {
                            return; 
                        }
                        
                        if (window.TacticalShooter.UIManager) {
                            if (overlay.classList.contains('hidden')) {
                                window.TacticalShooter.UIManager.openMenu();
                            } else {
                                overlay.classList.remove('hidden');
                            }
                        } else {
                            overlay.classList.remove('hidden');
                        }
                    }
                }
            });
            
            console.log('InputManager: ✓ Ready');
        },
        
        resetBindings() {
            if (this.defaultBindings) {
                this.bindings = { ...this.defaultBindings };
            }
        },
        
        update() {
            // Reset per-frame deltas
            this.mouse.movementX = 0;
            this.mouse.movementY = 0;
            
            // Clear justPressed for next frame? 
            // Actually, we clear them in update() to ensure they persist for exactly one game frame
            for (const key in this.justPressed) {
                this.justPressed[key] = false;
            }

            // Free Cursor Logic
            const freeCode = this.bindings.FreeCursor;
            const canvas = document.getElementById('game-canvas');
            
            if (this.keys[freeCode]) {
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
            } else {
                // If we released FreeCursor, and menu is NOT open, try to re-lock
                if (window.TacticalShooter.UIManager && !window.TacticalShooter.UIManager.isMenuOpen) {
                     // Check if we are "supposed" to be playing (overlay hidden)
                     const overlay = document.getElementById('pointer-lock-overlay');
                     if (overlay && overlay.classList.contains('hidden')) {
                         // Also check we aren't dead - NEW CHECK HERE
                         if (window.TacticalShooter.PlayerState && !window.TacticalShooter.PlayerState.isDead) {
                             if (!document.pointerLockElement) {
                                 canvas.requestPointerLock();
                             }
                         }
                     }
                }
            }
        },
        
        isKeyPressed(code) {
            if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.isMenuOpen) return false;
            return this.keys[code] || false;
        },
        
        isActionActive(actionName) {
            if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.isMenuOpen) return false;
            const code = this.bindings[actionName];
            return code ? (this.keys[code] || false) : false;
        },

        wasActionJustPressed(actionName) {
            if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.isMenuOpen) return false;
            const code = this.bindings[actionName];
            return code ? (this.justPressed[code] || false) : false;
        },

        getBinding(actionName) {
            return this.bindings[actionName] || '???';
        },
        
        setBinding(actionName, code) {
            this.bindings[actionName] = code;
        },
        
        getMouseDelta() {
            if (window.TacticalShooter.UIManager && window.TacticalShooter.UIManager.isMenuOpen) return { x: 0, y: 0 };
            return { x: this.mouse.movementX, y: this.mouse.movementY };
        },
        
        // Legacy Support (Mapped to Actions now)
        isMouseLeftPressed() { return this.isActionActive('Shoot'); },
        isMouseRightPressed() { return this.isActionActive('ADS'); },
        wasMouseLeftClicked() { return this.wasActionJustPressed('Shoot'); }
    };
    
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.InputManager = InputManager;
})();
