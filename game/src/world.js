import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const materials = {};
  for (const [name, color] of Object.entries(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.12 });
  }
  const colliders = [];
  const shootables = [];

  function box(name, width, height, depth, x, y, z, material = 'surface') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // A broad foundry floor framed by broken industrial perimeter walls.
  box('yard slab', 48, 0.4, 36, 0, -0.2, 0, 'canvas');
  box('north furnace wall', 48, 5, 0.5, 0, 2.5, -18, 'surface');
  box('south loading wall', 48, 5, 0.5, 0, 2.5, 18, 'surface');
  box('west boundary', 0.5, 5, 36, -24, 2.5, 0, 'surface');
  box('east boundary', 0.5, 5, 36, 24, 2.5, 0, 'surface');

  // Mid lane has a furnace stack and low cover that break long sightlines.
  box('central furnace', 3.2, 4.5, 3.2, 0, 2.25, 0, 'accent');
  box('mid pallet west', 4.2, 1.15, 1.6, -6.2, 0.58, -1.8, 'hairline');
  box('mid pallet east', 4.2, 1.15, 1.6, 6.2, 0.58, 1.8, 'hairline');
  box('slag bin west', 2.2, 1.6, 2.2, -10.2, 0.8, 2.4, 'accent');
  box('slag bin east', 2.2, 1.6, 2.2, 10.2, 0.8, -2.4, 'accent');

  // A Long offers cover between the west spawn and site A.
  box('long lane barrier', 1.1, 2, 7.4, -15.5, 1, -6.2, 'hairline');
  box('A site foundry crate', 3.2, 1.4, 2.2, -16.5, 0.7, -12, 'accent');
  box('A site pipe rack', 5.8, 1.2, 1, -19, 0.6, -15.5, 'hairline');
  box('west lane kiosk', 2.4, 2.4, 2.4, -8.8, 1.2, -10.5, 'surface');

  // B tunnels are represented by offset baffles and a pair of heavy pipe housings.
  box('tunnel baffle one', 1.2, 2.4, 5, 15, 1.2, 8, 'hairline');
  box('tunnel baffle two', 1.2, 2.4, 5, 19, 1.2, 3, 'hairline');
  box('B site pump housing', 3.4, 1.8, 2.6, 16.4, 0.9, 12, 'accent');
  box('B site pipe rack', 5.2, 1.1, 1.2, 20, 0.55, 15.2, 'hairline');
  box('east lane crate', 2.6, 1.3, 2.6, 9.5, 0.65, 11.5, 'surface');

  // Short dividing walls create three readable routes without sealing the yard.
  box('north divider west', 0.6, 2.2, 6, -5.1, 1.1, -11.8, 'surface');
  box('north divider east', 0.6, 2.2, 6, 5.1, 1.1, 11.8, 'surface');
  box('south divider west', 0.6, 2.2, 6, -5.1, 1.1, 11.8, 'surface');
  box('south divider east', 0.6, 2.2, 6, 5.1, 1.1, -11.8, 'surface');

  const sites = [
    { name: 'A', position: new THREE.Vector3(-17, 0, -13), radius: 2.6 },
    { name: 'B', position: new THREE.Vector3(17, 0, 13), radius: 2.6 },
  ];
  const routes = {
    ember: [new THREE.Vector3(-19, 0, 14), new THREE.Vector3(-10, 0, 8), new THREE.Vector3(-2, 0, 1), new THREE.Vector3(-10, 0, -8), sites[0].position],
    ash: [new THREE.Vector3(19, 0, -14), new THREE.Vector3(11, 0, -8), new THREE.Vector3(2, 0, -1), new THREE.Vector3(10, 0, 8), sites[1].position],
  };

  const sky = new THREE.HemisphereLight(PALETTE.ink, PALETTE.canvas, 1.4);
  scene.add(sky);
  const key = new THREE.DirectionalLight(PALETTE.accent, 2.4);
  key.position.set(-12, 20, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  scene.add(key);
  const fill = new THREE.DirectionalLight(PALETTE.muted, 0.65);
  fill.position.set(15, 9, -12);
  scene.add(fill);
  return { colliders, shootables, group, sites, routes, box };
}
