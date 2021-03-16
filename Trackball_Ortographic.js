import * as THREE from 'https://unpkg.com/three/build/three.module.js';
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
const m3 = new THREE.Matrix4();

const objMatrixState = new THREE.Matrix4();

//canvas events
canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);
canvas.addEventListener('mousedown', mouseClickListener);
canvas.addEventListener('wheel', wheelListener);
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
        posState.copy(obj.position);
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
let panning = false;    //if panning operation is being performed (non touch only)
let pinching = false;
let rotating = false;   //probabilmente non serve
let tracking = false;  
let currentCursorPosition = new THREE.Vector3();
let startCursorPosition = new THREE.Vector3();
let fingersMiddle = new THREE.Vector3(); //coordinates of the point between two fingers
let rotationAxis = new THREE.Vector3();
let notchCounter = 0;   //represent the number of wheel nothes from the initial position
let obj;    //The 3D model
let quatState = new THREE.Quaternion().identity(); //object's quaternion value at first mouse click/tap
let posState = new THREE.Vector3(0, 0, 0); //object's position vector
let scaleState = 1;   //object's scale factor (uniform scaling)

//object's components state
const objPosition = new THREE.Matrix4();
const objRotation = new THREE.Matrix4();
const objScale = new THREE.Matrix4();

//touch gestures
const manager = new Hammer.Manager(canvas);

const singlePan = new Hammer.Pan();
const doublePan = new Hammer.Pan();
const pinch = new Hammer.Pinch();
const rotate = new Hammer.Rotate();

singlePan.set({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
doublePan.set({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});    //threshold 7.5
pinch.set({threshold: 0});  //threshold 0.05
rotate.set({threshold: 0});

//manager.add([singlePan, doublePan, pinch, rotate]);
manager.add([singlePan, doublePan, pinch]);
manager.get('doublepan').recognizeWith('singlepan');    //se dal singlepan aggiungo un dito, riconosce il doublepan e continua con quello
manager.get('pinch').recognizeWith('singlepan');    //mentre è in corso singlepan, può riconoscere anche pinch
manager.get('doublepan').recognizeWith('pinch');


//single finger pan gesture listeners
manager.on('singlepanstart', singlePanStartListener);
function singlePanStartListener(event) {
    console.log("singlepanstart");
    let center = event.center;
    startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    if(!panKey) {
        //normal trackball rotation
        if(group.quaternion == "undefined") {
            quatState = new THREE.Quaternion().identity();
        }
        else {
            quatState.copy(group.quaternion);
        }
        rotating = true;
    }
    else {
        //perform pan instead of rotation
        panning = true;
    }
};
manager.on('singlepanmove', function singlePanMoveListener(event) {
    console.log("singlepanmove");
    if(panKey) {
        //perform pan instead of rotation
        if(panning) {
            //continue with panning routine
            doublePanMoveListener(event);
        }
        else {
            //restart panning routine
            const center = event.center;
            startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
            panning = true;
        }
    }
    else {
        //normal trackball rotation
        if(panning) {
            //key for panning has just been released
            panning = false;
            singlePanStartListener(event);  //restart rotation routine
        }
        else {
            //continue with normal rotation routine
            if(rotating) {
                let center = event.center;
                currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
                let distanceV = startCursorPosition.clone();
                distanceV.sub(currentCursorPosition);
                let angleV = startCursorPosition.angleTo(currentCursorPosition);
                rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
                cursor1Paragraph.innerHTML = "Vector1: "+startCursorPosition.x+ ", "+startCursorPosition.y+", "+startCursorPosition.z;
                cursor2Paragraph.innerHTML = "Vector2: "+currentCursorPosition.x+", "+currentCursorPosition.y+", "+currentCursorPosition.z;
                rotateObj(group, calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
                renderer.render(scene, camera);
            }
        }
    }
});
manager.on('singlepanend', function singlePanEndListener() {
    console.log("singlepanend");
    if(panKey) {
        posState.copy(obj.position);
    }
    else {
        rotating = true;
    }
});

//double finger pan gesture listener
manager.on('doublepanstart', function doublePanStartListener(event) {
    console.log("doublepanstart");
    const center = event.center;
    startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    objMatrixState.copy(obj.matrix);
});
manager.on('doublepanmove', doublePanMoveListener);
function doublePanMoveListener(event) {
    console.log("doublePan");
    panning = true;
    const center = event.center;
    currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    let distanceV = startCursorPosition.clone().sub(currentCursorPosition);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3(0, 1, 0);
    obj.position.copy(posState);

    v1.set(-distanceV.x, 0, 0);
    v2.set(0, -distanceV.y, 0);
    v1.add(v2);
    group.worldToLocal(v1);
    //obj.position.add(v1);
    m1.makeTranslation(v1.x, v1.y, v1.z);
    /*if(pinching) {
        m2.compose(obj.position, obj.quaternion, obj.scale);
        pinching = false;
    }
    else {
        m2.copy(objMatrixState);
    }*/
    m2.copy(objMatrixState);
    m2.premultiply(m1);
    m2.decompose(obj.position, obj.quaternion, obj.scale);
    renderer.render(scene, camera);
};
manager.on('doublepanend', function doublePanEndListener() {
    console.log("doublepanend");
    posState.copy(obj.position);
});

//pinch gesture listener
manager.on('pinchstart', function pinchStartListener(event) {
    console.log("pinchStart");
    //scaleState = new THREE.Vector3().setFromMatrixScale(obj.matrixWorld);   //obj.scale NON FUNZIONA
    objMatrixState.copy(obj.matrix);
    fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]);
});
manager.on('pinchmove', function pinchMoveListener(event) {
    console.log('pinchmove');
    pinching = true;
    const p = getCursorPosition(event.center.x, event.center.y, renderer.domElement); //center point between fingers
    const newDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    const s = newDistance/fingerDistance;

    v1.set(p.x, 0, 0);  //fingers middle point on x axis
    v2.set(0, p.y, 0);  //fingers middle point on y axis
    v1.add(v2);
    group.worldToLocal(v1);

    m1.makeTranslation(v1.x, v1.y, v1.z);   //T(v1)
    m2.makeScale(s, s, s);  //S(s)
    m1.multiply(m2);
    m2.makeTranslation(-v1.x, -v1.y, -v1.z);
    m1.multiply(m2);
    /*if(panning) {
        m2.compose(obj.position, obj.quaternion, obj.scale);
        panning = false;
    }
    else {
        m2.copy(objMatrixState);
    }*/
    //m2.copy(objMatrixState).premultiply(m1);
    m2.copy(objMatrixState).premultiply(m1);
    //m2.decompose(obj.position, obj.quaternion, obj.scale);  //T(-v1)
    obj.matrix.copy(m2);

    renderer.render(scene, camera);
});
manager.on('pinchend', function pinchEndListener() {
    console.log("pinchEnd");
    pinching = false;
    //objMatrixState.copy(obj.matrix);
});

//rotate gesture listener
manager.on('rotatestart', function rotateStartListener(event) {
    console.log("rotateStart");
    fingersMiddle = getCursorPosition(event.center.x, event.center.y, renderer.domElement); 
    if(group.quaternion == "undefined") {
        quatState = new THREE.Quaternion().identity();
    }
    else {
        quatState.copy(group.quaternion);
    }    
    fingerRotation = event.rotation;
    objMatrixState.copy(obj.matrix);
});
manager.on('rotatemove', function rotateMoveListener(event) {
    console.log("rotateMove");
    const rotation = (fingerRotation - event.rotation)*Math.PI/180;
    fingersMiddle = getCursorPosition(event.center.x, event.center.y, renderer.domElement);

    v1.set(fingersMiddle.x, 0, 0);
    v2.set(0, fingersMiddle.y, 0);
    v1.add(v2);
    group.worldToLocal(v1);

    m1.makeTranslation(-v1.x, -v1.y, -v1.z);
    v2.set(0, 0, 1);
    group.worldToLocal(v2);
    m2.makeRotationAxis(v2, rotation);

    m1.premultiply(m2);
    m2.makeTranslation(v1.x, v1.y, v1.z);
    m1.premultiply(m2);
    m2.copy(objMatrixState).premultiply(m1);
    m2.decompose(obj.position, obj.quaternion, obj.scale);
    renderer.render(scene, camera);
});
manager.on('rotateend', function rotateEndListener(event) {
    console.log("rotateend")
    fingerRotation = event.rotation;
});


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

obj = loadObject(renderer.domElement, group); //load the 3D object
makeGizmos(tbCenter, tbRadius, group); //add gizmos
scene.add(group);
resizeRenderer(renderer);
renderer.render(scene, camera);

//listeners
function mouseClickListener(event) {
    event.preventDefault();
    console.log(event.button);
};

function mouseUpListener(event) {
    if(event.button == 1) {
        event.preventDefault();
        console.log("wheelUp");
        //posState.copy(obj.position);
        objMatrixState.copy(obj.matrix);
        tracking = false;
    }
};

function mouseDownListener(event) {
    if(event.button == 1) {
        //wheel click
        event.preventDefault();
        console.log("wheelDown");
        startCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        objMatrixState.copy(obj.matrix);
        tracking = true;
    }
};

function mouseMoveListener(event) {
    if(tracking) {
        console.log("wheelMove");
        event.preventDefault();
        currentCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        let distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        v1.set(-distanceV.x, 0, 0); //translation on world X axis
        v2.set(0, -distanceV.y, 0); //translation on world y axis
        v1.add(v2); //translation vector
        group.worldToLocal(v1);
        m1.makeTranslation(v1.x, v1.y, v1.z);   //translation matrix
        m2.copy(objMatrixState);
        m2.premultiply(m1);
        obj.matrix.copy(m2);
        //m2.decompose(obj.position, obj.quaternion, obj.scale);
        //obj.position.add(v1);
        renderer.render(scene, camera);
    }
};

function wheelListener(event) {
    event.preventDefault();
    const scaleFactor = 1.1;
    const sgn = Math.sign(event.deltaY);    //the direction of rotation

    notchCounter+=sgn; //update the notch counter
    /*if(notchCounter > 0) {
        scale(obj, scaleFactor*notchCounter);
    }
    else if(notchCounter < 0) {
        scale(obj, 1/(scaleFactor*(-notchCounter)));
    }
    else {
        scale(obj, 1);
    }*/
    if(notchCounter > 0) {
        scale(obj, Math.pow(scaleFactor, notchCounter));
    }
    else if(notchCounter < 0) {
        scale(obj, 1/(Math.pow(scaleFactor, -notchCounter)));
    }
    else {
        scale(obj, 1);
    }
    renderer.render(scene, camera);
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
    objMatrixState.copy(cube.matrix);
    cube.matrixAutoUpdate = false;
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
 * Uniformly scale an object by given factor
 * @param {THREE.Object3D} obj The object to be scaled
 * @param {number} s The scale factor
 */
function scale(obj, s) {
    console.log("scaling");
    m1.makeScale(s, s, s);  //scaling matrix
    m2.copy(objMatrixState);
    m2.premultiply(m1);
    obj.matrix.copy(m1);
    //m2.decompose(obj.position, obj.quaternion, obj.scale);
};

/**
 * Move the object to the new point p
 * @param {THREE.Object3D} obj The object
 * @param {THREE.Vector3} p The new center point
 */
function moveTo(obj, p) {
    console.log("moving");
    obj.position.copy(p);
    posState.copy(obj.position);
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





//DA INSERIRE ROTATE, SETTARE IL RICONOSCIMENTO CON ALTRE GESTURE E FARE IN MODO CHE LA MOLTIPLICAZIONE DELLE MATRICI AVVENGA COME DEVE PER ESEGUIRE
//TUTTE LE COMBINAZIONI DELLE GESTURE