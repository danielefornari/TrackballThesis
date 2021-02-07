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

let tracking = false;   //indica se sto eseguendo il tracking del cursore del mouse
let currentCursorPosition = new THREE.Vector3();    //posizione corrente del cursore
let startCursorPosition = new THREE.Vector3();   //posizione iniziale del cursore
let rotationAxis = new THREE.Vector3(); //asse di rotazione
let quatState = new THREE.Quaternion(); //valore del quaternione al momento del click del mouse


const manager = new Hammer(canvas);
manager.get('pan').set({direction: Hammer.DIRECTION_ALL});
manager.on("panup pandown panleft panright", panManager);
manager.on("pressup", pressUpManager());

function pressUpManager(event) {
    tracking = false;
}

function panManager(event) {
    let center = event.center;

    if(!tracking) {
        if(group.quaternion == "undefined") {
            quatState = new THREE.Quaternion().identity();
        }
        else {
            quatState.copy(group.quaternion);
        }
        startCursorPosition = getCursorPosition(center.x, center.y);
        tracking = true;
    }
    else {
        currentCursorPosition = getCursorPosition(center.x, center.y);
        calculateRotationAxis(startCursorPosition, currentCursorPosition);
        let v1 = startCursorPosition.clone();
        let v2 = currentCursorPosition.clone();
        rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
        cursor1Paragraph.innerHTML = "Vector1: "+v1.x+ ", "+v1.y+", "+v1.z;
        cursor2Paragraph.innerHTML = "Vector2: "+v2.x+", "+v2.y+", "+v2.z;
        //rotateObj(cube, rotationAxis, v1.sub(v2).length()/(canvas.clientHeight/3));
        rotateObj(cube, rotationAxis, v1.angleTo(v2))
    }
};



const renderer = new THREE.WebGLRenderer({canvas}); //instanzio il renderer dicendo che lo voglio nel canvas che gli passo
const group = new THREE.Group();



//i gizmo per la rotazione
//geometry
const radiusOut = canvas.clientHeight/3;
const radiusIn = radiusOut+2;
const segments = 40;
const ringGeometry = new THREE.RingGeometry(radiusOut, radiusIn, segments);

//material
const ringMaterialX = new THREE.LineBasicMaterial({color: 0x00FF00, side:THREE.DoubleSide, linewidth: 2});
const ringMaterialY = new THREE.LineBasicMaterial({color: 0xFF0000, side:THREE.DoubleSide, linewidth: 2});
const ringMaterialZ = new THREE.LineBasicMaterial({color: 0x0000FF, side:THREE.DoubleSide, linewidth: 2});

//mesh
const ringX = new THREE.Mesh(ringGeometry, ringMaterialX);
const ringY = new THREE.Mesh(ringGeometry, ringMaterialY);
const ringZ = new THREE.Mesh(ringGeometry, ringMaterialZ);

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

//il cubo
//geometry
const boxWidth = 200;
const boxHeight = 200;
const boxDepth = 200;
const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//material
const boxMaterial = new THREE.MeshPhongMaterial({color: 0xC2C2C2});

//mesh
const cube = new THREE.Mesh(boxGeometry, boxMaterial);

ringX.rotation.x = Math.PI/2;
ringY.rotation.y = Math.PI/2;
group.add(ringX);
group.add(ringY);
group.add(ringZ);
group.add(cube);

scene.add(group);
renderScene(renderer, scene, camera);

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
        currentCursorPosition = getCursorPosition(event.clientX, event.clientY);
        calculateRotationAxis(startCursorPosition, currentCursorPosition);
        let v1 = startCursorPosition.clone();
        let v2 = currentCursorPosition.clone();
        rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
        cursor1Paragraph.innerHTML = "Vector1: "+v1.x+ ", "+v1.y+", "+v1.z;
        cursor2Paragraph.innerHTML = "Vector2: "+v2.x+", "+v2.y+", "+v2.z;
        //rotateObj(cube, rotationAxis, v1.sub(v2).length()/(canvas.clientHeight/3));
        rotateObj(cube, rotationAxis, v1.angleTo(v2))
    }
};



function calculateRotationAxis(vec1, vec2) {
    rotationAxis.crossVectors(vec1, vec2);
    rotationAxis = rotationAxis.normalize();
};

//restituisce le coordinate x, y, z del cursore normalizzate
function getCursorPosition(x, y) {
    let canvasRect = getCanvasRect(renderer);

    //coordinate x/y del cursore rispetto al canvas con valori tra [-1, 1]
    let cursorPosition = new THREE.Vector3();
    /*cursorPosition.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
    cursorPosition.setY(((canvasRect.bottom - y) / canvasRect.height) * 2 - 1);
    cursorPosition.setZ(unprojectZ(cursorPosition.x, cursorPosition.y));*/
    cursorPosition.setX((x-canvasRect.left)-canvasRect.width/2);
    cursorPosition.setY((canvasRect.bottom-y)-canvasRect.height/2);
    cursorPosition.setZ(unprojectZ(cursorPosition.x, cursorPosition.y));
    return cursorPosition;
};

function getCanvasRect(renderer) {
    return renderer.domElement.getBoundingClientRect();
}

function getObjCoord(obj) {
    return obj.getWorldPosition();
};

function renderScene(renderer, scene, camera) {
    resizeRenderer(renderer);
    renderer.render(scene, camera);
}

function resizeRenderer(renderer) {
    const canvas = renderer.domElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const canvasRect = getCanvasRect(renderer);

    if(canvas.width != canvasRect.width || canvas.height != canvasRect.height) {
        renderer.setSize(canvasRect.width, canvasRect.height, false);
    }

    /*if(canvas.width != canvasWidth || canvas.height != canvasHeight)
    {
        renderer.setSize(canvasWidth, canvasHeight, false);
    }*/
};

function rotateObj(obj, axis, rad) {
    let quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, rad);
    quat.multiply(quatState);
    group.setRotationFromQuaternion(quat);
    renderScene(renderer, scene, camera);
};

function unprojectZ(x, y) {
    let radius = getCanvasRect(renderer).height/3;

    let x2 = Math.pow(x, 2);
    let y2 = Math.pow(y, 2);
    let radius2 = Math.pow(radius, 2);

    if(x2+y2 <= radius2) {   
        boxMaterial.color.setHex(0xC2C2C2);
        return Math.sqrt(radius2-(x2+y2));

    }
    else {
        boxMaterial.color.setHex(0x616161);
        //return (radius2/2)/(Math.sqrt(x2+y2));
        return 0;
    }
    /*if(x2+y2 <= radius2/2) {
        boxMaterial.color.setHex(0xFF0000);
        return Math.sqrt(radius2-(x2+y2));
    }
    else {
        boxMaterial.color.setHex(0x44aa88);
        return (radius2/2)/(Math.sqrt(x2+y2));
    }*/
};
