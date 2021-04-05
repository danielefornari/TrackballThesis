import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';
import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from 'three';
//import {Arcball} from './Arcball_object';
//import * as HAMMERJS from 'hammerjs';





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

/**
 * 
 * @param {THREE.Camera} camera Virtual camera used in the scene
 * @param {HTMLElement} domElement Renderer's dom element
 * @param {THREE.Object3D} object 3D object to be manipulated
 */
class Arcball extends THREE.EventDispatcher{
    constructor(camera, object, domElement) {
        super();
        this.camera = camera;
        this.obj = object;
        this.canvas = domElement;

        this._scene = camera.parent;

        //global vectors and matrices that can be used in some operations to avoid creating new object at every call (e.g. every time cursor moves)
        //these operations must not overlap
        this._v2_1 = new THREE.Vector2();
        this._v3_1 = new THREE.Vector3();
        this._v3_2 = new THREE.Vector3();
        this._v3_3 = new THREE.Vector3();
        this._m4_1 = new THREE.Matrix4();
        this._m4_2 = new THREE.Matrix4();

        //transformation matrices
        this._translateMatrix = new THREE.Matrix4();    //matrix for translation operation
        this._rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
        this._scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

        this._rotationAxis = new THREE.Vector3();   //axis for rotate operation

        //object's state
        this._objMatrixState = new THREE.Matrix4(); //object's matrix state
        this._quatState = new THREE.Quaternion(); //object's quaternion value at first mouse click/tap

        //double fingers touch interaction only
        this._fingerDistance = 0; //distance between two fingers
        this._fingerRotation = 0; //amount of rotation performed with two fingers

        //cursor positions
        this._currentCursorPosition = new THREE.Vector3();
        this._startCursorPosition = new THREE.Vector3();

        //grid state
        this._gridPosition = new THREE.Vector3();

        this._mouseDown = false; //if mouse left button is down
        this._wheelDown = false;  //if mouse wheel button is down
        this._notchCounter = 0;   //represent the wheel resulting position
        this._grid;   //Grid to be visualized during pan operation
        this._gizmos = new THREE.Group();


        this._changeEvent = {type: 'change'};


        //detail animation variables
        this.detailAnimTime = 500; //detail animation duration in seconds
        this._timeStart = -1; //animation initial time

        //rotation animation variables
        this._t0 = 0; //time before rotation has been released
        this._t = 0;  //time when rotation has been released
        this._angle0 = 0; //angle before rotation has been released
        this._angle = 0;  //angle when rotation has been released
        this._w0;

        //parameters
        this.scaleFactor =1.25;
        this.acc = 25*-1; //acceleration
        this.vMax = 20;
        this.enableAnimations = true;    //if animations should be performed
        this.enableGrid = true;   //if grid should be showed during pan operation
        this.cursorZoom = false;

        //trackball parameters
        this._tbCenter = new THREE.Vector3(0, 0, 0);
        this._radiusScaleFactor = 3;
        this._tbRadius = this.calculateRadius(this._radiusScaleFactor, renderer.domElement);

        this._state = STATE.IDLE;
        this._prevState = this._state;


        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('wheel', this.onWheel);
        window.addEventListener('resize', this.onCanvasResize);


        //touch gestures
        this._manager = new Hammer.Manager(canvas);

        this._singlePan = new Hammer.Pan({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
        this._doublePan = new Hammer.Pan({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});
        this._pinch = new Hammer.Pinch();
        this._rotate = new Hammer.Rotate();
        this._doubleTap = new Hammer.Tap(({event: 'doubletap', taps: 2, threshold: 4, posThreshold: 20}));

        this._manager.add([this._singlePan, this._doublePan, this._pinch, this._rotate, this._doubleTap]);
        this._manager.get('doublepan').recognizeWith('singlepan');
        this._manager.get('pinch').recognizeWith('singlepan');
        this._manager.get('rotate').recognizeWith('singlepan');

        this._manager.get('doublepan').requireFailure('pinch');
        this._manager.get('doublepan').requireFailure('rotate');

        this._manager.get('pinch').requireFailure('doublepan');
        this._manager.get('pinch').requireFailure('rotate');

        this._manager.get('rotate').requireFailure('doublepan');
        this._manager.get('rotate').requireFailure('pinch');

        this._manager.on('doubletap', this.onDoubleTap);
        this._manager.on('singlepanstart', this.onSinglePanStart);
        this._manager.on('doublepanstart pinchstart rotatestart', this.onDoublePanStart)

        this.makeGizmos(this._tbCenter, this._tbRadius);
        this.camera.parent.add(this._gizmos);

        this.resizeObject();
    };

    onCanvasResize = () => {
        this._tbRadius = this.calculateRadius(this._radiusScaleFactor, canvas);
    };

    //listener for mouse left and wheel button
    onMouseDown = (event) => {
        if(event.button == 0) {
            console.log('mouse_down');
            this._mouseDown = true;
            if(this._state != STATE.ROTATE && this._state != STATE.PAN) {
                document.addEventListener('mousemove', this.onMouseMove);
                document.addEventListener('mouseup', this.onMouseUp);
            }
            if(event.ctrlKey || event.metaKey) {
                //pan operation
                if(this._state != STATE.PAN) {
                    //not already panning with wheel button
                    this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                    this.updateTbState(STATE.PAN, true);
                    if(this.enableGrid) {
                        this.drawGrid();
                        this.dispatchEvent(this._changeEvent);
                    }
                }
            }
            else {
                //rotate operation
                if(this._state == STATE.PAN && this.enableGrid) {
                    scene.remove(this.grid);
                }
                this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, event.clientX, event.clientY, this.canvas, this._tbRadius));
                this.updateTbState(STATE.ROTATE, true);
                this.enlightGizmosR(true);
                this.dispatchEvent(this._changeEvent);
            }
        }
        else if(event.button == 1) {
            event.preventDefault();
            console.log('wheel_down');
            this._wheelDown = true;
            if(this._state != STATE.ROTATE && this._state != STATE.PAN) {
                document.addEventListener('mousemove', this.onMouseMove);
                document.addEventListener('mouseup', this.onMouseUp);
            }
            //pan operation
            if(this._state != STATE.PAN) {
                //not already panning with mouse+keyboard
                if(this._state == STATE.IDLE) {
                    document.addEventListener('mousemove', this.onMouseMove);
                }
                else if(this._state == STATE.ROTATE) {
                    this.enlightGizmosR(false);
                }
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                this.updateTbState(STATE.PAN, true);
                if(this.enableGrid) {
                    this.drawGrid();
                    this.dispatchEvent(this._changeEvent);
                }
            }
        }
    };

    onMouseMove = (event) => {
        console.log('mouse_move');
        if(this._state == STATE.ROTATE) {
            if(event.ctrlKey || event.metaKey) {
                //switch to pan operation
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                this.updateTbState(STATE.PAN, true);
                if(this.enableGrid) {
                    this.drawGrid();
                }
                this.enlightGizmosR(false);
            }
            else {
                //continue with rotation routine
                this._currentCursorPosition.copy(this.unprojectOnTbSurface(this.camera, event.clientX, event.clientY, this.canvas, this._tbRadius));
                const distance = this._startCursorPosition.distanceTo(this._currentCursorPosition);
                const angle = this._startCursorPosition.angleTo(this._currentCursorPosition);
                const amount = Math.max(distance/this._tbRadius, angle);  //effective rotation angle
                this.rotateObj(this.calculateRotationAxis(this._startCursorPosition, this._currentCursorPosition), amount);
                if(this.enableAnimations) {
                    this._t0 = this._t;
                    this._t = performance.now();
                    this._angle0 = this._angle;
                    this._angle = amount;
                }
            }
            this.dispatchEvent(this._changeEvent);
        }
        else if(this._state == STATE.PAN) {
            if(!this._wheelDown && !(event.ctrlKey || event.metaKey)) {
                //switch to rotate operation
                this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, event.clientX, event.clientY, this.canvas, this._tbRadius));
                this.updateTbState(STATE.ROTATE, true);
                if(this.enableGrid) {
                    scene.remove(this.grid);
                }
                this.enlightGizmosR(true);
            }
            else {
                //continue with panning routine
                this._currentCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                this.pan(this._startCursorPosition, this._currentCursorPosition);
            }
            this.dispatchEvent(this._changeEvent);
        }
        else if(this._state == STATE.IDLE) {
            //operation interrupted while moving mouse
            //update state and resume last operation
            this._state = this._prevState;
            if(this._state == STATE.PAN) {
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                this.updateTbState(STATE.PAN, true);
            }
            else if(this._state == STATE.ROTATE) {
                this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, event.clientX, event.clientY, this.canvas, this._tbRadius));
                this.updateTbState(STATE.ROTATE, true);
            }
        }
    };

    onMouseUp = (event) => {
        if(event.button == 0) {
            console.log('mouse_up');
            this._mouseDown = false;
            if(this._wheelDown) {
                if(this._state != STATE.PAN) {
                    //not already panning with mouse+keyboard
                    //switch to pan operation
                    this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                    this.updateTbState(STATE.PAN, true);
                    if(this.enableGrid) {
                        this.drawGrid();
                    }
                    this.enlightGizmosR(false);
                    this.dispatchEvent(this._changeEvent);
                }
            }
            else {
                document.removeEventListener('mousemove', this.onMouseMove);
                //document.removeEventListener('mouseup', this.onMouseUp);
                if(this._state == STATE.ROTATE) {
                    if(this.enableAnimations) {
                        //perform rotation animation
                        this._rotationAxis.copy(this.calculateRotationAxis(this._startCursorPosition, this._currentCursorPosition));
                        this._w0 = Math.min(this.calculateAngularSpeed(this._angle0, this._angle, this._t0, this._t), this.vMax);
                        //this.updateTbState(STATE.ANIMATION_ROTATE, true);
                        window.requestAnimationFrame(this.onRotationAnim);
                    }
                    else {
                        this.updateTbState(STATE.IDLE, false);
                        this.enlightGizmosR(false);
                        this.dispatchEvent(this._changeEvent);
                    }
                }
                else if(this._state == STATE.PAN || this._prevState == STATE.PAN) {
                    this.updateTbState(STATE.IDLE, false);
                    if(this.enableGrid) {
                        scene.remove(this.grid);
                        this.dispatchEvent(this._changeEvent);
                    }
                }
                else {
                    this.enlightGizmosR(false);
                    this.dispatchEvent(this._changeEvent);
                }
            }
        }
        else if(event.button == 1) {
            console.log('wheel_up');
            this._wheelDown = false;
            if(this._mouseDown) {
                if(!event.ctrlKey && !event.metaKey) {
                    //switch to rotate operation
                    this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, event.clientX, event.clientY, this.canvas, this._tbRadius));
                    this.updateTbState(STATE.ROTATE, true);
                    if(this.enableGrid) {
                        scene.remove(this.grid);
                    }
                    this.enlightGizmosR(true);
                    this.dispatchEvent(this._changeEvent);
                }
            }
            else {
                this.updateTbState(STATE.IDLE, false);
                document.removeEventListener('mousemove', this.onMouseMove);
                //document.removeEventListener('mouseup', this.onMouseUp);
                if(this.enableGrid) {
                    scene.remove(this.grid);
                    this.dispatchEvent(this._changeEvent);
                }
            }
        }
    };

    onWheel = (event) => {
        event.preventDefault();
        if(this._state != STATE.IDLE) {
            this._prevState = this._state;
        }
        //this._prevState = this._state;

        this.updateTbState(STATE.SCALE, true);
        console.log('wheel_scroll');
        const notchDeltaY = 125;    //distance of one notch of mouse wheel
        const sgn = event.deltaY/notchDeltaY;
        let s = 1;
        this._notchCounter += sgn;
        if(this._notchCounter > 0) {
            s = Math.pow(this.scaleFactor, this._notchCounter);
        }
        else if(this._notchCounter < 0) {
            s = 1/(Math.pow(this.scaleFactor, -this._notchCounter));
        }
        this._scaleMatrix.makeScale(s, s, s);
        if(this.cursorZoom == true) {
            //da sistemare
            //updateMatrixState();
            const p = this.unprojectOnTbPlane(camera, event.clientX, event.clientY, renderer.domElement);
            this._v3_1.set(p.x, p.y, 0);
            this._translateMatrix.makeTranslation(p.x, p.y, p.z);
            this._m4_1.copy(this._objMatrixState).premultiply(this._translateMatrix);
            this._m4_1.premultiply(this._scaleMatrix);
            this._translateMatrix.makeTranslation(-p.x, -p.y, -p.z);
            this._m4_1.premultiply(translateMatrix);
            this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
            //this.obj.matrix.copy(this._m4_1);

            this.dispatchEvent(this._changeEvent);
        }
        else {
            this._m4_1.copy(this._objMatrixState).premultiply(this._scaleMatrix);
            //this._m4_1.premultiply(this._rotateMatrix);
            //this._m4_1.premultiply(this._scaleMatrix);
            this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
            //this.obj.matrix.copy(this._m4_1);       
            this.dispatchEvent(this._changeEvent);
        }
        this.updateTbState(STATE.IDLE, false);
    };


    //event listeners (touch)

    //one finger listeners
    onSinglePanStart = (event) => {
        if(event.pointerType != 'mouse') {
            //enable one pointer listeners
            this._manager.on('singlepanmove', this.onSinglePanMove);
            this._manager.on('singlepanend', this.onSinglePanEnd);
    
            console.log("singlepanstart");
            const center = event.center;

            this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, center.x, center.y, this.canvas, this._tbRadius));
            this.updateTbState(STATE.ROTATE, true);
            this.enlightGizmosR(true);

            if(this.enableAnimations) {
                this._t0 = this.t;
                this._t = performance.now();
                this._angle0 = 0;
                this._angle = 0;
            }
            this.dispatchEvent(this._changeEvent);
        }
        else {
            //disable one pointer listener
            this._manager.off('singlepanmove', this.onSinglePanMove);
            this._manager.off('singlepanend', this.onSinglePanEnd);
            console.log('disabling_touch');
        }
    };

    onSinglePanMove = (event) => {
        const center = event.center;
        console.log('singlepanmove');                
        this._currentCursorPosition.copy(this.unprojectOnTbSurface(this.camera, center.x, center.y, this.canvas, this._tbRadius));
        const distance = this._startCursorPosition.distanceTo(this._currentCursorPosition);
        const angle = this._startCursorPosition.angleTo(this._currentCursorPosition);
        const amount = Math.max(distance/this._tbRadius, angle);
        this._rotationAxis.copy(this.calculateRotationAxis(this._startCursorPosition, this._currentCursorPosition));
        this.rotateObj(this._rotationAxis, amount);
        if(this.animateRotation) {
            this._t0 = this._t;
            this._t = performance.now();
            this._angle0 = angle;
            this._angle = amount;
        }
        this.dispatchEvent(this._changeEvent);
    };

    onSinglePanEnd = (event) => {
        console.log('singlepanend');
        this._manager.off('singlepanmove', this.onSinglePanMove);
        this._manager.off('singlepanend', this.onSinglePanEnd);
        if(this.enableAnimations) {
            this._w0 = Math.min(this.calculateAngularSpeed(this._angle0, this._angle, this._t0, this._t), this.vMax);
            window.requestAnimationFrame(this.onRotationAnim);
        }
        else {
            this.updateTbState(STATE.IDLE, false);
        }
    };

    onDoubleTap = (event) => {
        console.log('double_tap');
        const center = event.center;
        const hitP = this.unprojectOnObj(this.getCursorNDC(center.x, center.y, this.canvas), this.camera);
        if(hitP != null && this.enableAnimations) {
            //this.updateTbState(STATE.ANIMATION_DETAIL, true);
            this._v3_3.copy(hitP).multiplyScalar(-1);
            window.requestAnimationFrame(this.onDetailAnim);
        }
        else if(hitP != null && !this.enableAnimations) {
            this.updateTbState(STATE.IDLE, true);
            this._translateMatrix.makeTranslation(-hitP.x, -hitP.y, -hitP.z);
            this._scaleMatrix.makeScale(this.scaleFactor, this.scaleFactor, this.scaleFactor);
            this._m4_1.copy(this._objMatrixState).premultiply(this._translateMatrix);
            this._m4_1.premultiply(this._scaleMatrix);
            this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
            //this.obj.matrix.copy(this._m4_1);
            this.dispatchEvent(this._changeEvent);
        }
    };

    //two fingers listener
    onDoublePanStart = (event) => {
        if(event.pointerType != 'mouse') {
            console.log('2FE start');

            //enable 2 pointers listeners
            this._manager.on("doublepanmove pinchmove rotatemove", this.onDoublePanMove);
            this._manager.on("doublepanend pinchend rotateend", this.onDoublePanEnd);

            const center = event.center;    //middle point between fingers
            this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
            this._fingerDistance = this.calculateDistance(event.pointers[0], event.pointers[1]);
            this._fingerRotation = event.rotation;
            this.updateTbState(STATE.TOUCH_MULTI, true);
            this._quatState.copy(this._gizmos.quaternion);
        }
    };

    onDoublePanMove = (event) => {
        console.log('2FE move');
        const center = event.center;    //middle point between fingers
        const p = this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas);
        const newDistance = this.calculateDistance(event.pointers[0], event.pointers[1]);
        const s = newDistance/this._fingerDistance;   //how much to scale
        
        //scaling operation X = T(p)S(s)T(-p)
        this._v3_1.set(p.x, p.y, 0);  //fingers middle point
        
        this._scaleMatrix.makeTranslation(this._v3_1.x, this._v3_1.y, this._v3_1.z);   //T(v3_1)
        this._m4_1.makeScale(s, s, s);  //S(s)
        this._scaleMatrix.multiply(this._m4_1);
        this._m4_1.makeTranslation(-this._v3_1.x, -this._v3_1.y, -this._v3_1.z);    //T(-v3_1)
        this._scaleMatrix.multiply(this._m4_1);
        
        //rotation operation    X = T(p)R(r)T(-p)
        const r = (this._fingerRotation - event.rotation)*Math.PI/180; //angle in radians  
        this._rotateMatrix.makeTranslation(this._v3_1.x, this._v3_1.y, this._v3_1.z);   //T(v3_1)
        this._v3_2.set(0, 0, 1);
        this._m4_1.makeRotationAxis(this._v3_2, r);  //R(rotation)
        this._rotateMatrix.multiply(this._m4_1);
        this._m4_1.makeTranslation(-this._v3_1.x, -this._v3_1.y, -this._v3_1.z);    //T(-v3_1)
        this._rotateMatrix.multiply(this._m4_1);
        
        //rotate gizmos
        const quat = new THREE.Quaternion();
        quat.setFromAxisAngle(this._v3_2, r);
        quat.multiply(this._quatState);
        this._gizmos.setRotationFromQuaternion(quat);
        
        //translation operation T(p)
        this._currentCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
        const distanceV = this._startCursorPosition.clone().sub(this._currentCursorPosition);
        this._v3_1.set(-distanceV.x, -distanceV.y, 0);
        this._translateMatrix.makeTranslation(this._v3_1.x, this._v3_1.y, this._v3_1.z);   //T(v3_1)
        
        //apply matrix  TRS
        this._m4_1.copy(this._objMatrixState).premultiply(this._translateMatrix);
        this._m4_1.premultiply(this._rotateMatrix);
        this._m4_1.premultiply(this._scaleMatrix);
        this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
        //this.obj.matrix.copy(this._m4_1);

        this.dispatchEvent(this._changeEvent);
    };

    onDoublePanEnd = (event) => {
        //disable 2 pointers listeners
        this._manager.off("doublepanmove pinchmove rotatemove", this.onDoublePanMove);
        this._manager.off("doublepanend pinchend rotateend", this.onDoublePanEnd); 
    };




    /**
     * Calculate the angular speed
     * @param {Number} p0 Position at t0 
     * @param {Number} p1 Position at t1
     * @param {Number} t0 Initial time in milliseconds
     * @param {Number} t1 Ending time in milliseconds
     */
    calculateAngularSpeed = (p0, p1, t0, t1) => {
        const s = p1-p0;
        const t = (t1-t0)/1000;
        return s/t;
    };

    /**
     * Calculate the distance between two pointers
     * @param {PointerEvent} p0 The first pointer
     * @param {PointerEvent} p1 The second pointer
     * @returns {number} The distance between the two pointers 
     */
    calculateDistance = (p0, p1) => {
        return Math.sqrt(Math.pow(p1.clientX - p0.clientX, 2)+Math.pow(p1.clientY - p0.clientY, 2));
    };



    /**
     * Calculate the trackball radius based on the canvas size and the scaling factor
     * @param {number} radiusScaleFactor Scaling factor for reducing radius length
     * @param {HTMLElement} canvas The canvas where the renderer draws its output 
     * @returns {number} Radius of the trackball
     */
    calculateRadius = (radiusScaleFactor, canvas) => {
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
    calculateRotationAxis = (vec1, vec2) => {
        return this._rotationAxis.crossVectors(vec1, vec2).normalize();
    };

    /**
     * Draw a grid on the canvas
     */
    drawGrid = () => {
        const canvasRect = this.canvas.getBoundingClientRect(); //sostituire con document o window
        const size = Math.max(canvasRect.width, canvasRect.height)*3;
        const divisions = size/50;
        this.grid = new THREE.GridHelper(size, divisions);
        this._gridPosition.copy(this.grid.position);
        this.grid.rotateX(Math.PI/2);
        this._scene.add(this.grid);
    };

    /**
     * Compute the easing out cubic function for ease out effect in animation
     * @param {Number} t The absolute progress of the animation in the bound of 0 (beginning of the) and 1 (ending of animation)
     * @returns Result of easing out cubic at time t
     */
    easeOutCubic = (t) => {
        return 1-Math.pow(1-t, 3);
        //return Math.sqrt(1 - Math.pow(t - 1, 2));
    };

    /**
     * Set the rotation gizmos illumination
     * @param {Boolean} isActive If true, enlight gizmos, otherwise turn them off
     */
    enlightGizmosR = (isActive) => {
        const gX = this._gizmos.children[0];
        const gY = this._gizmos.children[1];
        const gZ = this._gizmos.children[2];
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
    getCursorNDC = (x, y, canvas) => {
        const canvasRect = canvas.getBoundingClientRect();
        this._v2_1.setX(((x - canvasRect.left) / canvasRect.width) * 2 - 1);
        this._v2_1.setY(((canvasRect.bottom - y) / canvasRect.height) * 2 - 1);
        return this._v2_1;
    };

    /**
     * Calculate the cursor position inside the canvas x/y coordinates with the origin being in the center of the canvas
     * @param {Number} x Cursor horizontal coordinate within the canvas 
     * @param {Number} y Cursor vertical coordinate within the canvas
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @returns {THREE.Vector2} Cursor normalized position inside the canvas
     */
    getCursorOnCanvas = (x, y, canvas) => {
        const canvasRect = canvas.getBoundingClientRect();
        this._v2_1.setX((x-canvasRect.left)-canvasRect.width/2);
        this._v2_1.setY((canvasRect.bottom-y)-canvasRect.height/2);
        return this._v2_1;
    };

    /**
     * Creates the rotation gizmos with radius equals to the given trackball radius
     * @param {THREE.Vector3} tbCenter The trackball's center
     * @param {number} tbRadius The trackball radius
     */
    makeGizmos = (tbCenter, tbRadius) => {
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

        this._gizmos.add(rotationGizmoX);
        this._gizmos.add(rotationGizmoY);
        this._gizmos.add(rotationGizmoZ);
    };

    /**
     * Perform animation for detail operation
     * @param {Number} time Instant when this function is called as performance.now()
     */
    onDetailAnim = (time) => {
        if(this._timeStart == -1) {
            //animation start
            this._timeStart = time;
            this.updateTbState(STATE.ANIMATION_DETAIL, true);
        }
        if(this._state == STATE.ANIMATION_DETAIL) {
            const deltaTime = time - this._timeStart;
            const animTime = deltaTime/this.detailAnimTime;
            this._m4_1.copy(this._translateMatrix);
            this._m4_2.copy(this._scaleMatrix);
            if(animTime >= 1) {
                //animation end
                this._translateMatrix.makeTranslation(this._v3_3.x, this._v3_3.y, this._v3_3.z);
                this._scaleMatrix.makeScale(this.scaleFactor, this.scaleFactor, this.scaleFactor);
                this._m4_1.copy(this._objMatrixState).premultiply(this._translateMatrix);
                this._m4_1.premultiply(this._scaleMatrix);

                this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
                //this.obj.matrix.copy(this._m4_1);
                this._timeStart = -1;
                this.updateTbState(STATE.IDLE, false);
                window.cancelAnimationFrame(this.onDetailAnim);
                this.dispatchEvent(this._changeEvent); 
            }
            else {
                const amount = this.easeOutCubic(animTime);
                const s = ((1-amount)+(this.scaleFactor*amount));
                this._v3_2.copy(this._v3_3).multiplyScalar(amount);
                this._translateMatrix.makeTranslation(this._v3_2.x, this._v3_2.y, this._v3_2.z);
                this._scaleMatrix.makeScale(s, s, s);
                this._m4_1.copy(this._objMatrixState).premultiply(this._translateMatrix);
                this._m4_1.premultiply(this._scaleMatrix);

                this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
                //this.obj.matrix.copy(this._m4_1);
                this.dispatchEvent(this._changeEvent);
                window.requestAnimationFrame(this.onDetailAnim);
            }
        }
        else {
            //interrupt animation
            this._timeStart = -1;
            window.cancelAnimationFrame(this.onDetailAnim);
        }
    };
    
    /**
     * Perform animation for rotation operation
     */
    onRotationAnim = (time) => {
        if(this._timeStart == -1) {
            //animation start
            this._angle0 = 0
            this._angle = 0;
            this._timeStart = time;
            this.updateTbState(STATE.ANIMATION_ROTATE, true);
        }
        if(this._state == STATE.ANIMATION_ROTATE) {
            const deltaTime = (time - this._timeStart)/1000;
            this._angle0 = this._angle;
            this._angle = 0.5*this.acc*Math.pow(deltaTime, 2)+this._w0*deltaTime+0;
            if(this._angle >= this._angle0) {
                this.rotateObj(this._rotationAxis, this._angle);
                this.dispatchEvent(this._changeEvent);
                window.requestAnimationFrame(this.onRotationAnim);
            }
            else {
                this._timeStart = -1;
                this.updateMatrixState(STATE.ANIMATION_ROTATE, false);
                this.enlightGizmosR(false);
                this._t = 0;
                this._angle = 0;
                window.cancelAnimationFrame(this.onRotationAnim);
                this.dispatchEvent(this._changeEvent);
            }
        }
        else {
            //interrupt animation
            this._timeStart = -1;
            if(this._state != STATE.ROTATE) {
                this.enlightGizmosR(false);
            }
            this._t = 0;
            this._angle = 0;
            window.cancelAnimationFrame(this.onRotationAnim);
            this.dispatchEvent(this._changeEvent);
        }
    };
    
    pan = (p1, p2) => {
        const distanceV = p1.clone().sub(p2);
        this._v3_1.set(-distanceV.x, -distanceV.y, 0);
        this._translateMatrix.makeTranslation(this._v3_1.x, this._v3_1.y, this._v3_1.z);   //T(v3_1)
    
        this._m4_1.copy(this._objMatrixState).premultiply(this._translateMatrix);
        this._m4_1.premultiply(this._scaleMatrix);
        this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
        //this.obj.matrix.copy(this._m4_1);
    
        //move grid
        if(this.enableGrid) {
            this.grid.position.addVectors(this._gridPosition, this._v3_1);   
        }
    };

    /**
     * Set the object's size to correctly fit inside gizmos
     */
    resizeObject = () => {
        let bbox = new THREE.Box3().setFromObject(this.obj);
        bbox.getSize(this._v3_1);
        bbox.getCenter(this._v3_2);
        let maxSize = Math.max(this._v3_1.x, this._v3_1.y, this._v3_1.z);
        let s = (this._tbRadius/maxSize)*2;
        this._translateMatrix.makeTranslation(-this._v3_2.x, -this._v3_2.y, -this._v3_2.z);
        this._scaleMatrix.makeScale(s, s, s);
        this._m4_1.copy(this.obj.matrix).premultiply(this._translateMatrix);
        this._m4_1.premultiply(this._scaleMatrix);
        this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
        this.obj.matrix.copy(this._m4_1);
        this.updateMatrixState();
        this.dispatchEvent(this._changeEvent);
    };

    /**
     * Perform rotation operation rotating the object along with the trackball gizmos
     * @param {THREE.Vector3} axis Rotation axis
     * @param {number} rad Angle in radians
     */
    rotateObj = (axis, rad) => {
        let quat = new THREE.Quaternion();
        quat.setFromAxisAngle(axis, rad);
        this._rotateMatrix.makeRotationFromQuaternion(quat);
        quat.multiply(this._quatState);
        this._gizmos.setRotationFromQuaternion(quat);    //rotate gizmos
        this._m4_1.copy(this._objMatrixState).premultiply(this._rotateMatrix);
        this._m4_1.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
        //this.obj.matrix.copy(this._m4_1);
    };

    /**
     * Unproject the cursor on the object surface
     * @param {THREE.Vector2} cursor Cursor coordinates in NDC
     * @param {THREE.Camera} camera Virtual camera
     * @returns The intersection point between the ray and the object, if exist, null otherwise
     */
    unprojectOnObj = (cursor, camera) => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(cursor, camera);
        const intersect = raycaster.intersectObject(obj, true);
        if(intersect.length == 0) {
            return  null;
        }
        else {
            return this._v3_1.copy(intersect[0].point);
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
    unprojectOnTbSurface = (camera, x, y, canvas, tbRadius) => {
        if(camera.type == 'OrthographicCamera') {
            this._v2_1.copy(this.getCursorOnCanvas(x, y, canvas));
            this._v3_1.setX(this._v2_1.x);
            this._v3_1.setY(this._v2_1.y);
            let x2 = Math.pow(this._v2_1.x, 2);
            let y2 = Math.pow(this._v2_1.y, 2);
            let r2 = Math.pow(this._tbRadius, 2);

            if(x2+y2 <= r2/2) {
                //intersection with sphere
                this._v3_1.setZ(Math.sqrt(r2-(x2+y2)));
            }
            else {
                //intersection with hyperboloid
                this._v3_1.setZ((r2/2)/(Math.sqrt(x2+y2)));
            }
            return this._v3_1;
        }
        else if(camera.type == 'PerspectiveCamera') {
            this._v2_1.copy(this.getCursorNDC(x, y, canvas));
            const nearPlanePoint = new THREE.Vector3(this._v2_1.x, this._v2_1.y, -1);
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
    unprojectOnTbPlane = (camera, x, y, canvas) => {
        if(camera.type == 'OrthographicCamera') {
            this._v2_1.copy(this.getCursorOnCanvas(x, y, canvas));
            this._v3_1.set(this._v2_1.x, this._v2_1.y, 0);
            return this._v3_1;
        }
        else if(camera.type == 'PerspectiveCamera') {
            this._v2_1.copy(this.getCursorNDC(x, y, canvas));

            //unproject cursor on the near plane
            this._v3_1.set(this._v2_1.x, this._v2_1.y, -1);
            this._v3_1.unproject(camera);
            const r0 = camera.position.clone(); //vector origin
            const rDir = new THREE.Vector3().subVectors(v3_1, r0).normalize() ;    //direction vector
        
            const h = this._v3_1.z - camera.position.z;
            const l = Math.sqrt(Math.pow(this._v3_1.x, 2)+Math.pow(this._v3_1.y, 2));
        
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
    updateMatrixState = () => {
        this._objMatrixState.copy(this.obj.matrix);

        //reset all matrices because the state has been updated
        this._translateMatrix.makeTranslation(0, 0, 0);
        this._rotateMatrix.identity();    //not really needed
        this._scaleMatrix.makeScale(1, 1, 1);
        this._notchCounter = 0;
        this._quatState.copy(this._gizmos.quaternion);
    };

    /**
     * Update the trackball FSA
     * @param {STATE} newState New state of the FSA
     * @param {Boolean} propagate If true, update matrices and counters
     */
    updateTbState = (newState, propagate) => {
        this._state = newState;
        if(propagate) {
            this.updateMatrixState();
        }
    };
};




const canvas = document.getElementById("canvas");
let obj = new THREE.Group();

//renderer
const renderer = new THREE.WebGLRenderer({canvas});

//scene
const scene = new THREE.Scene();

//camera
let camera = makeOrthographicCamera(renderer.domElement);
scene.add(camera);

//light
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

const loader = new OBJLoader();
loader.load('rocker_arm.obj', onLoad); 

resizeRenderer(renderer);

let arcball;


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
    arcball.scaleFactor = scaleSlider.value;
});
accSlider.addEventListener('change', function accChangeListener() {
    arcball.acc = accSlider.value*-1;
});
angularSlider.addEventListener('change', function angularChangeListener() {
    arcball.vMax = angularSlider.value;
});
animCheck.addEventListener('change', function animCheckListener() {
    arcball.enableAnimations = animCheck.checked;
});
gridCheck.addEventListener('change', function gridCheckListener() {
    arcball.showGrid = gridCheck.checked;
});







//obj = loadObject(renderer.domElement, group);    //load the 3D object
//makeGizmos(tbCenter, tbRadius);  //add gizmos
//scene.add(gizmosR);
//resizeRenderer(renderer);
renderer.render(scene, camera);


window.addEventListener('resize', function windowResizeListener(){
    resizeRenderer(renderer);
    //tbRadius = calculateRadius(radiusScaleFactor, renderer.domElement);
    //camera.position.z = tbRadius*4;
    camera.position.z = 500;
    //gizmosR.clear();
    //loadObject(renderer.domElement, loader);  //replace with scaleObject()
    //makeGizmos(tbCenter, tbRadius);
    renderer.render(scene, camera);
});


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


function onLoad(o) {
    obj = o;
    scene.add(obj);

    arcball = new Arcball(camera, obj, renderer.domElement);
    arcball.addEventListener('change', function() {
        renderer.render(scene, camera);
    });
    renderer.render(scene, camera);
};


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