import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';

import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvasO");
const rotationAxisParagraph = document.getElementById("rotationAxisParagraph");
const cursor1Paragraph = document.getElementById("cursor1Paragraph");
const cursor2Paragraph = document.getElementById("cursor2Paragraph");
const unprojectionParagraph = document.getElementById("unprojectionParagraph");

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const m1 = new THREE.Matrix4();
const m2 = new THREE.Matrix4();
const translateMatrix = new THREE.Matrix4();    //matrix for translation operation
const rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
const scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

const objMatrixState = new THREE.Matrix4(); //objec't matrix state

const loader = new OBJLoader();


//canvas events
canvas.addEventListener('mouseup', function mouseUpListener(event) {
    if(event.button == 1) {
        event.preventDefault();
        console.log("mouseup");
        tracking = false;
    }
});

canvas.addEventListener('mousedown', function mouseDownListener(event) {
    if(event.button == 1) {
        event.preventDefault();
        console.log("mousedown");
        startCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        objMatrixState.copy(obj.matrix);
        notchCounter = 0;   //reset counter because obj matrix state has been updated
        //resetting scale and translation matrix
        translateMatrix.makeTranslation(0, 0, 0);
        scaleMatrix.makeScale(1, 1, 1);
        tracking = true;
    }
});
canvas.addEventListener('mousemove', function mouseMoveListener(event) {
    if(tracking) {
        event.preventDefault();
        console.log("mousemove");
        currentCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        //const distanceV = v1.copy(startCursorPosition).sub(currentCursorPosition);
        v1.set(-distanceV.x, 0, 0); //translation on world X axis
        v2.set(0, -distanceV.y, 0); //translation on world y axis
        v1.add(v2); //translation vector
        group.worldToLocal(v1);
        translateMatrix.makeTranslation(v1.x, v1.y, v1.z);   //T(v1)

        m1.copy(objMatrixState).premultiply(translateMatrix);
        m1.premultiply(scaleMatrix);
        m1.decompose(obj.position, obj.quaternion, obj.scale);
        //obj.matrix.copy(m1);
        renderer.render(scene, camera);
    }
});
canvas.addEventListener('wheel',function wheelListener(event) {
    event.preventDefault();
    console.log("wheel");
    const scaleFactor = 1.1;
    const sgn = Math.sign(event.deltaY);
    let s = 1;
    notchCounter += sgn;
    if(notchCounter > 0) {
        s = Math.pow(scaleFactor, notchCounter);
    }
    else if(notchCounter < 0) {
        s = 1/(Math.pow(scaleFactor, -notchCounter));
    }
    scaleMatrix.makeScale(s, s, s);

    m1.copy(objMatrixState).premultiply(translateMatrix);
    m1.premultiply(scaleMatrix);
    m1.decompose(obj.position, obj.quaternion, obj.scale);
    //obj.matrix.copy(m1);
    renderer.render(scene, camera);
});

function windowResizeListener() {
    resizeRenderer(renderer);
    tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    /*group.clear();
    loadObject(renderer.domElement, group);  //replace with scaleObject()
    makeGizmos(tbCenter, tbRadius, group);*/
    renderer.render(scene, camera);
};

document.addEventListener('keydown', function keyDownListener(event) {
    /*if(event.ctrlKey || event.metaKey) {
        console.log("keydown");
        panKey = true;
    }*/    
    if(event.key == 'c') {
        panKey = true;
    }
});
document.addEventListener('keyup', function keyUpListener(event) {
    /*if(event.ctrlKey || event.metaKey) {
        console.log("keyup");
        panKey = false;
    }*/
    if(event.key == 'c') {
        panKey = false;
    }
});
window.addEventListener('resize', windowResizeListener);

const renderer = new THREE.WebGLRenderer({canvas});
const group = new THREE.Group();

//trackball parameters
const tbCenter = new THREE.Vector3(0, 0, 0);
const radiusScaleFactor = 3;
let tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);

let fingerDistance = 0;
let fingerRotation = 0;
let panKey = false; //if key for pan is down
let tracking = false;  
let currentCursorPosition = new THREE.Vector3();
let startCursorPosition = new THREE.Vector3();
let rotationAxis = new THREE.Vector3();
let notchCounter = 0;   //represent the number of wheel nothes from the initial position
let obj;    //The 3D model
let quatState = new THREE.Quaternion().identity(); //object's quaternion value at first mouse click/tap

//touch gestures
const manager = new Hammer.Manager(canvas);

const singlePan = new Hammer.Pan();
const doublePan = new Hammer.Pan();
const pinch = new Hammer.Pinch();
const rotate = new Hammer.Rotate();

singlePan.set({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
doublePan.set({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});
pinch.set({threshold: 0});
rotate.set({threshold: 0});

manager.add([singlePan, doublePan, pinch, rotate]);
manager.get('doublepan').recognizeWith('singlepan');
manager.get('pinch').recognizeWith('singlepan');
manager.get('rotate').recognizeWith('singlepan');

manager.get('doublepan').requireFailure('pinch');
manager.get('doublepan').requireFailure('rotate');

manager.get('pinch').requireFailure('doublepan');
manager.get('pinch').requireFailure('rotate');

manager.get('rotate').requireFailure('doublepan');
manager.get('rotate').requireFailure('pinch');


//single finger pan gesture listeners
manager.on('singlepanstart', function singlePanStartListener(event) {
    console.log("singlepanstart");
    const center = event.center;
    startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    if(!panKey) {
        //normal trackball rotation
        if(group.quaternion == "undefined") {
            quatState = new THREE.Quaternion().identity();
        }
        else {
            quatState.copy(group.quaternion);
        }
    }
    else {
        //perform pan instead of rotation
        objMatrixState.copy(obj.matrix);
        notchCounter = 0;   //reset counter because obj matrix state has been updated
        //resetting scale and translation matrix
        translateMatrix.makeTranslation(0, 0, 0);
        scaleMatrix.makeScale(1, 1, 1);
        tracking = true;
    }
});

manager.on('singlepanmove', function singlePanMoveListener(event) {
    console.log("singlepanmove");
    const center = event.center;
    if(panKey) {
        //key for pan has been pressed: perform pan instead of rotation
        if(tracking) {
            //already panning, continue with panning routine
            console.log("mousemove");
            //currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
            const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
            //const distanceV = v1.copy(startCursorPosition).sub(currentCursorPosition);
            v1.set(-distanceV.x, 0, 0); //translation on world X axis
            v2.set(0, -distanceV.y, 0); //translation on world y axis
            v1.add(v2); //translation vector
            group.worldToLocal(v1);
            translateMatrix.makeTranslation(v1.x, v1.y, v1.z);   //T(v1)
    
            m1.copy(objMatrixState).premultiply(translateMatrix);
            m1.premultiply(scaleMatrix);
            m1.decompose(obj.position, obj.quaternion, obj.scale);
            //obj.matrix.copy(m1);
            renderer.render(scene, camera);
        }
        else {
            //restart panning routine
            startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
            objMatrixState.copy(obj.matrix);
            notchCounter = 0;   //reset counter because obj matrix state has been updated
            //resetting scale and translation matrix
            translateMatrix.makeTranslation(0, 0, 0);
            scaleMatrix.makeScale(1, 1, 1);
            tracking = true;      
        }
    }
    else {
        //key for pan is not pressed: perform normal trackball rotation
        if(tracking) {
            //key for panning has just been released
            //restart rotation routine
            tracking = false;
            startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
            quatState.copy(group.quaternion);
            //singlePanStartListener(event);  //restart rotation routine
        }
        else {
            //continue with normal rotation routine
            currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
            const distanceV = startCursorPosition.clone();
            distanceV.sub(currentCursorPosition);
            //const distanceV = v1.copy(startCursorPosition).sub(currentCursorPosition);
            const angleV = startCursorPosition.angleTo(currentCursorPosition);
            rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
            cursor1Paragraph.innerHTML = "Vector1: "+startCursorPosition.x+ ", "+startCursorPosition.y+", "+startCursorPosition.z;
            cursor2Paragraph.innerHTML = "Vector2: "+currentCursorPosition.x+", "+currentCursorPosition.y+", "+currentCursorPosition.z;
            rotateObj(group, calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
            renderer.render(scene, camera);
        }
    }
});
manager.on('singlepanend', function singlePanEndListener() {
    console.log("singlepanend");
    tracking = false;
});

//double finger gestures listener
manager.on("doublepanstart pinchstart rotatestart", twoFingersStartListener);
manager.on("doublepanmove pinchmove rotatemove", twoFingersMoveListener);
manager.on("doublepanend pinchend rotateend", twoFingersEndListener);


function twoFingersStartListener(event) {
    console.log('2FE start');
    const center = event.center;    //middle point between fingers
    startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    fingerRotation = event.rotation;
    objMatrixState.copy(obj.matrix);
};

function twoFingersMoveListener(event) {
    console.log('2FE move');
    /*const scaleMatrix = new THREE.Matrix4();
    const rotateMatrix = new THREE.Matrix4();
    const translateMatrix = new THREE.Matrix4();*/

    const center = event.center;
    const p = getCursorPosition(center.x, center.y, renderer.domElement); //center point between fingers
    const newDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    const s = newDistance/fingerDistance;   //how much scale

    //scaling operation X = T(p)S(s)T(-p)
    v1.set(p.x, 0, 0);  //fingers middle point on x axis
    v2.set(0, p.y, 0);  //fingers middle point on y axis
    v1.add(v2);
    group.worldToLocal(v1);

    scaleMatrix.makeTranslation(v1.x, v1.y, v1.z);   //T(v1)
    m1.makeScale(s, s, s);  //S(s)
    scaleMatrix.multiply(m1);
    m1.makeTranslation(-v1.x, -v1.y, -v1.z);    //T(-v1)
    scaleMatrix.multiply(m1);
    //scaleMatrix.copy(m1);

    //rotation operation    X = T(p)R(r)T(-p)
    const r = (fingerRotation - event.rotation)*Math.PI/180; //angle in radians
    v1.set(p.x, 0, 0);
    v2.set(0, p.y, 0);
    v1.add(v2);
    group.worldToLocal(v1);

    rotateMatrix.makeTranslation(v1.x, v1.y, v1.z);   //T(v1)
    v2.set(0, 0, 1);
    group.worldToLocal(v2);
    m1.makeRotationAxis(v2, r);  //R(rotation)

    rotateMatrix.multiply(m1);
    m1.makeTranslation(-v1.x, -v1.y, -v1.z);    //T(-v1)
    rotateMatrix.multiply(m1);
    //rotateMatrix.copy(m1);

    //translation operation T(p)
    currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
    //const distanceV = v1.copy(startCursorPosition).sub(currentCursorPosition);
    v1.set(-distanceV.x, 0, 0);
    v2.set(0, -distanceV.y, 0);
    v1.add(v2);
    group.worldToLocal(v1);
    translateMatrix.makeTranslation(v1.x, v1.y, v1.z);   //T(v1)
    //translateMatrix.copy(m1);

    //apply matrix  TRS
    m1.copy(objMatrixState);
    m1.premultiply(translateMatrix);
    m1.premultiply(rotateMatrix);
    m1.premultiply(scaleMatrix);

    /*translateMatrix.multiply(rotateMatrix);
    translateMatrix.multiply(scaleMatrix);
    m1.premultiply(translateMatrix);*/

    m1.decompose(obj.position, obj.quaternion, obj.scale);
    //obj.matrix.copy(m1);
    renderer.render(scene, camera);
};

function twoFingersEndListener(event) {
    console.log('2FE end');
    fingerRotation = event.rotation;
};


//camera
const canvasRect = canvas.getBoundingClientRect();
const left = canvasRect.width/-2;
const right = canvasRect.width/2;
const top = canvasRect.height/2;
const bottom = canvasRect.height/-2;
const near = 0.1;
const far = 1000;
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);
camera.position.z = 500;

//scene
const scene = new THREE.Scene();
scene.add(camera);

//light
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);


//obj = loadObject(renderer.domElement, group); //load the 3D object
loadObject(renderer.domElement, loader, group);
makeGizmos(tbCenter, tbRadius, group); //add gizmos
scene.add(group);
resizeRenderer(renderer);
renderer.render(scene, camera);



/**
 * Calcualte the distance between two pointers
 * @param {PointerEvent} p0 The first pointer
 * @param {PointerEvent} p1 The second pointer
 * @returns {number} The distance between the two pointers 
 */
function calculateDistance(p0, p1) {
    return Math.sqrt(Math.pow(p1.clientX - p0.clientX, 2)+Math.pow(p1.clientY - p0.clientY, 2));
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
function loadObject(canvas, loader, group) {
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
    loader.load('http://192.168.1.33:8080/rocker_arm.obj', function(o) {
        obj = o;
        group.add(o);
    });

    //const cube = new THREE.Mesh(boxGeometry, boxMaterial);
    //objMatrixState.copy(cube.matrix);
    //objMatrixState.copy(obj.matrix);
    //cube.matrixAutoUpdate = false;
    //group.add(cube);
    //group.add(obj);
    //return cube;
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
 * Rotate an object around given axis by given radians
 * @param {THREE.Object3D} obj Object to be roteted
 * @param {THREE.Vector3} axis Rotation axis
 * @param {number} rad Angle in radians
 */
function rotateObj(obj, axis, rad) {
    console.log("rotating");
    let quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, rad);
    quat.multiply(quatState);
    obj.setRotationFromQuaternion(quat);
};


/**
 * Unproject the cursor in screen space into a point in world space on the trackball surface
 * @param {number} x The cursor x position
 * @param {number} y The cursor y position
 * @param {number} radius The trackball radius
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





//fare quello che faccio con wheel ma al contrario per il pan o altro modo?