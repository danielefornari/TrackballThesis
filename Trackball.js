import * as THREE from 'https://unpkg.com/three/build/three.module.js';

//import * as THREE from 'three';

const canvas = document.getElementById("myCanvas");
const rotationAxisParagraph = document.getElementById("rotationAxisParagraph");
const cursor1Paragraph = document.getElementById("cursor1Paragraph");
const cursor2Paragraph = document.getElementById("cursor2Paragraph");
canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);
canvas.addEventListener('mouseleave', mouseUpListener);

const renderer = new THREE.WebGLRenderer({canvas}); //instanzio il renderer dicendo che lo voglio nel canvas che gli passo
const raycaster = new THREE.Raycaster();

let tracking = false;   //indica se sto eseguendo il tracking del cursore del mouse
let currentCursorPosition = new THREE.Vector3();    //posizione corrente del cursore
let prevCursorPosition = new THREE.Vector3();   //posizione precedente del cursore
let rotationAxis = new THREE.Vector3(); //asse di rotazione

function updateCursorPosition(x, y) {
    prevCursorPosition.copy(currentCursorPosition);
    let canvasRect = canvas.getBoundingClientRect();

    //coordinate x/y del cursore rispetto al canvas con valori tra [-1, 1]
    currentCursorPosition.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
    currentCursorPosition.setY(((y - canvasRect.top) / canvasRect.height) * 2 - 1);
    //currentCursorPosition.unproject(camera);

    /*let v = new THREE.Vector2(currentCursorPosition.x, currentCursorPosition.y);
    raycaster.setFromCamera(v, camera);
    let intersect = raycaster.intersectObject(scene, true);
    //alert(intersect[0].point);
    if(intersect.length > 0) {
        currentCursorPosition.copy(intersect[0].point);
        currentCursorPosition.setZ(unprojectZ(currentCursorPosition.x, currentCursorPosition.y));
    }*/
    currentCursorPosition.setZ(unprojectZ(currentCursorPosition.x, currentCursorPosition.y));
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
    //cursorScreenPosition.x = event.clientX;
    //cursorScreenPosition.y = event.clientY;
    updateCursorPosition(event.clientX, event.clientY);
    tracking = true;
};

function mouseMoveListener(event) {
    if(tracking) {
        updateCursorPosition(event.clientX, event.clientY);
        calculateRotationAxis(prevCursorPosition, currentCursorPosition);
        let v1 = prevCursorPosition;
        let v2 = currentCursorPosition;
        rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
        cursor1Paragraph.innerHTML = "Vector1: "+v1.x+ ", "+v1.y+", "+v1.z;
        cursor2Paragraph.innerHTML = "Vector2: "+v2.x+", "+v2.y+", "+v2.z;
        rotateObj(cube, rotationAxis, 0.8);
    }
};


function calculateRotationAxis(vec1, vec2) {
    rotationAxis.crossVectors(vec1, vec2);
    rotationAxis.normalize();
};

function getObjCoord(obj) {
    return obj.getWorldPosition();
};

function rotateObj(obj, axis, rad) {
    cube.rotateOnWorldAxis(axis, rad);
    resizeRenderer();
    renderer.render(scene, camera);
};

function unprojectZ(x, y) {
    let radius = 1;
    let x2 = Math.pow(x, 2);
    let y2 = Math.pow(y, 2);
    let radius2 = Math.pow(radius, 2)
    if(x2+y2 <= radius2/2) {
        return Math.sqrt(radius2-(x2+y2));
    }
    else {
        return (radius2/2)/(Math.sqrt(x2+y2));
    }
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