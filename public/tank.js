// tank.js - Tank model creation with selection

function createTank(tankType) {
    switch (tankType) {
      case 'merkava':
        return createMerkavaTank();
      case 'heavy':
        return Promise.resolve(createHeavyTank());
      case 'sniper':
        return Promise.resolve(createSniperTank());
      case 'starter':
      default:
        return Promise.resolve(createStarterTank());
    }
  }
  
  function createStarterTank() {
    console.log('Creating Starter Tank');
    const group = new THREE.Group();
  
    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.8, 2);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x006400 }); // Dark green
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.4;
    group.add(body);
  
    const turretGeometry = new THREE.BoxGeometry(0.8, 0.4, 1);
    const turretMaterial = new THREE.MeshBasicMaterial({ color: 0x228b22 }); // Forest green
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 0.8;
    turret.position.z = -0.2;
    group.add(turret);
  
    const barrelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 16);
    const barrelMaterial = new THREE.MeshBasicMaterial({ color: 0x2e8b57 }); // Sea green
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.y = 0.8;
    barrel.position.z = -0.7;
    group.add(barrel);
  
    const { healthBar, smoke, fire } = createTankEffects();
    group.add(healthBar, smoke, fire);
  
    group.userData = { hp: 100, maxHP: 100, damage: 10, tankType: 'starter', name: '', healthBar, smoke, smokeCount: 0, fire, fireCount: 0 };
    console.log('Starter Tank created:', group);
    return group;
  }
  
  function createHeavyTank() {
    console.log('Creating Heavy Tank');
    const group = new THREE.Group();
  
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 2.5); // Larger body
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x4b2e2e }); // Dark red-brown
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    group.add(body);
  
    const turretGeometry = new THREE.BoxGeometry(1, 0.5, 1.2);
    const turretMaterial = new THREE.MeshBasicMaterial({ color: 0x8b0000 }); // Dark red
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 1.0;
    turret.position.z = -0.3;
    group.add(turret);
  
    const barrelGeometry = new THREE.CylinderGeometry(0.15, 0.15, 2, 16); // Thicker barrel
    const barrelMaterial = new THREE.MeshBasicMaterial({ color: 0xa52a2a }); // Brown red
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.y = 1.0;
    barrel.position.z = -1.0;
    group.add(barrel);
  
    const { healthBar, smoke, fire } = createTankEffects();
    group.add(healthBar, smoke, fire);
  
    group.userData = { hp: 150, maxHP: 150, damage: 15, tankType: 'heavy', name: '', healthBar, smoke, smokeCount: 0, fire, fireCount: 0 };
    console.log('Heavy Tank created:', group);
    return group;
  }
  
  function createSniperTank() {
    console.log('Creating Sniper Tank');
    const group = new THREE.Group();
  
    const bodyGeometry = new THREE.BoxGeometry(1.2, 0.6, 1.8); // Slimmer body
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x4682b4 }); // Steel blue
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.3;
    group.add(body);
  
    const turretGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.8);
    const turretMaterial = new THREE.MeshBasicMaterial({ color: 0x5f9ea0 }); // Cadet blue
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 0.6;
    turret.position.z = -0.1;
    group.add(turret);
  
    const barrelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 16); // Longer, thinner barrel
    const barrelMaterial = new THREE.MeshBasicMaterial({ color: 0x87ceeb }); // Sky blue
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.y = 0.6;
    barrel.position.z = -1.2;
    group.add(barrel);
  
    const { healthBar, smoke, fire } = createTankEffects();
    group.add(healthBar, smoke, fire);
  
    group.userData = { hp: 80, maxHP: 80, damage: 20, tankType: 'sniper', name: '', healthBar, smoke, smokeCount: 0, fire, fireCount: 0 };
    console.log('Sniper Tank created:', group);
    return group;
  }
  
  function createMerkavaTank() {
    console.log('Creating Merkava Tank');
    const group = new THREE.Group();
  
    const mtlLoader = new THREE.MTLLoader();
    mtlLoader.setPath('/tanks/merkava/');
    const objLoader = new THREE.OBJLoader();
  
    return new Promise((resolve) => {
      console.log('Attempting to load MTL: /tanks/merkava/merkava.mtl');
      mtlLoader.load('merkava.mtl', (materials) => {
        console.log('MTL loaded successfully');
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.setPath('/tanks/merkava/');
        console.log('Attempting to load OBJ: /tanks/merkava/merkava.obj');
        objLoader.load('merkava.obj', (object) => {
          console.log('OBJ loaded successfully');
          object.scale.set(0.05, 0.05, 0.05); // Half the previous size (was 0.1)
          object.rotation.x = -Math.PI / 2; // Align with ground
  
          // Log and adjust material
          object.traverse((child) => {
            if (child.isMesh) {
              console.log('Original Merkava mesh material:', child.material);
              const materialName = child.material.name;
              let newColor;
              switch (materialName) {
                case 'color_6306067':
                  newColor = new THREE.Color(0.376, 0.224, 0.075); // Dark brown
                  break;
                case 'color_14860437':
                  newColor = new THREE.Color(0.886, 0.753, 0.584); // Light tan
                  break;
                case 'color_11107152':
                  newColor = new THREE.Color(0.663, 0.482, 0.314); // Medium brown
                  break;
                default:
                  newColor = new THREE.Color(0x808080); // Fallback gray
                  console.log('Unknown material name, using gray fallback');
              }
              child.material = new THREE.MeshBasicMaterial({ color: newColor });
              console.log(`Set Merkava material ${materialName} to color:`, newColor);
            }
          });
  
          group.add(object);
  
          const { healthBar, smoke, fire } = createTankEffects();
          group.add(healthBar, smoke, fire);
  
          group.userData = { hp: 200, maxHP: 200, damage: 8, tankType: 'merkava', name: '', healthBar, smoke, smokeCount: 0, fire, fireCount: 0 };
          console.log('Merkava Tank created successfully:', group);
          resolve(group);
        }, undefined, (error) => {
          console.error('Error loading Merkava OBJ:', error);
          console.log('Falling back to Starter Tank due to OBJ failure');
          resolve(createStarterTank());
        });
      }, undefined, (error) => {
        console.error('Error loading Merkava MTL:', error);
        console.log('Falling back to Starter Tank due to MTL failure');
        resolve(createStarterTank());
      });
    });
  }
  
  // Helper function to create common tank effects (health bar, smoke, fire)
  function createTankEffects() {
    const healthBarGeometry = new THREE.PlaneGeometry(1, 0.2);
    const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
    healthBar.position.y = 1.5;
    healthBar.rotation.x = Math.PI / 2;
  
    const smokeGeometry = new THREE.BufferGeometry();
    const smokeVertices = new Float32Array(100 * 3);
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokeVertices, 3));
    const smokeMaterial = new THREE.PointsMaterial({ color: 0x888888, size: 0.2, transparent: true, opacity: 0.6 });
    const smoke = new THREE.Points(smokeGeometry, smokeMaterial);
    smoke.position.y = 0.6;
  
    const fireGeometry = new THREE.BufferGeometry();
    const fireVertices = new Float32Array(100 * 3);
    fireGeometry.setAttribute('position', new THREE.BufferAttribute(fireVertices, 3));
    const fireMaterial = new THREE.PointsMaterial({ color: 0xff4500, size: 0.15, transparent: true, opacity: 0.8 });
    const fire = new THREE.Points(fireGeometry, fireMaterial);
    fire.position.y = 0.6;
  
    return { healthBar, smoke, fire };
  }