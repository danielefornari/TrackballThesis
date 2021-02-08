import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("myCanvas");
const rotationAxisParagraph = document.getElementById("rotationAxisParagraph");
const cursor1Paragraph = document.getElementById("cursor1Paragraph");
const cursor2Paragraph = document.getElementById("cursor2Paragraph");
canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);
canvas.addEventListener('mouseleave', mouseUpListener);
window.addEventListener('resize', windowResizeListener);

const renderer = new THREE.WebGLRenderer({canvas}); //instanzio il renderer dicendo che lo voglio nel canvas che gli passo
const group = new THREE.Group();
const radiusScaleFactor = 3;

let sphereRadius = calculateRadius(radiusScaleFactor, renderer);
let tracking = false;   //indica se sto eseguendo il tracking del cursore del mouse
let currentCursorPosition = new THREE.Vector3();    //posizione corrente del cursore
let startCursorPosition = new THREE.Vector3();   //posizione iniziale del cursore
let rotationAxis = new THREE.Vector3(); //asse di rotazione
let obj;    //il modello 3D
let quatState = new THREE.Quaternion(); //valore del quaternione al momento del click del mouse


const manager = new Hammer(canvas);
/*manager.get('pan').set({direction: Hammer.DIRECTION_ALL});
manager.on("panup pandown panleft panright", panManager);
manager.on("panstart", panStartManager);
manager.on("panend", function panEnd() {
    tracking = false;
});*/

function panStartManager(event) {
    let center = event.center;
    if(group.quaternion == "undefined") {
        quatState = new THREE.Quaternion().identity();
    }
    else {
        quatState.copy(group.quaternion);
    }
    startCursorPosition = getCursorPosition(center.x, center.y);
    tracking = true;
    tracking = false;
};

function panManager(event) {
    let center = event.center;
    currentCursorPosition = getCursorPosition(center.x, center.y);
    calculateRotationAxis(startCursorPosition, currentCursorPosition);
    let v1 = startCursorPosition.clone();
    let v2 = currentCursorPosition.clone();
    rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
    cursor1Paragraph.innerHTML = "Vector1: "+v1.x+ ", "+v1.y+", "+v1.z;
    cursor2Paragraph.innerHTML = "Vector2: "+v2.x+", "+v2.y+", "+v2.z;
    //rotateObj(cube, rotationAxis, v1.sub(v2).length()/(canvas.clientHeight/3));
    rotateObj(cube, calculateRotationAxis, v1.angleTo(v2))
};


//camera
/*const fov = 75;
const aspect = canvas.clientWidth/canvas.clientHeight;
const near = 0.1
const far = 5;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);*/

let canvasRect = getCanvasRect(renderer);
const left = canvasRect.width/-2;
const right = canvasRect.width/2;
const top = canvasRect.height/2;
const bottom = canvasRect.height/-2;
const near = -300;
const far = 300;
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);

camera.position.z = 2;

//scene
const scene = new THREE.Scene();

//luce
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

makeGizmos(group);

//il cubo
const boxWidth = 200;
const boxHeight = 200;
const boxDepth = 200;

//geometry
const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//material
const boxMaterial = new THREE.MeshPhongMaterial({color: 0xC2C2C2});

//mesh
const cube = new THREE.Mesh(boxGeometry, boxMaterial);
obj = cube;

group.add(obj);
scene.add(group);
resizeRenderer(renderer);
renderer.render(scene, camera);

//listeners
function mouseUpListener() {
    tracking = false;
};

function mouseDownListener(event) {
    if(group.quaternion == "undefined") {
        quatState = new THREE.Quaternion().identity();
    }
    else {
        quatState.copy(group.quaternion);
    }

    startCursorPosition = getCursorPosition(event.clientX, event.clientY);
    tracking = true;
};

function mouseMoveListener(event) {
    if(tracking) {
        let canvasRect = getCanvasRect(renderer);
        currentCursorPosition = getCursorPosition(event.clientX, event.clientY);
        rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
        cursor1Paragraph.innerHTML = "Vector1: "+startCursorPosition.x+ ", "+startCursorPosition.y+", "+startCursorPosition.z;
        cursor2Paragraph.innerHTML = "Vector2: "+currentCursorPosition.x+", "+currentCursorPosition.y+", "+currentCursorPosition.z;

        let distanceV = startCursorPosition.clone();
        distanceV.sub(currentCursorPosition);
        let angleV = startCursorPosition.angleTo(currentCursorPosition);

        rotateObj(group, calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/sphereRadius, angleV));
    }
};

function windowResizeListener() {
    resizeRenderer(renderer);
    renderer.render(scene, camera);
}


function calculateRadius(radiusScaleFactor, renderer) {
    const canvasRect = getCanvasRect(renderer);
    if(canvasRect.height <= canvasRect.width) {
        return canvasRect.height/radiusScaleFactor;
    }
    else {
        return canvasRect.width/radiusScaleFactor;
    }
}

function calculateRotationAxis(vec1, vec2) {
    return rotationAxis.crossVectors(vec1, vec2).normalize();
};

function makeGizmos(group) {
    //gizmo per la rotazione
    const curveCenterX = 0;
    const curveCenterY = 0;
    const curveRadius = sphereRadius;
    const curve = new THREE.EllipseCurve(curveCenterX, curveCenterY, curveRadius, curveRadius);
    const points = curve.getPoints(50);

    //geometry
    const curveGeometry = new THREE.BufferGeometry().setFromPoints(points);

    //material
    const curveMaterialX = new THREE.LineBasicMaterial({color: 0x00FF00});
    const curveMaterialY = new THREE.LineBasicMaterial({color: 0xFF0000});
    const curveMaterialZ = new THREE.LineBasicMaterial({color: 0x0000FF});

    //line
    const rotationGizmoX = new THREE.Line(curveGeometry, curveMaterialX);
    const rotationGizmoY = new THREE.Line(curveGeometry, curveMaterialY);
    const rotationGizmoZ = new THREE.Line(curveGeometry, curveMaterialZ);

    rotationGizmoX.rotation.x = Math.PI/2;
    rotationGizmoY.rotation.y = Math.PI/2;

    group.add(rotationGizmoX);
    group.add(rotationGizmoY);
    group.add(rotationGizmoZ);
};

//restituisce le coordinate x, y, z del cursore normalizzate
function getCursorPosition(x, y) {
    let canvasRect = getCanvasRect(renderer);

    //coordinate x/y del cursore rispetto al canvas con valori tra [-1, 1]
    let cursorPosition = new THREE.Vector3();
    cursorPosition.setX((x-canvasRect.left)-canvasRect.width/2);
    cursorPosition.setY((canvasRect.bottom-y)-canvasRect.height/2);
    cursorPosition.setZ(unprojectZ(cursorPosition.x, cursorPosition.y, sphereRadius));
    return cursorPosition;
};

function getCanvasRect(renderer) {
    return renderer.domElement.getBoundingClientRect();
}

function getObjCoord(obj) {
    return obj.getWorldPosition();
};

function resizeRenderer(renderer) {
    const canvas = renderer.domElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if(canvas.width != canvasWidth || canvas.height != canvasHeight) {
        renderer.setSize(canvasWidth, canvasHeight, false);
    }
};

function rotateObj(obj, axis, rad) {
    let quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, rad);
    quat.multiply(quatState);
    obj.setRotationFromQuaternion(quat);
    renderer.render(scene, camera);
};

function unprojectZ(x, y, radius) {
    let x2 = Math.pow(x, 2);
    let y2 = Math.pow(y, 2);
    let radius2 = Math.pow(radius, 2);

    if(x2+y2 <= radius2/2) {
        boxMaterial.color.setHex(0xC2C2C2);
        return Math.sqrt(radius2-(x2+y2));
    }
    else {
        boxMaterial.color.setHex(0x616161);
        return (radius2/2)/(Math.sqrt(x2+y2));
    }
};
