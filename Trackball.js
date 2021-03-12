import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvasP");
const rotationAxisParagraph = document.getElementById("rotationAxisParagraph");
const cursor1Paragraph = document.getElementById("cursor1Paragraph");
const cursor2Paragraph = document.getElementById("cursor2Paragraph");
const unprojectionParagraph = document.getElementById("unprojectionParagraph");
const scaleFactor = 1.1;
const pinchScaleFactor = 1.02;
let fingerDistance = 0;
let fingerRotation = 0;
let panKey = false;

//canvas events
canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);
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

let tracking = false;
let currentCursorPosition = new THREE.Vector3();
let startCursorPosition = new THREE.Vector3();
let rotationAxis = new THREE.Vector3();
let obj;    //The 3D model
let quatState = new THREE.Quaternion(); //object's quaternion value at first mouse click/tap
let posState = new THREE.Vector3(); //object's position value

const manager = new Hammer(canvas);

const singlePan = new Hammer.Pan();
const doublePan = new Hammer.Pan();
const pinch = new Hammer.Pinch();
const rotate = new Hammer.Rotate();

singlePan.set({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
doublePan.set({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});    //threshold 7.5
pinch.set({threshold: 0});  //threshold 0.05

manager.add([singlePan, doublePan, pinch, rotate]);
manager.get('doublepan').recognizeWith('singlepan');    //se dal singlepan aggiungo un dito, riconosce il doublepan e continua con quello
manager.get('pinch').recognizeWith('doublepan');
manager.get('pinch').recognizeWith('rotate');

//single finger pan gesture listener
manager.on('singlepanstart', function singlePanStartListener(event) {
    console.log('singlepanstart');
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
    }
});
manager.on('singlepanmove', function singlePanMoveListener(event) {
    console.log('singlepanmove');
    if(panKey) {
        doublePanMoveListener(event);
    }
    else {
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
});
manager.on('singlepanend', function singlePanEndListener() {
    console.log('singlepanend');
});

//double finger pan gesture listener
manager.on('doublepanstart', function doublePanStartListener(event) {
    console.log("doublepanstart");
    const center = event.center;
    startCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
});
manager.on('doublepanmove', doublePanMoveListener);
function doublePanMoveListener(event) {
    console.log("doublePan");
    const center = event.center;
    currentCursorPosition = getCursorPosition(center.x, center.y, renderer.domElement);
    let distanceV = startCursorPosition.clone().sub(currentCursorPosition);
    const xAxis = new THREE.Vector3(1, 0, 0);
    const yAxis = new THREE.Vector3(0, 1, 0);
    obj.position.copy(posState);
    obj.translateOnAxis(group.worldToLocal(xAxis), -distanceV.x);
    obj.translateOnAxis(group.worldToLocal(yAxis), -distanceV.y);
    renderer.render(scene, camera);
}
manager.on('doublepanend', function doublePanEndListener() {
    console.log("doublepanend");
    posState.copy(obj.position);
});

//pinch gesture listener
manager.on('pinchstart', function pinchStartListener(event) {
    console.log("pinchStart");
    fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]); 
});
manager.on('pinchmove', function pinchMoveListener(event) {
    console.log('pinchmove');
    let newDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    console.log(newDistance);
    if(newDistance < fingerDistance) {
        //pinch in
        obj.scale.copy(obj.scale.multiplyScalar(1/pinchScaleFactor));
    }
    else {
        //pinch out
        obj.scale.copy(obj.scale.multiplyScalar(pinchScaleFactor));
    }
    renderer.render(scene, camera);
    fingerDistance = newDistance;
});
manager.on('pinchend', function pinchEndListener() {
    console.log("pinchEnd");
});

//rotate gesture listener
manager.on('rotatestart', function rotateStartListener(event) {
    console.log("rotateStart");
    if(group.quaternion == "undefined") {
        quatState = new THREE.Quaternion().identity();
    }
    else {
        quatState.copy(group.quaternion);
    }    
    fingerRotation = event.rotation;
});
manager.on('rotatemove', function rotateMoveListener(event) {
    console.log("rotateMove");
    const rotation = fingerRotation - event.rotation;
    rotateObj(group, new THREE.Vector3(0, 0, 1), rotation*Math.PI/180);
    renderer.render(scene, camera);
});
manager.on('rotateend', function rotateEndListener(event) {
    fingerRotation = event.rotation;
});


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

obj = loadObject(renderer.domElement, group);    //load the 3D object
posState = obj.position.clone();
makeGizmos(tbCenter, tbRadius, group);  //add gizmos
scene.add(group);
resizeRenderer(renderer);
renderer.render(scene, camera);

//listeners
function mouseUpListener(event) {
    if(event.button == 1) {
        event.preventDefault();
        console.log("wheelUp");
        posState.copy(obj.position);
        tracking = false;
    }
};

function mouseDownListener(event) {
    if(event.button == 1) {
        //wheel click
        event.preventDefault();
        console.log("wheelDown")
        //startCursorPosition = unprojectOnTbPlane(camera, getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        startCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        tracking = true;
    }
};

function mouseMoveListener(event) {
    if(tracking) {
        console.log("wheelMove");
        event.preventDefault();
        //currentCursorPosition = unprojectOnTbPlane(camera, getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        currentCursorPosition = getCursorPosition(event.clientX, event.clientY, renderer.domElement);
        let distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        const xAxis = new THREE.Vector3(1, 0, 0);
        const yAxis = new THREE.Vector3(0, 1, 0);
        obj.position.copy(posState);
        obj.translateOnAxis(group.worldToLocal(xAxis), -distanceV.x);
        obj.translateOnAxis(group.worldToLocal(yAxis), -distanceV.y);
        renderer.render(scene, camera);
    }
};

function wheelListener(event) {
    event.preventDefault();
    const sgn = Math.sign(event.deltaY);
    if(sgn == -1) {
        obj.scale.copy(obj.scale.multiplyScalar(1/scaleFactor));

    }
    else {
        obj.scale.copy(obj.scale.multiplyScalar(scaleFactor));
    }
    renderer.render(scene, camera);
};

function windowResizeListener() {
    resizeRenderer(renderer);
    tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    camera.position.z = tbRadius*4;
    group.clear();
    loadObject(renderer.domElement, group);  //replace with scaleObject()
    makeGizmos(tbCenter, tbRadius, group);
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
 * Given cursor x/y position within the viewport, return corrensponding position in world space
 * @param {number} x Cursor x position in screen space 
 * @param {number} y Cursor y position in screen space
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @returns {THREE.Vector3} Cursor position in world space
 */
function getCursorPosition(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    const cursorPosition = new THREE.Vector2();
    cursorPosition.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
    cursorPosition.setY(((canvasRect.bottom - y) / canvasRect.height) * 2 - 1);
    let worldPosition = unprojection(camera, cursorPosition, tbCenter, tbRadius);
    return worldPosition;
};

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
 * @param {THREE.Camera} camera The camera
 * @param {THREE.Vector2} cursor The cursor x/y position in screen space
 * @param {THREE.Vector3} tbCenter The trackball center
 * @param {number} tbRadius The trackball radius
 * @returns {THREE.Vector3} The unprojected cursor coordinates in the trackball surface
 */
function unprojection(camera, cursor, tbCenter, tbRadius) {
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
    const tbPlanePoint = new THREE.Vector3(cursor.x, cursor.y, 0);
    return tbPlanePoint.unproject(camera);
}