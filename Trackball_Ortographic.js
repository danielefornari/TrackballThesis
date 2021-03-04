import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvasO");
const rotationAxisParagraph = document.getElementById("rotationAxisParagraph");
const cursor1Paragraph = document.getElementById("cursor1Paragraph");
const cursor2Paragraph = document.getElementById("cursor2Paragraph");
const unprojectionParagraph = document.getElementById("unprojectionParagraph");

//canvas events
/*canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);
canvas.addEventListener('mouseleave', mouseUpListener);*/
window.addEventListener('resize', windowResizeListener);

const renderer = new THREE.WebGLRenderer({canvas});
const group = new THREE.Group();

//trackball parameters
const tbCenter = new THREE.Vector3(0, 0, 0);
const radiusScaleFactor = 3;
let tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);

let tracking = false;
let currentCursorPosition = new THREE.Vector3();
let startCursorPosition = new THREE.Vector3();
let rotationAxis = new THREE.Vector3();
let obj;    //The 3D model
let quatState = new THREE.Quaternion(); //object's quaternion value at first mouse click/tap

const manager = new Hammer(canvas);
manager.get('pan').set({direction: Hammer.DIRECTION_ALL});
manager.on("panup pandown panleft panright", panManager);
manager.on("panstart", panStartManager);
manager.on("panend", function panEnd() {
    console.log("panEnd");
    tracking = false;
});

function panStartManager(event) {
    console.log("panStart");
    let center = event.center;
    if(group.quaternion == "undefined") {
        quatState = new THREE.Quaternion().identity();
    }
    else {
        quatState.copy(group.quaternion);
    }
    startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    tracking = true;
};

function panManager(event) {
    console.log("onPan");
    let center = event.center;
    currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    let distanceV = startCursorPosition.clone();
    distanceV.sub(currentCursorPosition);
    let angleV = startCursorPosition.angleTo(currentCursorPosition);
    //rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
    cursor1Paragraph.innerHTML = "Vector1: "+startCursorPosition.x+ ", "+startCursorPosition.y+", "+startCursorPosition.z;
    cursor2Paragraph.innerHTML = "Vector2: "+currentCursorPosition.x+", "+currentCursorPosition.y+", "+currentCursorPosition.z;
    rotateObj(group, calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
    renderer.render(scene, camera);
};


//camera
const canvasRect = canvas.getBoundingClientRect();
const left = canvasRect.width/-2;
const right = canvasRect.width/2;
const top = canvasRect.height/2;
const bottom = canvasRect.height/-2;
const near = 0.1;
const far = 2000;
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
camera.position.z = 400;

//scene
const scene = new THREE.Scene();
scene.add(camera);

//light
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

obj = loadObject(renderer.domElement, group); //load the 3D object
makeGizmos(tbCenter, tbRadius, group); //add gizmos
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
    startCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
    tracking = true;
};

function mouseMoveListener(event) {
    if(tracking) {
        currentCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
        cursor1Paragraph.innerHTML = "Vector1: "+startCursorPosition.x+ ", "+startCursorPosition.y+", "+startCursorPosition.z;
        cursor2Paragraph.innerHTML = "Vector2: "+currentCursorPosition.x+", "+currentCursorPosition.y+", "+currentCursorPosition.z;

        let distanceV = startCursorPosition.clone();
        distanceV.sub(currentCursorPosition);
        let angleV = startCursorPosition.angleTo(currentCursorPosition);

        rotateObj(group, calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
        renderer.render(scene, camera);
    }
};

function windowResizeListener() {
    resizeRenderer(renderer);
    tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    /*group.clear();
    loadObject(renderer.domElement, group);  //replace with scaleObject()
    makeGizmos(tbCenter, tbRadius, group);*/
    renderer.render(scene, camera);
};


/**
 * Calculate the trackball radius based on the canvas size and the scaling factor
 * @param {number} radiusScaleFactor Scaling factor for reducing radius length
 * @param {HTMLElement} canvas The canvas where the renderer draws its output 
 * @returns {number} Radius of the trackball
 */
function calculateRadius(radiusScaleFactor, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    if(canvasRect.height <= canvasRect.width) {
        return canvasRect.height/radiusScaleFactor;
    }
    else {
        return canvasRect.width/radiusScaleFactor;
    }
};

function calculateRotationAxis(vec1, vec2) {
    return rotationAxis.crossVectors(vec1, vec2).normalize();
};

/**
 * Creates the rotation gizmos with radius equals to the given trackball radius
 * @param {THREE.Vector3} tbCenter The trackball's center
 * @param {number} tbRadius The trackball radius
 * @param {THREE.Group} group The group to add gizmos to
 */
function makeGizmos(tbCenter, tbRadius, group) {
    //rotation gizmos

    const curve = new THREE.EllipseCurve(tbCenter.x, tbCenter.y, tbRadius, tbRadius);
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

/**
* Given cursor x/y position within the viewport, return corrensponding position in world space
* @param {number} x Cursor x position in screen space 
* @param {number} y Cursor y position in screen space
* @param {HTMLElement} canvas The canvas where the renderer draws its output
* @returns {THREE.Vector3} Cursor position in world space
*/
function getCursorPosition(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    const cursorPosition = new THREE.Vector3();
    cursorPosition.setX((x-canvasRect.left)-canvasRect.width/2);
    cursorPosition.setY((canvasRect.bottom-y)-canvasRect.height/2);
    cursorPosition.setZ(unprojectZ(cursorPosition.x, cursorPosition.y, tbRadius));
    return cursorPosition;
};

function getCanvasRect(renderer) {
    return renderer.domElement.getBoundingClientRect();
}

function getObjCoord(obj) {
    return obj.getWorldPosition();
};

/**
 * load a 3D object and add it to the scene
 * for testing purpose, builds a cube and add to scene
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @param {THREE.Group} group The group to add object to
 */
function loadObject(canvas, group) {
    const canvasRect = canvas.getBoundingClientRect();

    //test cube
    const boxWidth = canvasRect.height/4;
    const boxHeight = canvasRect.height/4;
    const boxDepth = canvasRect.height/4;

    //geometry
    const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

    //material
    const boxMaterial = new THREE.MeshPhongMaterial({color: 0xC2C2C2});

    //mesh
    const cube = new THREE.Mesh(boxGeometry, boxMaterial);
    group.add(cube);
    return cube;
}

/**
 * Set renderer size to correctly match the size of the canvas where renderer is drawing into
 * @param {THREE.WebGlRenderer} renderer The renderer
 */
function resizeRenderer(renderer) {
    const canvas = renderer.domElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if(canvas.width != canvasWidth || canvas.height != canvasHeight) {
        renderer.setSize(canvasWidth, canvasHeight, false);
    }
};

/**
 * Rotate an object along given axis by given radians
 * @param {THREE.Object3D} obj Object to be roteated
 * @param {THREE.Vector3} axis Rotation axis
 * @param {number} rad Angle in radians
 */
function rotateObj(obj, axis, rad) {
    let quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, rad);
    quat.multiply(quatState);
    obj.setRotationFromQuaternion(quat);
};

/**
 * Unproject the cursor in screen space into a point in world space on the trackball surface
 * @param {} x The cursor x position
 * @param {*} y The cursor y position
 * @param {*} radius The trackball radius
 */
function unprojectZ(x, y, radius) {
    let x2 = Math.pow(x, 2);
    let y2 = Math.pow(y, 2);
    let radius2 = Math.pow(radius, 2);

    if(x2+y2 <= radius2/2) {
        return Math.sqrt(radius2-(x2+y2));
    }
    else {
        return (radius2/2)/(Math.sqrt(x2+y2));
    }
};