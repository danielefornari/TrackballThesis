import * as THREE from 'https://unpkg.com/three/build/three.module.js';

//const canvas = document.querySelector('#myCanvas'); //riferimento al canvas
const canvas = document.getElementById("myCanvas");
const renderer = new THREE.WebGLRenderer({canvas}); //istanzio il renderer dicendo che lo voglio nel canvas che gli passo

//camera
const fov = 75;
const aspect = 2;
const near = 0.1
const far = 5;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 2;

//scene
const scene = new THREE.Scene();

//il cubo

//geometry
const boxWidth = 1;
const boxHeight = 1;
const boxDepth = 1;
const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//material
const boxMaterial = new THREE.MeshBasicMaterial({color: 0x44aa88});

//mesh
const cube = new THREE.Mesh(geometry, material);

scene.add(cube);
renderer.render(scene, camera);
