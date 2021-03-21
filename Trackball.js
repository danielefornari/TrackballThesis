import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';

import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvasP");
const loader = new OBJLoader();
const renderer = new THREE.WebGLRenderer({canvas});
const group = new THREE.Group();

//defined once and used in some operations
const v2_1 = new THREE.Vector2();
const v3_1 = new THREE.Vector3();
const v3_2 = new THREE.Vector3();
const m4_1 = new THREE.Matrix4();

//transformation matrices
const translateMatrix = new THREE.Matrix4();    //matrix for translation operation
const rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
const scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

const rotationAxis = new THREE.Vector3();

//object's state
const objMatrixState = new THREE.Matrix4(); //object's matrix state
let quatState = new THREE.Quaternion(); //object's quaternion value at first mouse click/tap

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

//mouse/keyboard events
canvas.addEventListener('mouseup', function mouseUpListener(event) {
    if(event.button == 1) {
        event.preventDefault();
        console.log("mouseup");
        tracking = false;
    }
});
canvas.addEventListener('mousemove', function mouseMoveListener(event) {
    if(tracking) {
        event.preventDefault();
        console.log("mousemove");
        //currentCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        currentCursorPosition.copy(unprojectOnTbPlane(camera, getCursorPosition(event.clientX, event.clientY, renderer.domElement)));
        const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        console.log(distanceV);
        v3_1.set(-distanceV.x, 0, 0); //translation on world X axis
        v3_2.set(0, -distanceV.y, 0); //translation on world y axis
        v3_1.add(v3_2);
        group.worldToLocal(v3_1);
        translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)

        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(scaleMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);
        //obj.matrix.copy(m4_1);
        renderer.render(scene, camera);
    }
});
canvas.addEventListener('mousedown', function mouseDownListener(event) {
    if(event.button == 1) {
        event.preventDefault();
        console.log("mousedown");
        //startCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        startCursorPosition.copy(unprojectOnTbPlane(camera, getCursorPosition(event.clientX, event.clientY, renderer.domElement)));
        updateMatrixState();
        tracking = true;
    }
});
canvas.addEventListener('wheel', function wheelListener(event) {
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

    m4_1.copy(objMatrixState).premultiply(translateMatrix);
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
window.addEventListener('resize', function windowResizeListener(){
    resizeRenderer(renderer);
    tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    camera.position.z = tbRadius*4;
    group.clear();
    loadObject(renderer.domElement, loader, group);  //replace with scaleObject()
    makeGizmos(tbCenter, tbRadius, group);
    renderer.render(scene, camera);
});


//touch gestures
const manager = new Hammer(canvas);

const singlePan = new Hammer.Pan();
const doublePan = new Hammer.Pan();
const pinch = new Hammer.Pinch();
const rotate = new Hammer.Rotate();
const doubleTap = new Hammer.Tap({event: 'doubletap', taps: 2});

singlePan.set({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
doublePan.set({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});
//doubleTap.set({event: 'doubletap', taps: 2});

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

//single finger listener
manager.on('singlepanstart', function singlePanStartListener(event) {
    console.log("singlepanstart");
    const center = event.center;
    startCursorPosition.copy(unprojectOnTbSurface(camera, getCursorPosition(center.x, center.y, renderer.domElement), tbCenter, tbRadius)); 
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
        updateMatrixState();
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
            currentCursorPosition.copy(unprojectOnTbSurface(camera, getCursorPosition(center.x, center.y, renderer.domElement), tbCenter, tbRadius));
            const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
            v3_1.set(-distanceV.x, 0, 0); //translation on world X axis
            v3_2.set(0, -distanceV.y, 0); //translation on world y axis
            v3_1.add(v3_2); //translation vector
            group.worldToLocal(v3_1);
            translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    
            m4_1.copy(objMatrixState).premultiply(translateMatrix);
            m4_1.premultiply(scaleMatrix);
            m4_1.decompose(obj.position, obj.quaternion, obj.scale);
            //obj.matrix.copy(m4_1);
            renderer.render(scene, camera);
        }
        else {
            //restart panning routine
            startCursorPosition.copy(unprojectOnTbPlane(camera, getCursorPosition(center.x, center.y, renderer.domElement))); 
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
            startCursorPosition.copy(unprojectOnTbSurface(camera, getCursorPosition(center.x, center.y, renderer.domElement), tbCenter, tbRadius)); 
            quatState.copy(group.quaternion);
        }
        else {
            //continue with normal rotation routine
            currentCursorPosition.copy(unprojectOnTbSurface(camera, getCursorPosition(center.x, center.y, renderer.domElement), tbCenter, tbRadius)); 
            const distanceV = startCursorPosition.clone();
            distanceV.sub(currentCursorPosition);
            const angleV = startCursorPosition.angleTo(currentCursorPosition);
            rotateObj(group, calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
            renderer.render(scene, camera);
        }
    }
});

manager.on('singlepanend', function singlePanEndListener() {
    console.log("singlepanend");
    tracking = false;
});

manager.on('doubletap', function doubleTapListener(event) {
    const center = event.center;
    updateMatrixState();
    v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(v2_1, camera);
    const intersect = raycaster.intersectObject(obj, true);
    if(intersect.length == 0) {
        alert("swiiish");
    }
    else {
        v3_1.copy(intersect[0].point);
        group.worldToLocal(v3_1);
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
    startCursorPosition.copy(unprojectOnTbPlane(camera, getCursorPosition(center.x, center.y, renderer.domElement)));
    //startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    fingerRotation = event.rotation;
    objMatrixState.copy(obj.matrix);
};

function twoFingersMoveListener(event) {
    console.log('2FE move');

    const center = event.center;    //middle point between fingers
    //const p1 = getCursorPosition(center.x, center.y, renderer.domElement); //center point between fingers
    const p = unprojectOnTbPlane(camera, getCursorPosition(center.x, center.y, renderer.domElement));
    const newDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    const s = newDistance/fingerDistance;   //how much to scale

    //scaling operation X = T(p)S(s)T(-p)
    v3_1.set(p.x, 0, 0);  //fingers middle point on x axis
    v3_2.set(0, p.y, 0);  //fingers middle point on y axis
    v3_1.add(v3_2);
    group.worldToLocal(v3_1);

    scaleMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    m4_1.makeScale(s, s, s);  //S(s)
    scaleMatrix.multiply(m4_1);
    m4_1.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);    //T(-v3_1)
    scaleMatrix.multiply(m4_1);

    //rotation operation    X = T(p)R(r)T(-p)
    const r = (fingerRotation - event.rotation)*Math.PI/180; //angle in radians
    v3_1.set(p.x, 0, 0);
    v3_2.set(0, p.y, 0);
    v3_1.add(v3_2);
    group.worldToLocal(v3_1);

    rotateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    v3_2.set(0, 0, 1);
    group.worldToLocal(v3_2);
    m4_1.makeRotationAxis(v3_2, r);  //R(rotation)

    rotateMatrix.multiply(m4_1);
    m4_1.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);    //T(-v3_1)
    rotateMatrix.multiply(m4_1);

    //translation operation T(p)
    currentCursorPosition.copy(unprojectOnTbPlane(camera, getCursorPosition(center.x, center.y, renderer.domElement)));
    const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
    v3_1.set(-distanceV.x, 0, 0);
    v3_2.set(0, -distanceV.y, 0);
    v3_1.add(v3_2);
    group.worldToLocal(v3_1);
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
    //fingerRotation = event.rotation;
};


//camera
const fov = 45;
const aspect = canvas.clientWidth/canvas.clientHeight;
const zPosition = tbRadius*3.5;
const near = 1;
const far = Math.abs(zPosition*2)-near;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = zPosition;

//scene
const scene = new THREE.Scene();
scene.add(camera);

//light
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

//obj = loadObject(renderer.domElement, group);    //load the 3D object
loadObject(renderer.domElement, loader, group);
makeGizmos(tbCenter, tbRadius, group);  //add gizmos
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

/**
 * Calculate the rotation axis as the vector perpendicular vector between two vectors
 * @param {THREE.Vector3} vec1 The first vector
 * @param {THREE.Vector3} vec2 The second vector
 * @returns {THREE.Vector3} The normalized rotation axis
 */
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
 * Calculate the cursor normalized position inside the canvas
 * @param {number} x Cursor x position in screen space 
 * @param {number} y Cursor y position in screen space
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @returns {THREE.Vector2} Cursor normalized position inside the canvas
 */
function getCursorPosition(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    const cursorPosition = new THREE.Vector2();
    cursorPosition.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
    cursorPosition.setY(((canvasRect.bottom - y) / canvasRect.height) * 2 - 1);
    return cursorPosition;
    /*let worldPosition = unprojection(camera, cursorPosition, tbCenter, tbRadius);
    return worldPosition;*/
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
    loader.load('rocker_arm.obj', function(o) {
        obj = o;
        group.add(o);
        objMatrixState.copy(o.matrix);
    });

    /*const cube = new THREE.Mesh(boxGeometry, boxMaterial);
    group.add(cube);
    return cube;*/
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
 * Unproject the cursor on the trackball surface
 * @param {THREE.Camera} camera The camera
 * @param {THREE.Vector2} cursor The cursor normalized coordinates inside the canvas
 * @param {THREE.Vector3} tbCenter The trackball center
 * @param {number} tbRadius The trackball radius
 * @returns {THREE.Vector3} The unprojected cursor coordinates in the trackball surface
 */
function unprojectOnTbSurface(camera, cursor, tbCenter, tbRadius) {
    const nearPlanePoint = new THREE.Vector3(cursor.x, cursor.y, -1);
    nearPlanePoint.unproject(camera);   //unproject cursor on near plane
    const r0 = camera.position.clone(); //vector origin
    const rDir = new THREE.Vector3().subVectors(nearPlanePoint, r0).normalize() ;    //direction vector
    const hitPoint = new THREE.Vector2();   //intersesction point between the unprojected ray and the trackball surface
    const radius2 = Math.pow(tbRadius, 2);

    //for intersection with trackball's surface, consider 2D axes (X', Y') instead of 3D (X, Y, Z)
    //Y' = Z
    //X' = asse lungo cui si sviluppa la distanza dal centro della trackball al punto sulla sfera su Z=0
    const h = nearPlanePoint.z - camera.position.z; //distance from camera to the point on near plane along Y' axis
    const l = Math.sqrt(Math.pow(nearPlanePoint.x, 2)+Math.pow(nearPlanePoint.y, 2));   //distance from camera to the point on near plane along X' axis

    const m = h/l;
    const q = camera.position.z;

    let a = Math.pow(m, 2)+1;
    let b = 2*m*q;
    let c = Math.pow(q, 2)-radius2;
    let delta = Math.pow(b, 2)-(4*a*c);

    if(delta >= 0) {
        //intersection with sphere
        hitPoint.x = (-b-Math.sqrt(delta))/(2*a);
        hitPoint.y = m*hitPoint.x+q;
        let angle = hitPoint.angle()*180/Math.PI;
        if(angle >= 45) {
            //if angle between intersection point and X' axis is >= 45°, return that point
            //otherwise, calculate intersection point with hyperboloid
            let d = new THREE.Vector2(0, camera.position.z).distanceTo(hitPoint);
            return r0.add(rDir.multiplyScalar(d));
        }
    }
    //intersection with hyperboloid
    a = m;
    b = q;
    c = -radius2/2;
    delta = Math.pow(b, 2)-(4*a*c);
    hitPoint.x = (-b-Math.sqrt(delta))/(2*a);
    hitPoint.y = m*hitPoint.x+q;
    let d = new THREE.Vector2(0, camera.position.z).distanceTo(hitPoint);
    return r0.add(rDir.multiplyScalar(d));
};


/**
 * Unproject the cursor on the plane passing through the center of the trackball orthogonal to the camera
 * @param {THREE.Camera} camera The camera
 * @param {THREE.Vector2} cursor Cursor coordinates in screen space
 * @returns {THREE.Vector3} The unprojected point
 */
function unprojectOnTbPlane(camera, cursor) {
    //unproject cursor on the near plane
    v3_1.set(cursor.x, cursor.y, -1);
    v3_1.unproject(camera);
    const r0 = camera.position.clone(); //vector origin
    const rDir = new THREE.Vector3().subVectors(v3_1, r0).normalize() ;    //direction vector

    const h = v3_1.z - camera.position.z;
    const l = Math.sqrt(Math.pow(v3_1.x, 2)+Math.pow(v3_1.y, 2));

    const m = h/l;
    const q = camera.position.z;
    const x = -q/m;

    const d = Math.sqrt(Math.pow(q, 2) + Math.pow(x, 2));
    return r0.add(rDir.multiplyScalar(d));
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
};