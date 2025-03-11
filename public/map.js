// Map.js - Environment setup
const scene = new THREE.Scene();

// Desert Ground (Bigger Map)
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xd2b48c }); // Sandy tan
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Desert Buildings
const buildings = [];
function createBuilding(x, z, width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshBasicMaterial({ color: 0xc19a6b }); // Adobe brown
  const building = new THREE.Mesh(geometry, material);
  building.position.set(x, height / 2, z);
  scene.add(building);
  buildings.push(building);
  return building;
}

createBuilding(-40, -40, 5, 8, 5);
createBuilding(50, 0, 4, 6, 4);
createBuilding(0, 60, 6, 10, 6);
createBuilding(-60, 50, 3, 5, 3);

// Skybox with Desert Sky
const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// Sun
const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(100, 100, -100);
scene.add(sun);

// Clouds
function createCloud(x, y, z) {
  const cloudGeometry = new THREE.SphereGeometry(2, 16, 16);
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloud.position.set(x, y, z);
  scene.add(cloud);
}
createCloud(40, 60, -60);
createCloud(-30, 70, 20);
createCloud(0, 80, -40);