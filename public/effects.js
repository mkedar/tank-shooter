// Update health bar (visual effects only)
function updateHealthBar(player) {
    const hp = player.userData.hp;
    const healthBar = player.userData.healthBar;
    if (!healthBar) {
      console.error(`Health bar missing for player ${player}`);
      return;
    }
    healthBar.scale.x = Math.max(0, hp / 100);
    healthBar.material.color.setHSL(hp / 100, 1, 0.5);
    healthBar.visible = true;
  
    const smoke = player.userData.smoke;
    let smokeCount = 0;
    if (hp <= 50 && hp > 20) smokeCount = 20;
    else if (hp <= 20 && hp > 0) smokeCount = 30;
  
    if (smokeCount !== player.userData.smokeCount) {
      player.userData.smokeCount = smokeCount;
      const positions = smoke.geometry.attributes.position.array;
      for (let i = 0; i < smokeCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 1.5;
        positions[i + 1] = Math.random() * 0.5 + 0.6;
        positions[i + 2] = (Math.random() - 0.5) * 1.5;
      }
      smoke.geometry.setDrawRange(0, smokeCount);
      smoke.geometry.attributes.position.needsUpdate = true;
    }
  
    if (smokeCount > 0) {
      const positions = smoke.geometry.attributes.position.array;
      for (let i = 0; i < smokeCount * 3; i += 3) {
        positions[i + 1] += 0.01;
        if (positions[i + 1] > 1.6) {
          positions[i] = (Math.random() - 0.5) * 1.5;
          positions[i + 1] = 0.6;
          positions[i + 2] = (Math.random() - 0.5) * 1.5;
        }
      }
      smoke.geometry.attributes.position.needsUpdate = true;
    }
  
    const fire = player.userData.fire;
    let fireCount = hp <= 20 && hp > 0 ? 20 : 0;
  
    if (fireCount !== player.userData.fireCount) {
      player.userData.fireCount = fireCount;
      const positions = fire.geometry.attributes.position.array;
      for (let i = 0; i < fireCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 1.0;
        positions[i + 1] = Math.random() * 0.3 + 0.6;
        positions[i + 2] = (Math.random() - 0.5) * 1.0;
      }
      fire.geometry.setDrawRange(0, fireCount);
      fire.geometry.attributes.position.needsUpdate = true;
    }
  
    if (fireCount > 0) {
      const positions = fire.geometry.attributes.position.array;
      for (let i = 0; i < fireCount * 3; i += 3) {
        positions[i + 1] += 0.02;
        if (positions[i + 1] > 1.2) {
          positions[i] = (Math.random() - 0.5) * 1.0;
          positions[i + 1] = 0.6;
          positions[i + 2] = (Math.random() - 0.5) * 1.0;
        }
      }
      fire.geometry.attributes.position.needsUpdate = true;
    }
  }
  
  // Spawn smoke effect on impact
  function spawnImpactSmoke(x, y, z) {
    const smokeGeometry = new THREE.BufferGeometry();
    const smokeVertices = new Float32Array(10 * 3); // Small burst of 10 particles
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokeVertices, 3));
    const smokeMaterial = new THREE.PointsMaterial({ color: 0x888888, size: 0.1, transparent: true, opacity: 0.7 });
    const smoke = new THREE.Points(smokeGeometry, smokeMaterial);
    smoke.position.set(x, y, z);
    scene.add(smoke);
  
    const positions = smoke.geometry.attributes.position.array;
    for (let i = 0; i < 10 * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 0.3;
      positions[i + 1] = Math.random() * 0.2 + y;
      positions[i + 2] = (Math.random() - 0.5) * 0.3;
    }
    smoke.geometry.setDrawRange(0, 10);
    smoke.geometry.attributes.position.needsUpdate = true;
  
    let lifetime = 0;
    const smokeInterval = setInterval(() => {
      lifetime += 16;
      const positions = smoke.geometry.attributes.position.array;
      for (let i = 0; i < 10 * 3; i += 3) {
        positions[i + 1] += 0.02;
      }
      smoke.geometry.attributes.position.needsUpdate = true;
  
      if (lifetime > 500) { // Fade out after 0.5 seconds
        scene.remove(smoke);
        clearInterval(smokeInterval);
      }
    }, 16);
  }