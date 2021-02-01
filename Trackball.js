import * as THREE from 'https://unpkg.com/three/build/three.module.js';
//import {GLTFLoader} from 'https://unpkg.com/three/examples/jsm/loaders/GLTFLoader';

//const canvas = document.querySelector('#myCanvas'); //riferimento al canvas
const canvas = document.getElementById("myCanvas");
const renderer = new THREE.WebGLRenderer({canvas}); //instanzio il renderer dicendo che lo voglio nel canvas che gli passo

//camera
const fov = 75;
const aspect = 2;
const near = 0.1
const far = 5;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 2;

//scene
const scene = new THREE.Scene();

//luce
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

//il cubo

//geometry
const boxWidth = 1;
const boxHeight = 1;
const boxDepth = 1;
const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//material
//const boxMaterial = new THREE.MeshBasicMaterial({color: 0x44aa88});   //non affetto dalle luci
const boxMaterial = new THREE.MeshPhongMaterial({color: 0x44aa88});

//mesh
const cube = new THREE.Mesh(boxGeometry, boxMaterial);

scene.add(cube);
renderer.render(scene, camera);

//loader
const loader = new THREE.GLTFLoader();
const objUrl = './untitled.gltf';
loader.load(objUrl, (gltf)=>{
    const root = gltf.scene;
    scene.add(root);
});

function keyDownListener(event) {
    switch (event.key) {
        case "ArrowUp":
            alert("up");
            break;

        case "ArrowDown":
            alert("down");
            break;

        case "ArrowLeft":
            alert("left");
            break;

        case "ArrowRight":
            alert("right");
            break;
   
        default:
            alert("default");
            break;
    }
};

window.addEventListener('keydown', keyDownListener);