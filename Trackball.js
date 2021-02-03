import * as THREE from 'https://unpkg.com/three/build/three.module.js';
//import { Vector3 } from 'three';

//import * as THREE from 'three';

const canvas = document.getElementById("myCanvas");
const paragraph = document.getElementById("testParagraph");
canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);

const renderer = new THREE.WebGLRenderer({canvas}); //instanzio il renderer dicendo che lo voglio nel canvas che gli passo
let tracking = false;   //indica se sto eseguendo il tracking del cursore del mouse
let timeStart = Date.now();

//struttura dati che mantiene le coordinate correnti e precedenti del cursore
let cursorData = {
    current: {
        x:0,
        y:0,
        toVector3: function() {
            return new THREE.Vector3(this.x, this.y, 0);
        }
    },
    prev: {
        x:0,
        y:0,
        toVector3: function() {
            return new THREE.Vector3(this.x, this.y, 0);
        }
    },
    updateCursorPositions: function(x, y, canvas) {
        let canvasRect = canvas.getBoundingClientRect();
        this.prev.x = this.current.x;
        this.prev.y = this.current.y;
        this.current.x = x - canvasRect.left;
        this.current.y = y - canvasRect.top;
    }
};


//camera
let cameraOptions = {
    fov: 75,
    aspect: 2,
    near: 0.1,
    far: 5
};

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
//const boxMaterial = new THREE.MeshBasicMaterial({color: 0x44aa88});   //non è affetto dalle luci
const boxMaterial = new THREE.MeshPhongMaterial({color: 0x44aa88});

//mesh
const cube = new THREE.Mesh(boxGeometry, boxMaterial);

scene.add(cube);

function resizeRenderer() {
    const canvas = renderer.domElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if(canvas.width != canvasWidth || canvas.height != canvasHeight)
    {
        renderer.setSize(canvasWidth, canvasHeight, false);
    }
};

resizeRenderer();
renderer.render(scene, camera);

//listeners
function mouseUpListener() {
    tracking = false;
};

function mouseDownListener(event) {
    cursorData.updateCursorPositions(event.clientX, event.clientY, canvas);
    timeStart = Date.now();
    tracking = true;
};

function mouseMoveListener(event) {
    let currentTime = Date.now();
    if(tracking && currentTime - timeStart >= 33) {
        cursorData.updateCursorPositions(event.clientX, event.clientY, canvas);
        let rotationAxis = calculateRotationAxis(cursorData);
        let v1 = cursorData.prev.toVector3();
        let v2 = cursorData.current.toVector3();
        timeStart = currentTime;
        paragraph.innerHTML= "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z+" Vector1: "+v1.x+ ", "+v1.y+", "+v1.z+
        " Vector2: "+v2.x+", "+v2.y+", "+v2.z;
        rotateObj(cube, rotationAxis, 0.1);
    }
};


function calculateRotationAxis(cursorData) {
    let rotationAxis = new THREE.Vector3();
    rotationAxis.crossVectors(cursorData.prev.toVector3(), cursorData.current.toVector3());
    //rotationAxis.crossVectors(new THREE.Vector3(1, 0.5, 0), new THREE.Vector3(0.5, 0, 1))
    return rotationAxis.normalize();
};

function getObjCoord(obj) {
    return obj.getWorldPosition();
};

function rotateObj(obj, axis, degrees) {
    cube.rotateOnWorldAxis(axis, degrees);
    resizeRenderer();
    renderer.render(scene, camera);
};


function keyDownListener(event) {
    const rotationSpeed = 2;
    switch (event.key) {
        case "ArrowUp":
            cube.rotateX(-rotationSpeed)
            break;

        case "ArrowDown":
            cube.rotateX(rotationSpeed);
            break;

        case "ArrowLeft":
            cube.rotateY(-rotationSpeed);
            break;

        case "ArrowRight":
            cube.rotateY(rotationSpeed);
            break;
   
        default:
            alert("default");
            break;
    }
    resizeRenderer();
    renderer.render(scene, camera);
};

window.addEventListener('keydown', keyDownListener);