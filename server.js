const express = require('express');
const { Server, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const app = express();


const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and bound to 0.0.0.0`);
});

const wss = new Server({ server });
const players = {};
const clients = new Map();
const powerUps = {};
const healthBoxes = {};

const tankTypes = {
  starter: { maxHP: 100, damage: 10, moveSpeed: 0.075, pelletSpeed: 0.5 },
  heavy: { maxHP: 150, damage: 15, moveSpeed: 0.05, pelletSpeed: 0.4 },
  sniper: { maxHP: 80, damage: 20, moveSpeed: 0.06, pelletSpeed: 0.7 },
  merkava: { maxHP: 200, damage: 8, moveSpeed: 0.075, pelletSpeed: 0.5 }
};

wss.on('connection', (ws) => {
  const playerId = uuidv4();
  const spawnX = Math.random() * 200 - 100;
  const spawnZ = Math.random() * 200 - 100;

  players[playerId] = {
    x: spawnX,
    y: 0,
    z: spawnZ,
    rotY: 0,
    hp: null,
    kills: 0,
    name: '',
    tankType: null,
    maxHP: null,
    damage: null
  };

  clients.set(playerId, ws);
  console.log(`Player ${playerId} connected at (${spawnX}, ${spawnZ}). Total players: ${Object.keys(players).length}`);

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log(`Received from ${playerId}: ${JSON.stringify(data)}`);

    if (data.type === 'setName') {
      const tankType = data.tankType || 'starter';
      players[playerId].name = data.name;
      players[playerId].tankType = tankType;
      players[playerId].maxHP = tankTypes[tankType].maxHP;
      players[playerId].hp = tankTypes[tankType].maxHP;
      players[playerId].damage = tankTypes[tankType].damage;
      console.log(`Player ${playerId} set name to ${data.name}, tankType to ${tankType}, maxHP to ${players[playerId].maxHP}`);

      ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        players: Object.fromEntries(
          Object.entries(players).map(([id, p]) => [id, {
            x: p.x,
            y: p.y,
            z: p.z,
            rotY: p.rotY,
            hp: p.hp,
            kills: p.kills || 0,
            name: p.name || '',
            tankType: p.tankType,
            maxHP: p.maxHP,
            damage: p.damage
          }])
        ),
        powerUps,
        healthBoxes
      }));
      console.log(`Sent init to ${playerId} with maxHP: ${players[playerId].maxHP}`);

      broadcast({
        type: 'newPlayer',
        id: playerId,
        x: spawnX,
        y: 0,
        z: spawnZ,
        rotY: 0,
        hp: players[playerId].hp,
        name: players[playerId].name,
        tankType: players[playerId].tankType,
        maxHP: players[playerId].maxHP,
        damage: players[playerId].damage
      }, ws);

      broadcast({
        type: 'playerUpdate',
        id: playerId,
        name: data.name,
        tankType: tankType,
        maxHP: players[playerId].maxHP,
        damage: players[playerId].damage,
        x: players[playerId].x,
        y: players[playerId].y,
        z: players[playerId].z,
        rotY: players[playerId].rotY,
        hp: players[playerId].hp
      }, ws);
    } else if (data.type === 'move' && players[playerId] && players[playerId].tankType) {
      players[playerId].x = data.x;
      players[playerId].y = data.y;
      players[playerId].z = data.z;
      players[playerId].rotY = data.rotY;

      for (const [boxId, box] of Object.entries(healthBoxes)) {
        const dx = players[playerId].x - box.x;
        const dz = players[playerId].z - box.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance < 1.5) {
          players[playerId].hp = Math.min(players[playerId].hp + 30, players[playerId].maxHP);
          delete healthBoxes[boxId];
          broadcast({ type: 'healthBoxCollected', boxId, playerId, hp: players[playerId].hp });
          console.log(`Player ${playerId} collected health box ${boxId}. New HP: ${players[playerId].hp}`);
        }
      }

      broadcast({
        type: 'move',
        id: playerId,
        x: data.x,
        y: data.y,
        z: data.z,
        rotY: data.rotY,
        hp: players[playerId].hp
      }, ws);
    } else if (data.type === 'shoot' && players[playerId].tankType) {
      broadcast({
        type: 'shoot',
        id: playerId,
        x: data.x,
        y: data.y,
        z: data.z,
        dirX: data.dirX,
        dirZ: data.dirZ,
        tankType: players[playerId].tankType
      }, ws);
    } else if (data.type === 'hit') {
      const targetId = data.targetId;
      const shooterId = data.shooterId;
      if (players[targetId] && players[targetId].hp > 0) { // Only process if target is alive
        players[targetId].hp -= players[shooterId].damage;
        console.log(`Player ${shooterId} hit ${targetId}. HP now: ${players[targetId].hp}`);
        broadcast({
          type: 'updateHP',
          id: targetId,
          hp: players[targetId].hp
        });

        if (players[targetId].hp <= 0 && targetId !== shooterId) {
          players[shooterId].kills = (players[shooterId].kills || 0) + 1;
          players[targetId].kills = 0;
          broadcast({
            type: 'kill',
            killerId: shooterId,
            victimId: targetId,
            killerName: players[shooterId].name,
            killerKills: players[shooterId].kills,
            victimKills: players[targetId].kills
          });
          console.log(`Player ${targetId} died, kills reset to 0. ${shooterId} kills: ${players[shooterId].kills}`);
        }
      }
    } else if (data.type === 'respawn') {
      const tankType = data.tankType || 'starter';
      const spawnX = Math.random() * 200 - 100;
      const spawnZ = Math.random() * 200 - 100;
      players[playerId] = {
        x: spawnX,
        y: 0,
        z: spawnZ,
        rotY: 0,
        hp: tankTypes[tankType].maxHP,
        kills: 0,
        name: players[playerId].name,
        tankType: tankType,
        maxHP: tankTypes[tankType].maxHP,
        damage: tankTypes[tankType].damage
      };
      ws.send(JSON.stringify({
        type: 'respawn',
        id: playerId,
        x: spawnX,
        y: 0,
        z: spawnZ,
        rotY: 0,
        hp: players[playerId].hp,
        tankType: tankType,
        maxHP: players[playerId].maxHP,
        damage: players[playerId].damage
      }));
      broadcast({
        type: 'respawn',
        id: playerId,
        x: spawnX,
        y: 0,
        z: spawnZ,
        rotY: 0,
        hp: players[playerId].hp,
        kills: players[playerId].kills,
        name: players[playerId].name,
        tankType: tankType,
        maxHP: players[playerId].maxHP,
        damage: players[playerId].damage
      }, ws);
    }
  });

  ws.on('close', () => {
    console.log(`Player ${playerId} disconnected`);
    delete players[playerId];
    clients.delete(playerId);
    broadcast({ type: 'removePlayer', id: playerId }, ws);
  });
});

function broadcast(data, senderWs) {
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

setInterval(() => {
  if (Object.keys(powerUps).length < 5) {
    const id = uuidv4();
    powerUps[id] = {
      x: Math.random() * 200 - 100,
      z: Math.random() * 200 - 100,
      type: Math.random() > 0.5 ? 'health' : 'ammo'
    };
    broadcast({ type: 'powerUpSpawn', id, ...powerUps[id] });
  }
}, 10000);

setInterval(() => {
  if (Object.keys(healthBoxes).length < 10) {
    const id = uuidv4();
    healthBoxes[id] = {
      x: Math.random() * 200 - 100,
      z: Math.random() * 200 - 100
    };
    broadcast({ type: 'healthBoxSpawn', id, x: healthBoxes[id].x, z: healthBoxes[id].z });
    console.log(`Spawned health box ${id} at (${healthBoxes[id].x}, ${healthBoxes[id].z}). Total: ${Object.keys(healthBoxes).length}`);

    setTimeout(() => {
      if (healthBoxes[id]) {
        delete healthBoxes[id];
        broadcast({ type: 'healthBoxDespawn', id });
        console.log(`Despawned health box ${id}. Total: ${Object.keys(healthBoxes).length}`);
      }
    }, 15000);
  }
}, 2000);