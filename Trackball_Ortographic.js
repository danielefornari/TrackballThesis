import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';

import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvasO");
const loader = new OBJLoader();
const renderer = new THREE.WebGLRenderer({canvas});
const gizmosR = new THREE.Group();
//const group = new THREE.Group();

//defined once and used in some operations
const v2_1 = new THREE.Vector2();
const v3_1 = new THREE.Vector3();
const v3_2 = new THREE.Vector3();
const m4_1 = new THREE.Matrix4();

//transformation matrices
const translateMatrix = new THREE.Matrix4();    //matrix for translation operation
const rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
const scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

const rotationAxis = new THREE.Vector3(); //axis around which perform rotation

//object's state
const objMatrixState = new THREE.Matrix4(); //object's matrix state
let quatState = new THREE.Quaternion().identity(); //rotation gizmos quaternion state

//trackball parameters
const tbCenter = new THREE.Vector3(0, 0, 0);
const radiusScaleFactor = 3;
let tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);

//for touch interaction only
let fingerDistance = 0; //distance between two fingers
let fingerRotation = 0; //rotation thah has been done with two fingers

const currentCursorPosition = new THREE.Vector3();
const startCursorPosition = new THREE.Vector3();

let panKey = false; //if key for pan is down
let tracking = false;  //if true, the cursor movements need to be stored
let notchCounter = 0;   //represent the wheel resulting position
let obj;    //The 3D model
let grid;   //The grid visualized when panning


//mouse/keyboard events
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
        v2_1.copy(getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        startCursorPosition.set(v2_1.x, v2_1.y, 0);
        //drawGrid(startCursorPosition);
        updateMatrixState();
        tracking = true;
    }
});
canvas.addEventListener('mousemove', function mouseMoveListener(event) {
    if(tracking) {
        event.preventDefault();
        console.log("mousemove");
        v2_1.copy(getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        currentCursorPosition.set(v2_1.x, v2_1.y, 0);
        const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        console.log(distanceV);
        v3_1.set(-distanceV.x, -distanceV.y, 0); //translation vector
        translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)

        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(scaleMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);
        //obj.matrix.copy(m4_1);
        renderer.render(scene, camera);
    }
});
canvas.addEventListener('wheel', function wheelListener(event) {
    event.preventDefault();
    console.log("wheel");
    const notchDeltaY = 125;    //distance of one notch on mouse wheel
    const scaleFactor = 1.25;
    const sgn = event.deltaY/notchDeltaY;
    let s = 1;
    notchCounter += sgn;
    if(notchCounter > 0) {
        s = Math.pow(scaleFactor, notchCounter);
    }
    else if(notchCounter < 0) {
        s = 1/(Math.pow(scaleFactor, -notchCounter));
    }
    scaleMatrix.makeScale(s, s, s);

    m4_1.copy(objMatrixState).premultiply(translateMatrix);
    m4_1.premultiply(rotateMatrix);
    m4_1.premultiply(scaleMatrix);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
    //obj.matrix.copy(m4_1);
    renderer.render(scene, camera);
});

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

//window event
window.addEventListener('resize', function windowResizeListener() {
    resizeRenderer(renderer);
    tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    /*group.clear();
    loadObject(renderer.domElement, group);  //replace with scaleObject()
    makeGizmos(tbCenter, tbRadius, group);*/
    renderer.render(scene, camera);
});



//touch gestures
const manager = new Hammer.Manager(canvas);

const singlePan = new Hammer.Pan({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
const doublePan = new Hammer.Pan({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});
const pinch = new Hammer.Pinch();
const rotate = new Hammer.Rotate();
const doubleTap = new Hammer.Tap(({event: 'doubletap', taps: 2}));

manager.add([singlePan, doublePan, pinch, rotate, doubleTap]);
manager.get('doublepan').recognizeWith('singlepan');
manager.get('pinch').recognizeWith('singlepan');
manager.get('rotate').recognizeWith('singlepan');

manager.get('doublepan').requireFailure('pinch');
manager.get('doublepan').requireFailure('rotate');

manager.get('pinch').requireFailure('doublepan');
manager.get('pinch').requireFailure('rotate');

manager.get('rotate').requireFailure('doublepan');
manager.get('rotate').requireFailure('pinch');


//single finger listeners
manager.on('singlepanstart', function singlePanStartListener(event) {
    console.log("singlepanstart");
    updateMatrixState();
    const center = event.center;
    startCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
    if(!panKey) {
        //normal trackball rotation
        activateGizmos(true);
        if(gizmosR.quaternion == "undefined") {
            quatState = new THREE.Quaternion().identity();
        }
        else {
            quatState.copy(gizmosR.quaternion);
        }
    }
    else {
        //perform pan instead of rotation
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
            v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
            currentCursorPosition.set(v2_1.x, v2_1.y, 0);
            const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
            v3_1.set(-distanceV.x, -distanceV.y, 0); //translation vector
            translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    
            m4_1.copy(objMatrixState).premultiply(translateMatrix);
            m4_1.premultiply(scaleMatrix);
            m4_1.decompose(obj.position, obj.quaternion, obj.scale);
            //obj.matrix.copy(m4_1);
            renderer.render(scene, camera);
        }
        else {
            //restart panning routine
            v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
            startCursorPosition.set(v2_1.x, v2_1.y, 0);
            updateMatrixState();
            tracking = true;      
        }
    }
    else {
        //key for pan is not pressed: perform normal trackball rotation
        if(tracking) {
            //key for panning has just been released
            //restart rotation routine
            tracking = false;
            startCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
            quatState.copy(gizmosR.quaternion);
        }
        else {
            //continue with normal rotation routine
            currentCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
            const distanceV = startCursorPosition.clone();
            distanceV.sub(currentCursorPosition);
            console.log(distanceV);
            const angleV = startCursorPosition.angleTo(currentCursorPosition);
            rotateObj(calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
            renderer.render(scene, camera);
        }
    }
});

manager.on('singlepanend', function singlePanEndListener() {
    console.log("singlepanend");
    activateGizmos(false);
    renderer.render(scene, camera);
    tracking = false;
});

manager.on('doubletap', function doubleTapListener(event) {
    const center = event.center;
    updateMatrixState();
    v2_1.copy(getCursorNDC(center.x, center.y, renderer.domElement));
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(v2_1, camera);
    const intersect = raycaster.intersectObject(obj, true);
    if(intersect.length == 0) {
        alert("swiiish");
    }
    else {
        v3_1.copy(intersect[0].point);
        translateMatrix.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);
        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);
        renderer.render(scene, camera);
    }
});

//double finger listener
manager.on("doublepanstart pinchstart rotatestart", twoFingersStartListener);
manager.on("doublepanmove pinchmove rotatemove", twoFingersMoveListener);
manager.on("doublepanend pinchend rotateend", twoFingersEndListener);

function twoFingersStartListener(event) {
    console.log('2FE start');
    const center = event.center;    //middle point between fingers
    v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
    startCursorPosition.set(v2_1.x, v2_1.y, 0);
    fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    fingerRotation = event.rotation;
    //objMatrixState.copy(obj.matrix);
    updateMatrixState();
    quatState.copy(gizmosR.quaternion);
};

function twoFingersMoveListener(event) {
    console.log('2FE move');

    const center = event.center;    //middle point between fingers
    v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement)); //center point between fingers 
    const newDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    const s = newDistance/fingerDistance;   //how much to scale

    //scaling operation X = T(p)S(s)T(-p)
    v3_1.set(v2_1.x, v2_1.y, 0);  //fingers middle point

    scaleMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    m4_1.makeScale(s, s, s);  //S(s)
    scaleMatrix.multiply(m4_1);
    m4_1.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);    //T(-v3_1)
    scaleMatrix.multiply(m4_1);

    //rotation operation    X = T(p)R(r)T(-p)
    const r = (fingerRotation - event.rotation)*Math.PI/180; //angle in radians
    if(r != 0) {
        activateGizmos(true);
    }
    else {
        activateGizmos(false);
    }

    rotateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    v3_2.set(0, 0, 1);
    m4_1.makeRotationAxis(v3_2, r);  //R(rotation)
    gizmosR.setRotationFromQuaternion(quat);
    rotateMatrix.multiply(m4_1);
    m4_1.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);    //T(-v3_1)
    rotateMatrix.multiply(m4_1);

    //rotate gizmos
    const quat = new THREE.Quaternion();
    quat.setFromAxisAngle(v3_2, r);
    quat.multiply(quatState);

    //translation operation T(p)
    v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
    currentCursorPosition.set(v2_1.x, v2_1.y, 0);
    const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
    v3_1.set(-distanceV.x, -distanceV.y, 0);
    translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)

    //apply matrix  TRS
    m4_1.copy(objMatrixState);
    m4_1.premultiply(translateMatrix);
    m4_1.premultiply(rotateMatrix);
    m4_1.premultiply(scaleMatrix);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
    //obj.matrix.copy(m4_1);
    renderer.render(scene, camera);
};

function twoFingersEndListener(event) {
    console.log('2FE end');
    activateGizmos(false);
    //fingerRotation = event.rotation;
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
loadObject(renderer.domElement, loader, gizmosR);
makeGizmos(tbCenter, tbRadius); //add gizmos
scene.add(gizmosR);
resizeRenderer(renderer);
renderer.render(scene, camera);

function activateGizmos(isActive) {
    const gX = gizmosR.children[0];
    const gY = gizmosR.children[1];
    const gZ = gizmosR.children[2];
    if(isActive) {
        console.log('true');
        gX.material.setValues({color: 0x00FF00});
        gY.material.setValues({color: 0xFF0000});
        gZ.material.setValues({color: 0x0000FF});
    }
    else {
        console.log('false');
        gX.material.setValues({color: 0x008000});
        gY.material.setValues({color: 0x800000});
        gZ.material.setValues({color: 0x000080});
    }
};

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

/**
 * Calculate the axis around which perform rotation as cross product between two given vectors
 * @param {THREE.Vector3} vec1 The first vector
 * @param {THREE.Vector3} vec2 The second vector
 * @returns {THREE.Vector3} The normalized vector resulting from cross product between v3_1 and v3_2
 */
function calculateRotationAxis(v3_1, v3_2) {
    return rotationAxis.crossVectors(v3_1, v3_2).normalize();
};

function drawGrid(position) {
    const size = 600;
    const divisions = 30;
    grid = new THREE.GridHelper(size, divisions);
    grid.rotateX(Math.PI/2);
    //orientare la griglia
    gizmosR.add(grid);
}

/**
 * Creates the rotation gizmos with radius equals to the given trackball radius
 * @param {THREE.Vector3} tbCenter The trackball's center
 * @param {number} tbRadius The trackball radius
 */
function makeGizmos(tbCenter, tbRadius) {
    const curve = new THREE.EllipseCurve(tbCenter.x, tbCenter.y, tbRadius, tbRadius);
    const points = curve.getPoints(50);

    //geometry
    const curveGeometry = new THREE.BufferGeometry().setFromPoints(points);

    //material
    const curveMaterialX = new THREE.LineBasicMaterial({color: 0x00A000});
    const curveMaterialY = new THREE.LineBasicMaterial({color: 0xA00000});
    const curveMaterialZ = new THREE.LineBasicMaterial({color: 0x0000A0});

    //line
    const rotationGizmoX = new THREE.Line(curveGeometry, curveMaterialX);
    const rotationGizmoY = new THREE.Line(curveGeometry, curveMaterialY);
    const rotationGizmoZ = new THREE.Line(curveGeometry, curveMaterialZ);

    rotationGizmoX.rotation.x = Math.PI/2;
    rotationGizmoY.rotation.y = Math.PI/2;

    gizmosR.add(rotationGizmoX);
    gizmosR.add(rotationGizmoY);
    gizmosR.add(rotationGizmoZ);
};

/**
* Calculate the cursor position inside the canvas
* @param {number} x Cursor x coordinate in screen space 
* @param {number} y Cursor y coordinate in screen space
* @param {HTMLElement} canvas The canvas where the renderer draws its output
* @returns {THREE.Vector2} Cursor position inside the canvas
*/
function getCursorPosition(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    v2_1.setX((x-canvasRect.left)-canvasRect.width/2);
    v2_1.setY((canvasRect.bottom-y)-canvasRect.height/2);
    return v2_1;
};

/**
 * Calculate the cursor in NDC
 * @param {Nunmber} x Cursor x coordinate in screen space
 * @param {Number} y Cursor y coordinate in screen space
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @returns {THREE.Vector2} Cursor position in NDC
 */
function getCursorNDC(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    v2_1.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
    v2_1.setY(((canvasRect.bottom - y) / canvasRect.height) * 2 - 1);
    return v2_1;
}

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
    loader.load('rocker_arm.obj', function(o) {
        obj = o;
        scene.add(o);
        //group.add(o);
        objMatrixState.copy(o.matrix);
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
 * Perform rotation operation rotating the object along with the trackball gizmos
 * @param {THREE.Vector3} axis Rotation axis
 * @param {number} rad Angle in radians
 */
function rotateObj(axis, rad) {
    console.log("rotating");
    let quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, rad);
    rotateMatrix.makeRotationFromQuaternion(quat);
    quat.multiply(quatState);
    gizmosR.setRotationFromQuaternion(quat);
    m4_1.copy(objMatrixState).premultiply(rotateMatrix);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
};

/**
 * Unproject the cursor on the trackball surface
 * @param {THREE.Vector2} cursor The cursor normalized coordinates inside the canvas
 * @param {number} radius The trackball radius
 * @returns {THREE.Vector3} The unprojected point
 */
function unprojectOnTbSurface(cursor, radius) {
    //x and y positions doesn't change in otrhographic camera
    v3_1.setX(cursor.x);
    v3_1.setY(cursor.y);
    let x2 = Math.pow(cursor.x, 2);
    let y2 = Math.pow(cursor.y, 2);
    let radius2 = Math.pow(radius, 2);

    if(x2+y2 <= radius2/2) {
        //intersection with sphere
        v3_1.setZ(Math.sqrt(radius2-(x2+y2)));
    }
    else {
        //intersection with hyperboloid
        v3_1.setZ((radius2/2)/(Math.sqrt(x2+y2)));
    }
    return v3_1;
};

/**
 * update the object's matrix state with the current object's matrix and reset all transformation matrices
 */
function updateMatrixState() {
    objMatrixState.copy(obj.matrix);

    //reset all matrices because the state has been updated
    translateMatrix.makeTranslation(0, 0, 0);
    rotateMatrix.identity();    //not really needed
    scaleMatrix.makeScale(1, 1, 1);
    notchCounter = 0;
    quatState.copy(gizmosR.quaternion);
};

function applyTransform(translation, rotation, scale) {
    m4_1.copy(objMatrixState).premultiply(translation);
    m4_1.premultiply(rotation);
    m4_1.premultiply(scale);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
}