import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';
import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import * as HAMMERJS from 'hammerjs';

const canvas = document.getElementById("canvas");
const cameraBtn = document.getElementById("cameraButton");
const animCheck = document.getElementById("animationCheckbox");
const gridCheck = document.getElementById("gridCheckbox");
const scaleSlider = document.getElementById("scaleSlider");
const accSlider = document.getElementById("accSlider");
const angularSlider = document.getElementById("angularSlider");
cameraBtn.innerHTML= "Toggle Orthographic";
cameraBtn.addEventListener('click', function btnListener() {
    if(camera.type == 'PerspectiveCamera') {
        camera = makeOrthographicCamera(renderer.domElement);
        cameraBtn.innerHTML = 'Toggle Perspective';
        renderer.render(scene, camera);
    }
    else if(camera.type == 'OrthographicCamera') {
        camera = makePerspectiveCamera(renderer.domElement);
        cameraBtn.innerHTML = 'Toggle Orthographic';
        renderer.render(scene, camera);
    }
})
scaleSlider.addEventListener('change', function scaleChangeListener() {
    scaleFactor = scaleSlider.value;
});
accSlider.addEventListener('change', function accChangeListener() {
    acc = accSlider.value*-1;
});
angularSlider.addEventListener('change', function angularChangeListener() {
    vMax = angularSlider.value;
});
animCheck.addEventListener('change', function animCheckListener() {
    animateDetail = animCheck.checked;
    animateRotation = animCheck.checked;
});
gridCheck.addEventListener('change', function gridCheckListener() {
    showGrid = gridCheck.checked;
});

const loader = new OBJLoader();
const renderer = new THREE.WebGLRenderer({canvas});
const gizmosR = new THREE.Group();

//defined once and used in some operations
const v2_1 = new THREE.Vector2();
const v3_1 = new THREE.Vector3();
const v3_2 = new THREE.Vector3();
const m4_1 = new THREE.Matrix4();
const m4_2 = new THREE.Matrix4();

//transformation matrices state
const translateMatrix = new THREE.Matrix4();    //matrix for translation operation
const rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
const scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

const rotationAxis = new THREE.Vector3();

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

//object's state
const objMatrixState = new THREE.Matrix4(); //object's matrix state
let quatState = new THREE.Quaternion(); //object's quaternion value at first mouse click/tap

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
let animateDetail = animCheck.checked;   //if detail operation should be animated
let animateRotation = animCheck.checked; //if rotation operation should implement inertia
let showGrid = gridCheck.checked;   //if grid should be showed during pan operation
let cursorZoom = false;

let panKey = false; //if key for pan is down
let panWheel = false;  //if pan operation is being performed with mouse wheel button
let notchCounter = 0;   //represent the wheel resulting position
let camera; //Virtual camera
let obj = new THREE.Object3D();    //The 3D model
let grid;   //Grid to be visualized during pan operation
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

//scene
const scene = new THREE.Scene();

//camera
camera = makePerspectiveCamera(renderer.domElement);
scene.add(camera);

//light
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

//obj = loadObject(renderer.domElement, group);    //load the 3D object
loadObject(renderer.domElement, loader);
makeGizmos(tbCenter, tbRadius);  //add gizmos
scene.add(gizmosR);
resizeRenderer(renderer);
renderer.render(scene, camera);

//mouse/keyboard events
canvas.addEventListener('mousedown', function mouseDownListener(event) {
    event.preventDefault();
    if(event.button == 0) {
        console.log('mouse_down');
    }
    else if(event.button == 1 && !panKey) {
        //panKey == true means that panning is already being performed using keyboard and will be handled by proper listener
        console.log('wheel_down');
        //startCursorPosition.copy(unprojectOnTbPlane(camera, event.clientX, event.clientY, renderer.domElement));
        panWheel = true;
        if(showGrid) {
            drawGrid();
        }
        renderer.render(scene, camera);
    }
});
canvas.addEventListener('mousemove', function mouseMoveListener(event) {
    if(state == STATE.PAN && panWheel) {
        console.log('wheelmove');
        currentCursorPosition.copy(unprojectOnTbPlane(camera, event.clientX, event.clientY, renderer.domElement));
        const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
        v3_1.set(-distanceV.x, -distanceV.y, 0);
        translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)

        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(scaleMatrix);
        //obj.matrix.copy(m4_1);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);

        //update grid position
        if(showGrid) {
            grid.position.addVectors(gridPosition, v3_1);
        }

        //obj.matrix.copy(m4_1);
        renderer.render(scene, camera);
    }
    else if(state != STATE.PAN && panWheel) {
        //restart panning routine
        console.log('wheelmove_start');
        startCursorPosition.copy(unprojectOnTbPlane(camera, event.clientX, event.clientY, renderer.domElement));
        updateTbState(STATE.PAN, true);
        enlightGizmosR(false);
        renderer.render(scene, camera);
    }
});
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
            panWheel = false;
            renderer.render(scene, camera);
        }
    }
});
canvas.addEventListener('wheel', function wheelListener(event) {
    event.preventDefault();
    if(state != STATE.SCALE) {
        //start scale operation
        updateTbState(STATE.SCALE, true);    
        console.log('wheel_scroll_start');
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
    if(cursorZoom == true) {
        //updateMatrixState();
        const p = unprojectOnTbPlane(camera, event.clientX, event.clientY, renderer.domElement);
        v3_1.set(p.x, p.y, 0);
        translateMatrix.makeTranslation(p.x, p.y, p.z);
        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(scaleMatrix);
        translateMatrix.makeTranslation(-p.x, -p.y, -p.z);
        m4_1.premultiply(translateMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);
        renderer.render(scene, camera);
    }
    else {
        m4_1.copy(objMatrixState).premultiply(translateMatrix);
        m4_1.premultiply(rotateMatrix);
        m4_1.premultiply(scaleMatrix);
        m4_1.decompose(obj.position, obj.quaternion, obj.scale);
        //obj.matrix.copy(m4_1);       
        renderer.render(scene, camera);
    }

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
        if(showGrid) {
            drawGrid();
        }
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
window.addEventListener('resize', function windowResizeListener(){
    resizeRenderer(renderer);
    //tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    camera.position.z = tbRadius*4;
    //gizmosR.clear();
    //loadObject(renderer.domElement, loader);  //replace with scaleObject()
    //makeGizmos(tbCenter, tbRadius);
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
    const center = event.center;
    if(panKey) {
        //pan operation has been required using keyboard
        startCursorPosition.copy(unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement)); 
        updateTbState(STATE.PAN, true);
    }
    else {
        //normal trackball rotation
        startCursorPosition.copy(unprojectOnTbSurface(camera, center.x, center.y, renderer.domElement, tbRadius)); 
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
            t = t0;
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
            currentCursorPosition.copy(unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement));
            const distanceV = startCursorPosition.clone().sub(currentCursorPosition);
            v3_1.set(-distanceV.x, -distanceV.y, 0);
            translateMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
    
            m4_1.copy(objMatrixState).premultiply(translateMatrix);
            m4_1.premultiply(scaleMatrix);
            m4_1.decompose(obj.position, obj.quaternion, obj.scale);

            //move grid
            if(showGrid) {
                grid.position.addVectors(gridPosition, v3_1);   
            }

            //obj.matrix.copy(m4_1);
            renderer.render(scene, camera);
        }
        else {
            //restart panning routine
            console.log('singlePanMove_restartPan');
            updateTbState(STATE.PAN, true);
            startCursorPosition.copy(unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement)); 
            enlightGizmosR(false);
            renderer.render(scene, camera);
        }
    }
    else if(!panWheel) {
        //no pan operation required from keyboard
        if(state == STATE.ROTATE) {
            //continue with normal rotation routine
            console.log('singlePanMove_Rotate');
            currentCursorPosition.copy(unprojectOnTbSurface(camera, center.x, center.y, renderer.domElement, tbRadius)); 
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
            startCursorPosition.copy(unprojectOnTbSurface(camera, center.x, center.y, renderer.domElement, tbRadius)); 
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
            currentCursorPosition.copy(unprojectOnTbSurface(camera, center.x, center.y, renderer.domElement, tbRadius));
            //perform rotation animation
            v3_1.copy(calculateRotationAxis(startCursorPosition, currentCursorPosition));
            w0 = Math.min(calculateAngularSpeed(angle0, angle, t0, t), vMax);
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
});

manager.on('doubletap', function doubleTapListener(event) {
    console.log('double_tap');
    const center = event.center;
    const hitP = unprojectOnObj(getCursorNDC(center.x, center.y, renderer.domElement), camera);
    if(hitP != null && animateDetail) {
        updateTbState(STATE.ANIMATION_DETAIL, true);
        v3_1.copy(hitP).multiplyScalar(-1);
        window.requestAnimationFrame(onDetailAnim);
    }
    else if(hitP != null && !animateDetail) {
        updateMatrixState();
        translateMatrix.makeTranslation(-hitP.x, -hitP.y, -hitP.x);
        scaleMatrix.makeScale(scaleFactor, scaleFactor, scaleFactor);
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
    startCursorPosition.copy(unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement));
    fingerDistance = calculateDistance(event.pointers[0], event.pointers[1]);
    fingerRotation = event.rotation;
    updateTbState(STATE.TOUCH_MULTI, true);
    quatState.copy(gizmosR.quaternion);
};

function twoFingersMoveListener(event) {
    if(state == STATE.TOUCH_MULTI) {
        console.log('2FE move');
        const center = event.center;    //middle point between fingers
        const p = unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement);
        const newDistance = calculateDistance(event.pointers[0], event.pointers[1]);
        const s = newDistance/fingerDistance;   //how much to scale
    
        //scaling operation X = T(p)S(s)T(-p)
        v3_1.set(p.x, p.y, 0);  //fingers middle point
    
        scaleMatrix.makeTranslation(v3_1.x, v3_1.y, v3_1.z);   //T(v3_1)
        m4_1.makeScale(s, s, s);  //S(s)
        scaleMatrix.multiply(m4_1);
        m4_1.makeTranslation(-v3_1.x, -v3_1.y, -v3_1.z);    //T(-v3_1)
        scaleMatrix.multiply(m4_1);
    
        //rotation operation    X = T(p)R(r)T(-p)
        const r = (fingerRotation - event.rotation)*Math.PI/180; //angle in radians  
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
        currentCursorPosition.copy(unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement));
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
        startCursorPosition.copy(unprojectOnTbPlane(camera, center.x, center.y, renderer.domElement));
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


/**
 * Calculate the angular speed
 * @param {Number} p0 Position at t0 
 * @param {Number} p1 Position at t1
 * @param {Number} t0 Initial time in milliseconds
 * @param {Number} t1 Ending time in milliseconds
 */
 function calculateAngularSpeed(p0, p1, t0, t1) {
    const s = p1-p0;
    const t = (t1-t0)/1000;
    return s/t;
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
 * Draw a grid on the canvas
 */
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
 * Compute the easing out cubic function for ease out effect in animation
 * @param {Number} t The absolute progress of the animation in the bound of 0 (beginning of the) and 1 (ending of animation)
 * @returns Result of easing out cubic at time t
 */
 function easeOutCubic(t) {
    //return 1-Math.pow(1-t, 3);
    return Math.sqrt(1 - Math.pow(t - 1, 2));
}

/**
 * Creates the rotation gizmos with radius equals to the given trackball radius
 * @param {THREE.Vector3} tbCenter The trackball's center
 * @param {number} tbRadius The trackball radius
 */
function makeGizmos(tbCenter, tbRadius) {
    //rotation gizmos

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
 * Set the rotation gizmos illumination
 * @param {Boolean} isActive If true, enlight gizmos, otherwise turn them off
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
 * Calculate the cursor position in NDC
 * @param {number} x Cursor horizontal coordinate within the canvas 
 * @param {number} y Cursor vertical coordinate within the canvas
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @returns {THREE.Vector2} Cursor normalized position inside the canvas
 */
function getCursorNDC(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    v2_1.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
    v2_1.setY(((canvasRect.bottom - y) / canvasRect.height) * 2 - 1);
    return v2_1;
};

/**
 * Calculate the cursor position inside the canvas x/y coordinates with the origin being in the center of the canvas
 * @param {Number} x Cursor horizontal coordinate within the canvas 
 * @param {Number} y Cursor vertical coordinate within the canvas
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @returns {THREE.Vector2} Cursor normalized position inside the canvas
 */
function getCursorOnCanvas(x, y, canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    v2_1.setX((x-canvasRect.left)-canvasRect.width/2);
    v2_1.setY((canvasRect.bottom-y)-canvasRect.height/2);
    return v2_1;
}

/**
 * load a 3D object and add it to the scene
 * for testing purpose, builds a cube and add to scene
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 */
function loadObject(canvas, loader) {
    loader.load('rocker_arm.obj', onLoad);
};

function onLoad(o) {
    let bbox = new THREE.Box3().setFromObject(o);
    obj = o;
    bbox.getSize(v3_1);
    bbox.getCenter(v3_2);
    let maxSize = Math.max(v3_1.x, v3_1.y, v3_1.z);
    let s = (tbRadius/maxSize)*2;
    translateMatrix.makeTranslation(-v3_2.x, -v3_2.y, -v3_2.z);
    scaleMatrix.makeScale(s, s, s);
    m4_1.copy(obj.matrix).premultiply(translateMatrix);
    m4_1.premultiply(scaleMatrix);
    m4_1.decompose(obj.position, obj.quaternion, obj.scale);
    obj.matrix.copy(m4_1);
    scene.add(obj);
    updateMatrixState();
    renderer.render(scene, camera);
}

function makeOrthographicCamera(canvas) {
    const canvasRect = canvas.getBoundingClientRect();
    const halfW = canvasRect.width/2;
    const halfH = canvasRect.height/2;
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
    camera.position.z = 500;
    return camera
};

function makePerspectiveCamera(canvas) {
    const fov = 45;
    const aspect = canvas.clientWidth/canvas.clientHeight;
    const zPosition = tbRadius*3.5;
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.z = zPosition;
    return camera;
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
            enlightGizmosR(false);
            window.cancelAnimationFrame(onRotationAnim);
            renderer.render(scene, camera);
        }

    }
    else {
        //interrupt animation
        timeStart = -1;
        if(state != STATE.ROTATE) {
            enlightGizmosR(false);
        }
        window.cancelAnimationFrame(onRotationAnim);
        renderer.render(scene, camera);
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

/**
 * Unproject the cursor on the object surface
 * @param {THREE.Vector2} cursor Cursor coordinates in NDC
 * @param {THREE.Camera} camera Virtual camera
 * @returns The intersection point between the ray and the object, if exist, null otherwise
 */
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
 * @param {THREE.Camera} camera The virtual camera
 * @param {Number} x Cursor horizontal coordinate in screen
 * @param {Number} y Cursor vertical coordinate in screen
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @param {number} tbRadius The trackball radius
 * @returns {THREE.Vector3} The unprojected cursor coordinates in the trackball surface
 */
function unprojectOnTbSurface(camera, x, y, canvas, tbRadius) {
    if(camera.type == 'OrthographicCamera') {
        v2_1.copy(getCursorOnCanvas(x, y, canvas));
        v3_1.setX(v2_1.x);
        v3_1.setY(v2_1.y);
        let x2 = Math.pow(v2_1.x, 2);
        let y2 = Math.pow(v2_1.y, 2);
        let r2 = Math.pow(tbRadius, 2);

        if(x2+y2 <= r2/2) {
            //intersection with sphere
            v3_1.setZ(Math.sqrt(r2-(x2+y2)));
        }
        else {
            //intersection with hyperboloid
            v3_1.setZ((r2/2)/(Math.sqrt(x2+y2)));
        }
        return v3_1;
    }
    else if(camera.type == 'PerspectiveCamera') {
        v2_1.copy(getCursorNDC(x, y, canvas));
        const nearPlanePoint = new THREE.Vector3(v2_1.x, v2_1.y, -1);
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
    }
};


/**
 * Unproject the cursor on the plane passing through the center of the trackball orthogonal to the camera
 * @param {THREE.Camera} camera The camera
 * @param {Number} x Cursor horizontal coordinate in screen
 * @param {Number} y Cursor vertical coordinate in screen
 * @param {HTMLElement} canvas The canvas where the renderer draws its output
 * @returns {THREE.Vector3} The unprojected point
 */
function unprojectOnTbPlane(camera, x, y, canvas) {
    if(camera.type == 'OrthographicCamera') {
        v2_1.copy(getCursorOnCanvas(x, y, canvas));
        v3_1.set(v2_1.x, v2_1.y, 0);
        return v3_1;
    }
    else if(camera.type == 'PerspectiveCamera') {
        v2_1.copy(getCursorNDC(x, y, canvas));

        //unproject cursor on the near plane
        v3_1.set(v2_1.x, v2_1.y, -1);
        v3_1.unproject(camera);
        const r0 = camera.position.clone(); //vector origin
        const rDir = new THREE.Vector3().subVectors(v3_1, r0).normalize() ;    //direction vector
    
        const h = v3_1.z - camera.position.z;
        const l = Math.sqrt(Math.pow(v3_1.x, 2)+Math.pow(v3_1.y, 2));
    
        const m = h/l;
        const q = camera.position.z;
        const X = -q/m;
    
        const d = Math.sqrt(Math.pow(q, 2) + Math.pow(X, 2));
        return r0.add(rDir.multiplyScalar(d));
    }
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