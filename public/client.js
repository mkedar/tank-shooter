// Client.js - Player and game logic
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let playerId;
const players = {};
const rotateSpeed = 0.0225;
const lookSensitivity = 0.002;
const shootInterval = 100;
let lastShot = 0;
camera.position.y = 1.0;
let isAlive = true;
const kills = {};
let bulletsLeft = 30;
const maxBullets = 30;
let isReloading = false;
const reloadTime = 3000;
const keys = {};

const tankTypes = {
  starter: { maxHP: 100, damage: 10, moveSpeed: 0.075, pelletSpeed: 0.5 },
  heavy: { maxHP: 150, damage: 15, moveSpeed: 0.05, pelletSpeed: 0.4 },
  sniper: { maxHP: 80, damage: 20, moveSpeed: 0.06, pelletSpeed: 0.7 },
  merkava: { maxHP: 200, damage: 8, moveSpeed: 0.075, pelletSpeed: 0.5 }
};

let isThirdPerson = true;
const thirdPersonOffset = new THREE.Vector3(0, 3, 5);
const cameraLerpSpeed = 0.05;
let lastMouseMove = 0;
let yaw = 0;
let pitch = 0;

let selectedTank = null;
let username = 'Unnamed';
let ws;

const healthBoxes = {};

const modal = document.getElementById('tankSelectionModal');
const modalContent = document.getElementById('modalContent');
const startGameBtn = document.getElementById('startGame');

document.querySelectorAll('.tank-option').forEach(option => {
  option.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.tank-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedTank = option.dataset.tank;
  });
});

modalContent.addEventListener('click', (e) => e.stopPropagation());

startGameBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!selectedTank) {
    alert('Please select a tank!');
    return;
  }
  username = document.getElementById('username').value.trim() || 'Unnamed';
  modal.style.display = 'none';
  startGame();
});

function checkCollision(newPos) {
  const playerRadius = 0.75;
  for (const id in players) {
    if (id !== playerId && players[id].userData.hp > 0) {
      const otherPos = players[id].position;
      const dx = newPos.x - otherPos.x;
      const dz = newPos.z - otherPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < playerRadius * 2) return true;
    }
  }
  for (const building of buildings) {
    const box = new THREE.Box3().setFromObject(building);
    if (box.containsPoint(newPos)) return true;
  }
  return false;
}

const deathScreen = document.createElement('div');
deathScreen.style.position = 'absolute';
deathScreen.style.top = '50%';
deathScreen.style.left = '50%';
deathScreen.style.transform = 'translate(-50%, -50%)';
deathScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
deathScreen.style.color = 'white';
deathScreen.style.padding = '20px';
deathScreen.style.fontFamily = 'Arial';
deathScreen.style.fontSize = '24px';
deathScreen.style.display = 'none';
deathScreen.innerHTML = `
  <p>You died!</p>
  <button id="respawnBtn" style="font-size: 20px; padding: 10px;">Respawn</button>
`;
document.body.appendChild(deathScreen);

const killCounter = document.createElement('div');
killCounter.style.position = 'absolute';
killCounter.style.top = '10px';
killCounter.style.right = '10px';
killCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
killCounter.style.color = 'white';
killCounter.style.padding = '10px';
killCounter.style.fontFamily = 'Arial';
killCounter.style.fontSize = '16px';
document.body.appendChild(killCounter);

function updateKillCounter() {
  let leaderboardText = 'Leaderboard (Kills This Life):\n';
  const sortedPlayers = Object.entries(kills).sort(([, a], [, b]) => b - a);
  for (const [id, killCount] of sortedPlayers) {
    const name = players[id]?.userData?.name || 'Unnamed';
    leaderboardText += `${name}: ${killCount} kills\n`;
  }
  killCounter.innerText = leaderboardText.trim() || 'No kills yet';
}

const ammoCounter = document.createElement('div');
ammoCounter.style.position = 'absolute';
ammoCounter.style.bottom = '10px';
ammoCounter.style.right = '10px';
ammoCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
ammoCounter.style.color = 'white';
ammoCounter.style.padding = '10px';
ammoCounter.style.fontFamily = 'Arial';
ammoCounter.style.fontSize = '16px';
document.body.appendChild(ammoCounter);

function updateAmmoCounter() {
  ammoCounter.innerText = isReloading ? `Reloading... (${(reloadTime / 1000).toFixed(1)}s)` : `Ammo: ${bulletsLeft}/${maxBullets}`;
}

const killFeed = document.createElement('div');
killFeed.style.position = 'absolute';
killFeed.style.bottom = '10px';
killFeed.style.left = '10px';
killFeed.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
killFeed.style.color = 'white';
killFeed.style.padding = '10px';
killFeed.style.fontFamily = 'Arial';
killFeed.style.fontSize = '16px';
killFeed.style.maxHeight = '100px';
killFeed.style.overflowY = 'auto';
document.body.appendChild(killFeed);

const killMessages = [];
let killFeedTimeout = null;
function updateKillFeed(killerName, victimId) {
  const victimName = players[victimId]?.userData?.name || 'Unnamed';
  killMessages.unshift(`${killerName} killed ${victimName}`);
  if (killMessages.length > 5) killMessages.pop();
  killFeed.innerText = killMessages.join('\n');
  
  if (killFeedTimeout) clearTimeout(killFeedTimeout);
  killFeedTimeout = setTimeout(() => {
    killMessages.length = 0;
    killFeed.innerText = '';
    killFeedTimeout = null;
  }, 7000);
}

const healthBarUI = document.createElement('div');
healthBarUI.style.position = 'absolute';
healthBarUI.style.bottom = '10px';
healthBarUI.style.left = '50%';
healthBarUI.style.transform = 'translateX(-50%)';
healthBarUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
healthBarUI.style.color = 'white';
healthBarUI.style.padding = '10px';
healthBarUI.style.fontFamily = 'Arial';
healthBarUI.style.fontSize = '16px';
document.body.appendChild(healthBarUI);

function updateHealthBarUI() {
  const hp = players[playerId]?.userData.hp || 0;
  const maxHP = players[playerId]?.userData.maxHP || 100;
  healthBarUI.innerText = `Health: ${hp}/${maxHP}`;
}

const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none';
document.body.appendChild(crosshair);

const lineLength = 10;
const lineThickness = 2;

const topLine = document.createElement('div');
topLine.style.width = `${lineThickness}px`;
topLine.style.height = `${lineLength}px`;
topLine.style.backgroundColor = 'limegreen';
topLine.style.position = 'absolute';
topLine.style.left = '50%';
topLine.style.top = `-${lineLength}px`;
topLine.style.transform = 'translateX(-50%)';
crosshair.appendChild(topLine);

const bottomLine = document.createElement('div');
bottomLine.style.width = `${lineThickness}px`;
bottomLine.style.height = `${lineLength}px`;
bottomLine.style.backgroundColor = 'limegreen';
bottomLine.style.position = 'absolute';
bottomLine.style.left = '50%';
bottomLine.style.top = '0';
bottomLine.style.transform = 'translateX(-50%)';
crosshair.appendChild(bottomLine); // Fixed to bottomLine

const leftLine = document.createElement('div');
leftLine.style.width = `${lineLength}px`;
leftLine.style.height = `${lineThickness}px`;
leftLine.style.backgroundColor = 'limegreen';
leftLine.style.position = 'absolute';
leftLine.style.left = `-${lineLength}px`;
leftLine.style.top = '50%';
leftLine.style.transform = 'translateY(-50%)';
crosshair.appendChild(leftLine);

const rightLine = document.createElement('div');
rightLine.style.width = `${lineLength}px`;
rightLine.style.height = `${lineThickness}px`;
rightLine.style.backgroundColor = 'limegreen';
rightLine.style.position = 'absolute';
rightLine.style.left = '0';
rightLine.style.top = '50%';
rightLine.style.transform = 'translateY(-50%)';
crosshair.appendChild(rightLine);

function createHealthBox(id, x, z) {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshBasicMaterial({ color: 0x90ee90 });
  const box = new THREE.Mesh(geometry, material);
  box.position.set(x, 0.25, z);
  box.userData = { id, spawnTime: Date.now() };
  scene.add(box);
  healthBoxes[id] = box;
  console.log(`Created health box ${id} at (${x}, ${z})`);
}

function startGame() {
  console.log(`Starting game with tank: ${selectedTank}, username: ${username}`);

  createTank(selectedTank || 'starter').then(tank => {
    playerId = 'localPlayer';
    players[playerId] = tank;
    scene.add(players[playerId]);
    console.log(`Added local player tank to scene at (0, 0, 0)`);
    players[playerId].position.set(0, 0, 0);
    players[playerId].rotation.y = 0;
    const tankType = selectedTank || 'starter';
    players[playerId].userData.hp = tankTypes[tankType].maxHP;
    players[playerId].userData.maxHP = tankTypes[tankType].maxHP;
    players[playerId].userData.damage = tankTypes[tankType].damage;
    players[playerId].userData.tankType = tankType;
    players[playerId].userData.name = username;
    console.log(`Local player initial HP/maxHP set to: ${players[playerId].userData.hp}/${players[playerId].userData.maxHP}`);
    updateHealthBarUI();

    const tankPos = players[playerId].position.clone();
    const targetPos = tankPos.clone().add(thirdPersonOffset);
    camera.position.copy(targetPos);
    camera.lookAt(tankPos);

    // Dynamic WebSocket URL
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const serverHost = isLocalhost ? 'localhost:8080' : window.location.host;
    ws = new WebSocket(`${wsProtocol}${serverHost}`);

    ws.onopen = () => {
      console.log(`WebSocket connected to ${wsProtocol}${serverHost}`);
      ws.send(JSON.stringify({ type: 'setName', name: username, tankType: tankType }));
    };
    ws.onerror = (err) => console.error('WebSocket error:', err);
    ws.onclose = () => console.log('WebSocket closed');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(`Received: ${JSON.stringify(data)}`);

      switch (data.type) {
        case 'init':
          playerId = data.id;
          console.log(`Server assigned ID: ${playerId}`);
          kills[playerId] = 0;
          if (players['localPlayer']) {
            players[playerId] = players['localPlayer'];
            delete players['localPlayer'];
            console.log(`Updated player ID from localPlayer to ${playerId}`);
          }
          players[playerId].position.set(data.players[playerId].x, data.players[playerId].y, data.players[playerId].z);
          players[playerId].rotation.y = data.players[playerId].rotY || 0;
          players[playerId].userData.hp = data.players[playerId].hp;
          players[playerId].userData.maxHP = data.players[playerId].maxHP;
          players[playerId].userData.damage = data.players[playerId].damage;
          players[playerId].userData.tankType = data.players[playerId].tankType;
          console.log(`Server set player ${playerId} HP/maxHP to: ${players[playerId].userData.hp}/${players[playerId].userData.maxHP}`);
          updateHealthBarUI();

          for (const id in data.players) {
            if (id !== playerId && !players[id]) {
              createTank(data.players[id].tankType).then(tank => {
                players[id] = tank;
                scene.add(players[id]);
                console.log(`Added player ${id} to scene`);
                kills[id] = data.players[id].kills || 0;
                players[id].position.set(data.players[id].x, data.players[id].y, data.players[id].z);
                players[id].rotation.y = data.players[id].rotY || 0;
                players[id].userData.hp = data.players[id].hp;
                players[id].userData.maxHP = data.players[id].maxHP;
                players[id].userData.damage = data.players[id].damage;
                players[id].userData.name = data.players[id].name || 'Unnamed';
                players[id].userData.tankType = data.players[id].tankType;
                console.log(`Server set player ${id} HP/maxHP to: ${players[id].userData.hp}/${players[id].userData.maxHP}`);
                updateHealthBar(players[id]);
              }).catch(err => console.error('Error creating other player tank:', err));
            }
          }
          for (const [id, box] of Object.entries(data.healthBoxes)) {
            createHealthBox(id, box.x, box.z);
          }
          updateKillCounter();
          break;
        case 'newPlayer':
          if (data.id !== playerId && !players[data.id]) {
            createTank(data.tankType).then(tank => {
              players[data.id] = tank;
              scene.add(players[data.id]);
              console.log(`New player ${data.id} added`);
              kills[data.id] = 0;
              players[data.id].position.set(data.x, data.y, data.z);
              players[data.id].rotation.y = data.rotY || 0;
              players[data.id].userData.hp = data.hp;
              players[data.id].userData.maxHP = data.maxHP;
              players[data.id].userData.damage = data.damage;
              players[data.id].userData.name = data.name || 'Unnamed';
              players[data.id].userData.tankType = data.tankType;
              updateHealthBar(players[data.id]);
              updateKillCounter();
            }).catch(err => console.error('Error creating new player tank:', err));
          }
          break;
        case 'playerUpdate':
          if (players[data.id]) {
            const oldTankType = players[data.id].userData.tankType;
            players[data.id].userData.name = data.name;
            players[data.id].userData.tankType = data.tankType;
            players[data.id].userData.maxHP = data.maxHP;
            players[data.id].userData.damage = data.damage;
            players[data.id].position.set(data.x, data.y, data.z);
            players[data.id].rotation.y = data.rotY || 0;
            players[data.id].userData.hp = data.hp;

            if (oldTankType !== data.tankType) {
              console.log(`Tank type changed for ${data.id} from ${oldTankType} to ${data.tankType}`);
              scene.remove(players[data.id]);
              createTank(data.tankType).then(newTank => {
                players[data.id] = newTank;
                scene.add(players[data.id]);
                players[data.id].position.set(data.x, data.y, data.z);
                players[data.id].rotation.y = data.rotY || 0;
                players[data.id].userData.hp = data.hp;
                players[data.id].userData.maxHP = data.maxHP;
                players[data.id].userData.damage = data.damage;
                players[data.id].userData.name = data.name || 'Unnamed';
                players[data.id].userData.tankType = data.tankType;
                updateHealthBar(players[data.id]);
                console.log(`Replaced tank model for ${data.id} with ${data.tankType}`);
              }).catch(err => console.error('Error updating tank model:', err));
            } else {
              updateHealthBar(players[data.id]);
            }
          }
          updateKillCounter();
          break;
        case 'move':
          if (data.id !== playerId && players[data.id]) {
            players[data.id].position.set(data.x, data.y, data.z);
            players[data.id].rotation.y = data.rotY || 0;
            players[data.id].userData.hp = data.hp;
            updateHealthBar(players[data.id]);
          }
          break;
        case 'shoot':
          if (data.id !== playerId) {
            const pelletSpeed = tankTypes[data.tankType || 'starter'].pelletSpeed;
            spawnPellet(data.x, data.z, data.dirX, data.dirZ, data.id, pelletSpeed);
          }
          break;
        case 'updateHP':
          if (players[data.id]) {
            players[data.id].userData.hp = data.hp;
            console.log(`HP updated for ${data.id}: ${data.hp}`);
            updateHealthBar(players[data.id]);
            if (data.hp <= 0) {
              players[data.id].visible = false;
              console.log(`Tank ${data.id} hidden due to death`);
            }
            if (data.id === playerId) updateHealthBarUI();
          }
          if (data.id === playerId && data.hp <= 0) {
            isAlive = false;
            deathScreen.style.display = 'block';
            document.exitPointerLock();
          }
          break;
        case 'removePlayer':
          if (players[data.id]) {
            scene.remove(players[data.id]);
            delete players[data.id];
            delete kills[data.id];
            console.log(`Removed player ${data.id}`);
            updateKillCounter();
          }
          break;
        case 'respawn':
          if (data.id !== playerId) {
            if (!players[data.id]) {
              createTank(data.tankType).then(tank => {
                players[data.id] = tank;
                scene.add(players[data.id]);
                kills[data.id] = data.kills || 0;
                console.log(`Respawned player ${data.id}`);
                players[data.id].position.set(data.x, data.y, data.z);
                players[data.id].rotation.y = data.rotY || 0;
                players[data.id].userData.hp = data.hp;
                players[data.id].userData.maxHP = data.maxHP;
                players[data.id].userData.damage = data.damage;
                players[data.id].userData.name = data.name || 'Unnamed';
                players[data.id].userData.tankType = data.tankType;
                players[data.id].visible = true;
                updateHealthBar(players[data.id]);
                updateKillCounter();
              }).catch(err => console.error('Error respawning player tank:', err));
            } else {
              players[data.id].position.set(data.x, data.y, data.z);
              players[data.id].rotation.y = data.rotY || 0;
              players[data.id].userData.hp = data.hp;
              players[data.id].userData.maxHP = data.maxHP;
              players[data.id].userData.damage = data.damage;
              players[data.id].userData.tankType = data.tankType;
              players[data.id].visible = true;
              kills[data.id] = data.kills || 0;
              updateHealthBar(players[data.id]);
              updateKillCounter();
            }
          } else {
            if (players[playerId]) {
              scene.remove(players[playerId]);
            }
            createTank(data.tankType).then(tank => {
              players[playerId] = tank;
              scene.add(players[playerId]);
              console.log(`Local player ${playerId} respawned`);
              players[playerId].position.set(data.x, data.y, data.z);
              players[playerId].rotation.y = data.rotY || 0;
              players[playerId].userData.hp = data.hp;
              players[playerId].userData.maxHP = data.maxHP;
              players[playerId].userData.damage = data.damage;
              players[playerId].userData.name = username;
              players[playerId].userData.tankType = data.tankType;
              players[playerId].visible = true;
              kills[playerId] = data.kills || 0;
              console.log(`Server set respawned player ${playerId} HP/maxHP to: ${players[playerId].userData.hp}/${players[playerId].userData.maxHP}`);
              updateHealthBar(players[playerId]);
              updateHealthBarUI();
              isAlive = true;
              bulletsLeft = maxBullets;
              isReloading = false;

              const tankPos = players[playerId].position.clone();
              const targetPos = tankPos.clone().add(thirdPersonOffset);
              camera.position.copy(targetPos);
              camera.lookAt(tankPos);
            }).catch(err => console.error('Error respawning local player tank:', err));
          }
          break;
        case 'kill':
          kills[data.killerId] = data.killerKills;
          kills[data.victimId] = data.victimKills;
          updateKillCounter();
          updateKillFeed(data.killerName, data.victimId);
          break;
        case 'healthBoxSpawn':
          createHealthBox(data.id, data.x, data.z);
          break;
        case 'healthBoxDespawn':
          if (healthBoxes[data.id]) {
            scene.remove(healthBoxes[data.id]);
            delete healthBoxes[data.id];
            console.log(`Despawned health box ${data.id}`);
          }
          break;
        case 'healthBoxCollected':
          if (healthBoxes[data.boxId]) {
            scene.remove(healthBoxes[data.boxId]);
            delete healthBoxes[data.boxId];
            console.log(`Health box ${data.boxId} collected by ${data.playerId}`);
          }
          if (players[data.playerId]) {
            players[data.playerId].userData.hp = data.hp;
            updateHealthBar(players[data.playerId]);
            if (data.playerId === playerId) updateHealthBarUI();
          }
          break;
      }
    };

    document.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'KeyV' && isAlive) {
        isThirdPerson = !isThirdPerson;
        if (!isThirdPerson) camera.position.y = 1.0;
        console.log(`Switched to ${isThirdPerson ? 'third-person' : 'first-person'}`);
      }
    });
    document.addEventListener('keyup', (e) => (keys[e.code] = false));

    document.addEventListener('click', () => {
      if (!document.pointerLockElement && isAlive) {
        document.body.requestPointerLock();
        console.log('Pointer lock requested');
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === document.body && isAlive) {
        yaw -= e.movementX * lookSensitivity;
        pitch -= e.movementY * lookSensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.set(pitch, yaw, 0);
        if (!isThirdPerson && players[playerId]) players[playerId].rotation.y = yaw;
        lastMouseMove = Date.now();
      }
    });

    document.body.requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock || document.body.webkitRequestPointerLock;

    const respawnBtn = document.getElementById('respawnBtn');
    respawnBtn.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'respawn', id: playerId, tankType: selectedTank || 'starter' }));
      }
      deathScreen.style.display = 'none';
      isAlive = true;
      bulletsLeft = maxBullets;
      isReloading = false;
    });
  }).catch(err => {
    console.error('Failed to create tank:', err);
    alert('Tank loading failed. Check console for details.');
  });
}

function spawnPellet(x, z, dirX, dirZ, shooterId, pelletSpeed) {
  const pelletGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
  const pelletMaterial = new THREE.MeshBasicMaterial({ color: 0xff4500 });
  const pellet = new THREE.Mesh(pelletGeometry, pelletMaterial);
  pellet.position.set(x, 0.8, z);
  pellet.rotation.x = Math.PI / 2;
  const direction = new THREE.Vector3(dirX, 0, dirZ).normalize();
  pellet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  pellet.userData = { dirX, dirZ, shooterId, hasHit: false }; // Track if pellet has hit
  scene.add(pellet);

  const pelletInterval = setInterval(() => {
    const newPos = pellet.position.clone();
    newPos.x += dirX * pelletSpeed;
    newPos.z += dirZ * pelletSpeed;

    for (const building of buildings) {
      const box = new THREE.Box3().setFromObject(building);
      if (box.containsPoint(newPos)) {
        console.log(`Pellet hit building at ${newPos.x}, ${newPos.z}`);
        spawnImpactSmoke(newPos.x, newPos.y, newPos.z);
        scene.remove(pellet);
        clearInterval(pelletInterval);
        return;
      }
    }

    pellet.position.copy(newPos);

    for (const id in players) {
      if (id !== shooterId && players[id] && players[id].userData.hp > 0 && !pellet.userData.hasHit) {
        const player = players[id];
        const tankBox = new THREE.Box3().setFromObject(player);
        if (tankBox.containsPoint(pellet.position)) {
          console.log(`Hit on ${id} by ${shooterId}`);
          spawnImpactSmoke(pellet.position.x, pellet.position.y, pellet.position.z);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'hit',
              targetId: id,
              shooterId: shooterId
            }));
          }
          pellet.userData.hasHit = true; // Mark as hit
          scene.remove(pellet);
          clearInterval(pelletInterval);
          return;
        }
      }
    }

    if (pellet.position.distanceTo(new THREE.Vector3(x, 0.8, z)) > 100) {
      scene.remove(pellet);
      clearInterval(pelletInterval);
    }
  }, 16);
}

function updateHealthBar(player) {
  const hp = player.userData.hp;
  const maxHP = player.userData.maxHP || 100;
  const healthBar = player.userData.healthBar;
  if (!healthBar) {
    console.error(`Health bar missing for player ${player.userData.name}`);
    return;
  }
  healthBar.scale.x = Math.max(0, hp / maxHP);
  healthBar.material.color.setHSL(hp / maxHP, 1, 0.5);
  healthBar.visible = hp > 0;

  const smoke = player.userData.smoke;
  let smokeCount = 0;
  if (hp <= 0.4 * maxHP && hp > 0.2 * maxHP) smokeCount = 20;
  else if (hp <= 0.2 * maxHP && hp > 0) smokeCount = 30;

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
  let fireCount = hp <= 0.2 * maxHP && hp > 0 ? 20 : 0;

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

function spawnImpactSmoke(x, y, z) {
  const smokeGeometry = new THREE.BufferGeometry();
  const smokeVertices = new Float32Array(10 * 3);
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

    if (lifetime > 500) {
      scene.remove(smoke);
      clearInterval(smokeInterval);
    }
  }, 16);
}

function animate() {
  requestAnimationFrame(animate);

  if (isAlive && players[playerId]) {
    const tankType = players[playerId].userData.tankType || 'starter';
    const moveSpeed = tankTypes[tankType].moveSpeed;
    const pelletSpeed = tankTypes[tankType].pelletSpeed;

    let tankRotation = players[playerId].rotation.y;
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), tankRotation);
    forward.y = 0;
    forward.normalize();

    const newPos = players[playerId].position.clone();
    let moved = false;

    if (keys['KeyA']) {
      tankRotation += rotateSpeed;
      moved = true;
    }
    if (keys['KeyD']) {
      tankRotation -= rotateSpeed;
      moved = true;
    }
    if (keys['KeyW']) {
      newPos.add(forward.multiplyScalar(moveSpeed));
      moved = true;
    }
    if (keys['KeyS']) {
      newPos.add(forward.multiplyScalar(-moveSpeed));
      moved = true;
    }

    if (moved && !checkCollision(newPos)) {
      players[playerId].position.copy(newPos);
      players[playerId].rotation.y = tankRotation;
      if (!isThirdPerson) camera.position.set(newPos.x, 1.0, newPos.z);
    }

    if (isThirdPerson) {
      const tankPos = players[playerId].position.clone();
      const timeSinceMouseMove = Date.now() - lastMouseMove;
      const cameraYaw = (timeSinceMouseMove > 500) ? tankRotation : yaw;
      const targetPos = tankPos.clone().add(thirdPersonOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw));
      camera.position.lerp(targetPos, cameraLerpSpeed);
      camera.lookAt(tankPos.clone().setY(0.8));
    }

    if (keys['Space'] && Date.now() - lastShot >= shootInterval && !isReloading && bulletsLeft > 0) {
      lastShot = Date.now();
      bulletsLeft--;
      let shootDir;
      let pelletStart;
      if (isThirdPerson) {
        shootDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), players[playerId].rotation.y);
        pelletStart = players[playerId].position.clone().add(shootDir.multiplyScalar(1));
        pelletStart.y = 0.8;
      } else {
        shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        pelletStart = camera.position.clone().add(shootDir.multiplyScalar(1));
      }
      shootDir.normalize();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'shoot',
          x: pelletStart.x,
          y: pelletStart.y,
          z: pelletStart.z,
          dirX: shootDir.x,
          dirZ: shootDir.z,
          tankType: tankType
        }));
      }
      spawnPellet(pelletStart.x, pelletStart.z, shootDir.x, shootDir.z, playerId, pelletSpeed);

      if (bulletsLeft === 0) {
        isReloading = true;
        setTimeout(() => {
          bulletsLeft = maxBullets;
          isReloading = false;
          console.log('Magazine reloaded');
        }, reloadTime);
      }
    }

    for (const id in players) {
      updateHealthBar(players[id]);
    }

    for (const id in healthBoxes) {
      const box = healthBoxes[id];
      const elapsed = (Date.now() - box.userData.spawnTime) / 1000;
      box.position.y = 0.25 + Math.sin(elapsed * 2 * Math.PI) * 0.1;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'move',
        x: players[playerId].position.x,
        y: players[playerId].position.y,
        z: players[playerId].position.z,
        rotY: players[playerId].rotation.y
      }));
    }

    updateAmmoCounter();
    updateHealthBarUI();

    if (keys['KeyH']) {
      players[playerId].userData.hp = Math.max(0, players[playerId].userData.hp - 1);
      updateHealthBar(players[playerId]);
      updateHealthBarUI();
    }
  }

  renderer.render(scene, camera);
}
animate();