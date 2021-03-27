import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';

import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvasO");
const scaleSlider = document.getElementById("scaleSlider");
const accSlider = document.getElementById("accSlider");
const angularSlider = document.getElementById("angularSlider");
scaleSlider.addEventListener('change', function scaleChangeListener() {
    scaleFactor = scaleSlider.value;
});
accSlider.addEventListener('change', function accChangeListener() {
    acc = accSlider.value*-1;
});
angularSlider.addEventListener('change', function angularChangeListener() {
    vMax = angularSlider.value;
})
const loader = new OBJLoader();
const renderer = new THREE.WebGLRenderer({canvas});
const gizmosR = new THREE.Group();

//defined once and used in some operations
const v2_1 = new THREE.Vector2();
const v3_1 = new THREE.Vector3();
const v3_2 = new THREE.Vector3();
const m4_1 = new THREE.Matrix4();
const m4_2 = new THREE.Matrix4();

//trackball's state
let STATE = {
    IDLE: "IDLE",
    ROTATE: "ROTATE",
    PAN: "PAN",
    SCALE: "SCALE",
    TOUCH_MULTI: "TOUCH_MULTI",
    ANIMATION_DETAIL: "ANIMATION_DETAIL",
    ANIMATION_ROTATE: "ANIMATION_ROTATE"
};
let state = STATE.IDLE;

//transformation matrices
const translateMatrix = new THREE.Matrix4();    //matrix for translation operation
const rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
const scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

const rotationAxis = new THREE.Vector3(); //axis around which perform rotation

//object's state
const objMatrixState = new THREE.Matrix4(); //object's matrix state
let quatState = new THREE.Quaternion().identity(); //rotation gizmos quaternion state

//grid state
const gridPosition = new THREE.Vector3();

//trackball parameters
const tbCenter = new THREE.Vector3(0, 0, 0);
const radiusScaleFactor = 3;
let tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);

//for touch interaction only
let fingerDistance = 0; //distance between two fingers
let fingerRotation = 0; //rotation thah has been done with two fingers

const currentCursorPosition = new THREE.Vector3();
const startCursorPosition = new THREE.Vector3();

//parameters
let scaleFactor = scaleSlider.value;
let acc = accSlider.value*-1; //acceleration
let vMax = angularSlider.value;


let panKey = false; //if pan operation is being performed with keyboard button
let panWheel = false;  //if pan operation is being performed with mouse wheel button
let animateDetail = true;   //if detail operation should be animated
let animateRotation = true; //if rotation operation should implement inertia
let notchCounter = 0;   //represent the wheel resulting position
let obj;    //The 3D model
let grid;   //The grid visualized when panning
let kDown = false;

//detail animation variables
let detailAnimTime = 500; //detail animation duration in seconds
let timeStart = -1; //animation initial time

//rotation animation variables
let t0 = 0; //time before rotation has been released
let t = 0;  //time when rotation has been released
let angle0 = 0; //angle before rotation has been released
let angle = 0;  //angle when rotation has been released
let w0;


//mouse/keyboard events
canvas.addEventListener('mouseup', function mouseUpListener(event) {
    if(event.button == 0) {
        if(state == STATE.ROTATE) {
            console.log('mouse_up');
            updateTbState(STATE.IDLE, false);
        }
    }
    else if(event.button == 1) {
        event.preventDefault();
        if(panWheel) {
            console.log('wheel_up');
            if(state == STATE.PAN) {
                updateTbState(STATE.IDLE, false);
            }
            scene.remove(grid);
            obj.remove(grid);
            //tracking = false;
            panWheel = false;
            renderer.render(scene, camera);
        }
    }
});
canvas.addEventListener('mousemove', function mouseMoveListener(event) {
    if(state == STATE.PAN && panWheel) {
        console.log('wheelmove');
        v2_1.copy(getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        currentCursorPosition.set(v2_1.x, v2_1.y, 0);
        const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        v3_1.set(-distanceV.x, -distanceV.y, 0); //translation vector
        translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)

        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(scaleMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);

        //update grid position
        grid.position.addVectors(gridPosition, v3_1);

        //obj.matrix.copy(m4_1);
        renderer.render(scene, camera);
    }
    else if(state != STATE.PAN && panWheel) {
        //restart panning routine
        console.log('wheelmove_start');
        v2_1.copy(getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        startCursorPosition.set(v2_1.x, v2_1.y, 0);
        updateTbState(STATE.PAN, true);
        enlightGizmosR(false);
        renderer.render(scene, camera);
    }
});
canvas.addEventListener('mousedown', function mouseDownListener(event) {
    event.preventDefault();
    if(event.button == 0) {
        console.log('mouse_down');
    }
    else if(event.button == 1 && !panKey) {
        //panKey == true means that panning is already being performed using keyboard and will be handled by proper listener
        console.log('wheel_down');
        v2_1.copy(getCursorPosition(event.clientX, event.clientY, renderer.domElement));
        startCursorPosition.set(v2_1.x, v2_1.y, 0);
        panWheel = true;
        drawGrid();
        renderer.render(scene, camera);
    }
});
canvas.addEventListener('wheel', function wheelListener(event) {
    event.preventDefault();
    if(state != STATE.SCALE) {
        //start scale operation
        updateTbState(STATE.SCALE, true);
    }
    console.log('wheel_scroll');
    const notchDeltaY = 125;    //distance of one notch on mouse wheel
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
    if(event.key == 'c' && !panWheel && !kDown) {
        console.log('key_down');
        panKey = true;
        kDown = true;
        drawGrid();
        renderer.render(scene, camera);
    }
});

document.addEventListener('keyup', function keyUpListener(event) {
    /*if(event.ctrlKey || event.metaKey) {
        console.log("keyup");
        panKey = false;
    }*/
    if(event.key == 'c' && panKey) {
        //panKey == false means that pan operation has been performed with wheel button when keydown event has been fired
        console.log('key_up');
        panKey = false;
        kDown = false;
        scene.remove(grid);
        renderer.render(scene, camera);
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
const doubleTap = new Hammer.Tap(({event: 'doubletap', taps: 2, threshold: 4, posThreshold: 20}));

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
    //updateMatrixState();
    const center = event.center;
    startCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
    if(panKey) {
        //pan operation has been required using keyboard
        updateTbState(STATE.PAN, true);
    }
    else {
        //normal trackball rotation
        updateTbState(STATE.ROTATE, true);
        enlightGizmosR(true);
        if(gizmosR.quaternion == 'undefined') {
            quatState = new THREE.Quaternion().identity();
        }
        else {
            quatState.copy(gizmosR.quaternion);
        }
        if(animateRotation) {
            t0 = performance.now();
            t0 = t;
            angle0 = 0;
            angle = 0;
        }
    }
});
manager.on('singlepanmove', function singlePanMoveListener(event) {
    const center = event.center;
    if(panKey) {
        //pan operation has been required using keyboard
        if(state == STATE.PAN) {
            //already panning, continue with panning routine
            console.log('singlePanMove_Pan');
            v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
            currentCursorPosition.set(v2_1.x, v2_1.y, 0);
            const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
            v3_1.set(-distanceV.x, -distanceV.y, 0); //translation vector
            translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    
            m4_1.copy(objMatrixState).premultiply(translateMatrix);
            m4_1.premultiply(scaleMatrix);
            m4_1.decompose(obj.position, obj.quaternion, obj.scale);

            grid.position.addVectors(gridPosition, v3_1);   

            //obj.matrix.copy(m4_1);
            renderer.render(scene, camera);
        }
        else {
            //restart panning routine
            console.log('singlePanMove_restartPan');
            updateTbState(STATE.PAN, true);
            v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
            startCursorPosition.set(v2_1.x, v2_1.y, 0);            
            enlightGizmosR(false);
            renderer.render(scene, camera);
        }
    }
    else if(!panWheel){
        //no pan operation required from keyboard
        if(state == STATE.ROTATE) {
          //continue with normal rotation routine
          console.log('singlePanMove_Rotate');
          currentCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
          const distanceV = startCursorPosition.clone();
          distanceV.sub(currentCursorPosition);
          const angleV = startCursorPosition.angleTo(currentCursorPosition);
          rotateObj(calculateRotationAxis(startCursorPosition, currentCursorPosition), Math.max(distanceV.length()/tbRadius, angleV));
          if(animateRotation) {
              t0 = t;
              t = performance.now();
              angle0 = angle;
              angle = Math.max(distanceV.length()/tbRadius, angleV);
          }
          renderer.render(scene, camera);
        }
        else {
            //restart rotation routine
            console.log('singlePanMove_restartRotate');
            updateTbState(STATE.ROTATE, true);
            startCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
            updateMatrixState();
            quatState.copy(gizmosR.quaternion);
            enlightGizmosR(true);
            if(animateRotation) {
                t0 = performance.now();
                t = t0;
                angle0 = 0;
                angle = 0;
            }
            renderer.render(scene, camera);
        }
    }
});
manager.on('singlepanend', function singlePanEndListener(event) {
    console.log('singlepanend');
    if(state == STATE.ROTATE) {
        if(animateRotation) {
            const center = event.center;
            currentCursorPosition.copy(unprojectOnTbSurface(getCursorPosition(center.x, center.y, renderer.domElement), tbRadius));
            //perform rotation animation
            v3_1.copy(calculateRotationAxis(startCursorPosition, currentCursorPosition));
            w0 = Math.min((angle-angle0)/((t-t0)/1000), vMax);
            updateTbState(STATE.ANIMATION_ROTATE, true);
            window.requestAnimationFrame(onRotationAnim);
        }
        else {
            updateTbState(STATE.IDLE, false);
            enlightGizmosR(false);
            renderer.render(scene, camera);
        }
    }
    else if(state == STATE.PAN && panKey) {
        //desktop interaction only
        updateTbState(STATE.IDLE, false);
    }
    //const v = calculateInstantSpeed
});

manager.on('doubletap', function doubleTapListener(event) {
    const center = event.center;
    v2_1.copy(getCursorNDC(center.x, center.y, renderer.domElement));
    const u = unprojectOnObj(v2_1, camera);
    if(u != null && animateDetail) {
        updateTbState(STATE.ANIMATION_DETAIL, true);
        v3_1.copy(u).multiplyScalar(-1);
        window.requestAnimationFrame(onDetailAnim);
    }
    else if(u != null && !animateDetail) {
        updateMatrixState();
        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(scaleMatrix);
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
    updateTbState(STATE.TOUCH_MULTI, true);
    quatState.copy(gizmosR.quaternion);
};

function twoFingersMoveListener(event) {
    if(state == STATE.TOUCH_MULTI) {
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
        if(Math.abs(event.rotation) > 0.05) {
            enlightGizmosR(true);
        }
        else {
            enlightGizmosR(false);
        }
    
        rotateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
        v3_2.set(0, 0, 1);
        m4_1.makeRotationAxis(v3_2, r);  //R(rotation)
        rotateMatrix.multiply(m4_1);
        m4_1.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);    //T(-v3_1)
        rotateMatrix.multiply(m4_1);
    
        //rotate gizmos
        const quat = new THREE.Quaternion();
        quat.setFromAxisAngle(v3_2, r);
        quat.multiply(quatState);
        gizmosR.setRotationFromQuaternion(quat);
    
        //translation operation T(p)
        v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
        currentCursorPosition.set(v2_1.x, v2_1.y, 0);
        const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        v3_1.set(-distanceV.x, -distanceV.y, 0);
        translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    
        //apply matrix  TRS
        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(rotateMatrix);
        m4_1.premultiply(scaleMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);
        //obj.matrix.copy(m4_1);
        renderer.render(scene, camera);
    }
    else {
        //restart multitouch interaction
        console.log('2FE move_restart');
        const center = event.center;    //middle point between fingers
        v2_1.copy(getCursorPosition(center.x, center.y, renderer.domElement));
        startCursorPosition.set(v2_1.x, v2_1.y, 0);
        fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]);
        fingerRotation = event.rotation;
        updateTbState(STATE.TOUCH_MULTI, true);
        quatState.copy(gizmosR.quaternion);
    }
};

function twoFingersEndListener(event) {
    console.log('2FE end');
    enlightGizmosR(false);
    renderer.render(scene, camera);
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

/**
 * Set the rotation gizmos illumination
 * @param {Boolean} isActive If true, enlight gizmos, turn off otherwise
 */
function enlightGizmosR(isActive) {
    const gX = gizmosR.children[0];
    const gY = gizmosR.children[1];
    const gZ = gizmosR.children[2];
    if(isActive) {
        gX.material.setValues({color: 0x00FF00});
        gY.material.setValues({color: 0xFF0000});
        gZ.material.setValues({color: 0x0000FF});
    }
    else {
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
 * Calculate the angular speed
 * @param {*} p0 Position at t0 
 * @param {*} p1 Position at t1
 * @param {*} t0 Initial time
 * @param {*} t1 Ending time
 */
function calculateAngularSpeed(p0, p1, t0, t1) {
    const s = p1-p0;
    const t = t1-t0;
    return s/t;
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

/**
 * Compute the easing out cubic function for ease out effect in animation
 * @param {Number} t The absolute progress of the animation in the bound of 0 (beginning of the) and 1 (ending of animation)
 * @returns Result of easing out cubic at time t
 */
function easeOutCubic(t) {
    //return 1-Math.pow(1-t, 3);
    return Math.sqrt(1 - Math.pow(t - 1, 2));
}


//meglio addGrid?
function drawGrid() {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const size = Math.max(canvasRect.width, canvasRect.height)*3;
    const divisions = size/50;
    grid = new THREE.GridHelper(size, divisions);
    gridPosition.copy(grid.position);
    grid.rotateX(Math.PI/2);
    scene.add(grid);
};

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
    const curveMaterialX = new THREE.LineBasicMaterial({color: 0x008000});
    const curveMaterialY = new THREE.LineBasicMaterial({color: 0x800000});
    const curveMaterialZ = new THREE.LineBasicMaterial({color: 0x000080});

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
};

/**
 * load a 3D object and add it to the scene
 * for testing purpose, builds a cube and add to scene
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 */
function loadObject(canvas, loader) {
    const canvasRect = canvas.getBoundingClientRect();
    loader.load('rocker_arm.obj', function(o) {
        obj = o;
        scene.add(o);
        objMatrixState.copy(o.matrix);
    });
};

/**
 * Perform animation for detail operation
 * @param {Number} time Instant when this function is called as performance.now()
 */
function onDetailAnim(time) {
    if(timeStart == -1) {
        //animation start
        timeStart = time;
    }
    if(state == STATE.ANIMATION_DETAIL) {
        const deltaTime = time - timeStart;
        const animTime = deltaTime/detailAnimTime;
        m4_1.copy(translateMatrix);
        m4_2.copy(scaleMatrix);
        if(animTime >= 1) {
            //animation end
            translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);
            scaleMatrix.makeScale(scaleFactor, scaleFactor, scaleFactor);
            m4_1.copy(objMatrixState).premultiply(translateMatrix);
            m4_1.premultiply(scaleMatrix);
            m4_1.decompose(obj.position, obj.quaternion, obj.scale);
            timeStart = -1;
            updateTbState(STATE.IDLE, false);
            window.cancelAnimationFrame(onDetailAnim);
            renderer.render(scene, camera); 
        }
        else {
            const amount = easeOutCubic(animTime);
            const s = ((1-amount)+(scaleFactor*amount));
            v3_2.copy(v3_1).multiplyScalar(amount);
            translateMatrix.makeTranslation(v3_2.x, v3_2.y, v3_2.z);
            scaleMatrix.makeScale(s, s, s);
            m4_1.copy(objMatrixState).premultiply(translateMatrix);
            m4_1.premultiply(scaleMatrix);
            m4_1.decompose(obj.position, obj.quaternion, obj.scale);
            renderer.render(scene, camera);
            window.requestAnimationFrame(onDetailAnim);
        }
    }
    else {
        //interrupt animation
        timeStart = -1;
        window.cancelAnimationFrame(onDetailAnim);
    }
};

/**
 * Perform animation for rotation operation
 */
function onRotationAnim(time) {
    if(timeStart == -1) {
        //animation start
        angle0 = 0
        angle = 0;
        timeStart = time;
    }
    if(state == STATE.ANIMATION_ROTATE) {
        const deltaTime = (time - timeStart)/1000;
        angle0 = angle;
        angle = 0.5*acc*Math.pow(deltaTime, 2)+w0*deltaTime+0;
        if(angle >= angle0) {
            rotateObj(v3_1, angle);
            renderer.render(scene, camera);
            window.requestAnimationFrame(onRotationAnim);
        }
        else {
            timeStart = -1;
            updateMatrixState(STATE.ANIMATION_ROTATE, false);
            window.cancelAnimationFrame(onRotationAnim);
        }

    }
    else {
        //interrupt animation
        timeStart = -1;
        window.cancelAnimationFrame(onRotationAnim);
    }
};

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
    let quat = new THREE.Quaternion();
    quat.setFromAxisAngle(axis, rad);
    rotateMatrix.makeRotationFromQuaternion(quat);
    quat.multiply(quatState);
    gizmosR.setRotationFromQuaternion(quat);    //rotate gizmos
    m4_1.copy(objMatrixState).premultiply(rotateMatrix);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
};

function unprojectOnObj(cursor, camera) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(cursor, camera);
    const intersect = raycaster.intersectObject(obj, true);
    if(intersect.length == 0) {
        return  null;
    }
    else {
        return v3_1.copy(intersect[0].point);
    }
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

/**
 * Update the trackball FSA
 * @param {STATE} newState New state of the FSA
 * @param {Boolean} propagate If true, update matrices and counters
 */
function updateTbState(newState, propagate) {
    state = newState;
    if(propagate) {
        updateMatrixState();
    }
};

function applyTransform(translation, rotation, scale) {
    m4_1.copy(objMatrixState).premultiply(translation);
    m4_1.premultiply(rotation);
    m4_1.premultiply(scale);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
};


//problema con la distanza tra start e current, usare solo coordinate schermo invece che unproject sulla trackball?
