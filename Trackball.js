import * as THREE from 'https://unpkg.com/three/build/three.module.js';

//const canvas = document.querySelector('#myCanvas'); //riferimento al canvas
const canvas = document.getElementById("myCanvas");
const renderer = new THREE.WebGLRenderer({canvas}); //istanzio il renderer dicendo che lo voglio nel canvas che gli passo
