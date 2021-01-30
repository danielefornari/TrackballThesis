import * as THREE from 'https://unpkg.com/three/build/three.module.js';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function sayHi() {
    alert("Hi");
};
sayHi();