import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import {GLTFLoader} from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js'
import {OBJLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/OBJLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.121.1/examples/jsm/controls/OrbitControls.js';
import * as HAMMERJS from 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'

//import * as THREE from './node_modules/three/src/Three.js';
//import {Arcball} from './Arcball_object';


//trackball's state
let STATE = {
    IDLE: "IDLE",
    ROTATE: "ROTATE",
    PAN: "PAN",
    SCALE: "SCALE",
    ZROTATE: "ZROTATE",
    TOUCH_MULTI: "TOUCH_MULTI",
    ANIMATION_DETAIL: "ANIMATION_DETAIL",
    ANIMATION_ROTATE: "ANIMATION_ROTATE"
};


/**
 * 
 * @param {THREE.Camera} camera Virtual camera used in the scene
 * @param {HTMLElement} domElement Renderer's dom element
 */
class Arcball extends THREE.EventDispatcher{
    constructor(camera, domElement) {
        super();
        this.camera = null;
        this.canvas = domElement;
        this._scene = camera.parent;


        //global vectors and matrices that can be used in some operations to avoid creating new object at every call (e.g. every time cursor moves)
        //these operations must not overlap
        this._v2_1 = new THREE.Vector2();
        this._v3_1 = new THREE.Vector3();
        this._v3_2 = new THREE.Vector3();

        this._m4_1 = new THREE.Matrix4();
        this._m4_2 = new THREE.Matrix4();
        this._startScalePoint = new THREE.Vector3();
        this._currentScalePoint = new THREE.Vector3();
        this._rotationPoint = new THREE.Vector3();


        //transformation matrices
        this._translateMatrix = new THREE.Matrix4();    //matrix for translation operation
        this._rotateMatrix = new THREE.Matrix4();   //matrix for rotation operation
        this._scaleMatrix = new THREE.Matrix4();    //matrix for scaling operation

        this._rotationAxis = new THREE.Vector3();   //axis for rotate operation


        //object's state
        this._cameraMatrixState = new THREE.Matrix4(); //object's matrix state
        this._cameraProjectionState = new THREE.Matrix4();   //camera's unprojection matrix state
        //this._quatState = new THREE.Quaternion(); //object's quaternion value at first mouse click/tap

        this._zoomState = 1;

        this._gizmoMatrixState = new THREE.Matrix4();
        this._dummyMatrixState = new THREE.Matrix4();
    
        //initial states for reset
        this._zoom0 = 1;
        this._fov0 = 0;
        this._cameraMatrixState0 = new THREE.Matrix4();
        this._gizmoMatrixState0 = new THREE.Matrix4();
        this._dummyMatrixState0 = new THREE.Matrix4();

        //double fingers touch interaction only
        this._startFingerDistance = 0; //distance between two fingers
        this._currentFingerDistance = 0;
        this._startFingerRotation = 0; //amount of rotation performed with two fingers
        this._currentFingerRotation = 0;

        //cursor positions
        this._currentCursorPosition = new THREE.Vector3();
        this._startCursorPosition = new THREE.Vector3();

        //grid state
        this._gridPosition = new THREE.Vector3();

        this._mouseDown = false; //if mouse left button is down
        this._wheelDown = false;  //if mouse wheel button is down
        this._notchCounter = 0;   //represent the wheel resulting position
        this._grid = null;   //Grid to be visualized during pan operation
        this._gizmos = new THREE.Group();

        this._changeEvent = {type: 'change'};

        //detail animation variables
        this.detailAnimTime = 500; //detail animation duration in ms
        this._timeStart = -1; //animation initial time

        //rotation animation variables
        this._t0 = 0; //time before rotation has been released
        this._t = 0;  //time when rotation has been released
        this._angle0 = 0; //angle before rotation has been released
        this._angle = 0;  //angle when rotation has been released
        this._w0;

        this._animationId = 0;

        //parameters
        this.scaleFactor =1.25;
        this.acc = 25*-1; //acceleration
        this.vMax = 20;
        this.enableAnimations = true;    //if animations should be performed
        this.enableGrid = true;   //if grid should be showed during pan operation
        this.cursorZoom = false;

        //trackball parameters
        this._tbCenter = new THREE.Vector3(0, 0, 0);
        this._tbRadius = 1;

        this._state = STATE.IDLE;
        this._prevState = this._state;

        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('wheel', this.onWheel);

        //touch gestures
        this._manager = new Hammer.Manager(this.canvas);

        this._singlePan = new Hammer.Pan({event: 'singlepan', pointers: 1, threshold: 0, direction: Hammer.DIRECTION_ALL});
        this._doublePan = new Hammer.Pan({event: 'doublepan', pointers: 2, threshold: 0, direction: Hammer.DIRECTION_ALL});
        this._pinch = new Hammer.Pinch();
        this._rotate = new Hammer.Rotate();
        this._doubleTap = new Hammer.Tap(({event: 'doubletap', taps: 2, threshold: 4, posThreshold: 20}));

        this._manager.add([this._singlePan, this._doubleTap, this._doublePan, this._pinch, this._rotate]);
        this._manager.get('doublepan').recognizeWith('singlepan');
        this._manager.get('doublepan').recognizeWith('pinch');
        this._manager.get('doublepan').recognizeWith('rotate');

        this._manager.get('pinch').recognizeWith('singlepan');
        this._manager.get('pinch').recognizeWith('doublepan');
        this._manager.get('pinch').recognizeWith('rotate');

        this._manager.get('rotate').recognizeWith('singlepan');
        this._manager.get('rotate').recognizeWith('pinch');
        this._manager.get('rotate').recognizeWith('doublepan');

        this._manager.on('doubletap', this.onDoubleTap);
        this._manager.on('singlepanstart', this.onSinglePanStart);
        this._manager.on('doublepanstart', this.onDoublePanStart);
        this._manager.on('pinchstart', this.onPinchStart);
        this._manager.on('rotatestart', this.onRotateStart);


        //dummy
        this.dummy = new THREE.Object3D();

        this.zAxisDebug = null;
        this.scalePointDebug = null;

        this.setCamera(camera);
        this._scene.add(this._gizmos);
    };

    //listener for mouse left and wheel buttons
    onMouseDown = (event) => {
        if(event.button == 1) {
            event.preventDefault();
            this._manager.off('singlepanstart', this.onSinglePanStart);
            console.log('wheel_down');
            this._wheelDown = true;
            if(this._state != STATE.ROTATE && this._state != STATE.PAN) {
                //otherwise listeners will be already active
                document.addEventListener('mousemove', this.onMouseMove);
                document.addEventListener('mouseup', this.onMouseUp);
            }
            //pan operation
            if(this._state != STATE.PAN) {
                //not already panning with mouse+keyboard
                /*if(this._state == STATE.IDLE) {
                    document.addEventListener('mousemove', this.onMouseMove);
                }*/
                if(this._state == STATE.ROTATE) {
                    this.enlightGizmosR(false);
                }
                this.updateTbState(STATE.PAN, true);
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
                console.log(this._startCursorPosition);

                if(this.enableGrid) {
                    this.drawGrid();
                    this.dispatchEvent(this._changeEvent);
                }
            }
        }
    };

    onMouseMove = (event) => {
        console.log('mouse_move');

        if(this._state == STATE.PAN) {
            //continue with panning routine
            this._currentCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
            this.applyTransformMatrix(this.pan(this._startCursorPosition, this._currentCursorPosition));
            this.dispatchEvent(this._changeEvent);
        }
        else if(this._state == STATE.IDLE) {
            //operation interrupted while moving mouse
            //update state and resume pan operation
            this._state = STATE.PAN;
            this.updateTbState(STATE.PAN, true);
            this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, event.clientX, event.clientY, this.canvas));
        }
    };


    onMouseUp = (event) => {
        if(event.button == 1) {
            this._manager.on('singlepanstart', this.onSinglePanStart);
            console.log('wheel_up');
            this._wheelDown = false;
            if(this._mouseDown) {
                if(!event.ctrlKey && !event.metaKey) {
                    //switch to rotate operation
                    this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, event.clientX, event.clientY, this.canvas, this._tbRadius));
                    this.updateTbState(STATE.ROTATE, true);
                    if(this.enableGrid) {
                        this.disposeGrid();
                        this.grid = null;
                    }
                    this.enlightGizmosR(true);
                    this.dispatchEvent(this._changeEvent);
                }
            }
            else {
                this.updateTbState(STATE.IDLE, false);
                document.removeEventListener('mousemove', this.onMouseMove);
                document.removeEventListener('mouseup', this.onMouseUp);
                if(this.enableGrid) {
                    this.disposeGrid();
                    this.dispatchEvent(this._changeEvent);
                }
            }
        }
    };

    onWheel = (event) => {
        event.preventDefault();
        const notchDeltaY = 125;    //distance of one notch of mouse wheel
        const sgn = event.deltaY/notchDeltaY;

        if(event.ctrlKey || event.metaKey) {
            this.setFov(this.camera.fov + sgn);
        }
        else {
            if(this._state != STATE.IDLE) {
                this._prevState = this._state;
            }
    
            this.updateTbState(STATE.SCALE, true);
            console.log('wheel_scroll');

            let s = 1;
            this._notchCounter += sgn;
            if(this._notchCounter > 0) {
                s = Math.pow(this.scaleFactor, this._notchCounter);
            }
            else if(this._notchCounter < 0) {
                s = 1/(Math.pow(this.scaleFactor, -this._notchCounter));
            }
            this.applyTransformMatrix(this.scale(s, this._gizmos.position));
            this.updateTbState(STATE.IDLE, false);
        }
        this.dispatchEvent(this._changeEvent);
    };


    //event listeners (touch)

    //one finger listeners
    onSinglePanStart = (event) => {
        console.log('singlepanstart');
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this._manager.on('singlepanmove', this.onSinglePanMove);
        this._manager.on('singlepanend', this.onSinglePanEnd);

        const center = event.center;
        this._mouseDown = true;
        if(event.srcEvent.ctrlKey || event.srcEvent.metaKey) {
            //pan operation
            if(this._state != STATE.PAN) {
                //not already panning with wheel button
                this.updateTbState(STATE.PAN, true);
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
                if(this.enableGrid) {
                    this.drawGrid();
                    this.dispatchEvent(this._changeEvent);
                }
            }
        }
        else {
            //rotate operation
            if(this._state == STATE.PAN && this.enableGrid) {
                this.disposeGrid();
            }
            this.updateTbState(STATE.ROTATE, true);
            this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, center.x, center.y, this.canvas, this._tbRadius));
            console.log(this._startCursorPosition);
            this.enlightGizmosR(true);
            if(this.enableAnimations) {
                this._t0 = this._t = performance.now();
                this._angle = this._angle0 = 0;
            }
            this.dispatchEvent(this._changeEvent);
        }
    };

    onSinglePanMove = (event) => {
        const center = event.center;
        console.log('singlepanmove');                
        
        if(this._state == STATE.ROTATE) {
            if(event.srcEvent.ctrlKey || event.srcEvent.metaKey) {
                //switch to pan operation
                this.updateTbState(STATE.PAN, true);
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
                if(this.enableGrid) {
                    this.drawGrid();
                }
                this.enlightGizmosR(false);
            }
            else{
                //continue with rotation routine
                this._currentCursorPosition.copy(this.unprojectOnTbSurface(this.camera, center.x, center.y, this.canvas, this._tbRadius));
                const distance = this._startCursorPosition.distanceTo(this._currentCursorPosition);
                const angle = this._startCursorPosition.angleTo(this._currentCursorPosition);
                const amount = Math.max(distance/this._tbRadius, angle);  //effective rotation angle
                this.applyTransformMatrix(this.rotate(this.calculateRotationAxis(this._startCursorPosition, this._currentCursorPosition), amount));
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
            if(!this._wheelDown && !(event.srcEvent.ctrlKey ||event.srcEvent.metaKey)) {
                //si può omettere wheeldown?
                //switch to rotate operation
                this.updateTbState(STATE.ROTATE, true);
                this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, center.x, center.y, this.canvas, this._tbRadius));
                if(this.enableGrid) {
                    this.disposeGrid();
                }
                this.enlightGizmosR(true);
            }
            else {
                //continue with panning routine
                this._currentCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
                this.applyTransformMatrix(this.pan(this._startCursorPosition, this._currentCursorPosition));
            }
            this.dispatchEvent(this._changeEvent);
        }
        else if(this._state == STATE.IDLE) {
            //operation interrupted while moving mouse
            //update state and resume last operation
            this._state = this._prevState;
            if(this._state == STATE.PAN) {
                this.updateTbState(STATE.PAN, true);
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
            }
            else if(this._state == STATE.ROTATE) {
                this.updateTbState(STATE.ROTATE, true);
                this._startCursorPosition.copy(this.unprojectOnTbSurface(this.camera, center.x, center.y, this.canvas, this._tbRadius));
            }
        }        
    };

    onSinglePanEnd = (event) => {
        console.log('singlepanend');
        this._manager.off('singlepanmove', this.onSinglePanMove);
        this._manager.off('singlepanend', this.onSinglePanEnd);
        this.canvas.addEventListener('mousedown', this.onMouseDown);


        this._mouseDown = false;
        const center = event.center;

        if(this._wheelDown) {
            if(this._state != STATE.PAN) {
                //switch to pan operation
                this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas));
                this.updateTbState(STATE.PAN, true);
                if(this.enableGrid) {
                    this.drawGrid();
                }
                this.enlightGizmosR(false);
                this.dispatchEvent(this._changeEvent);
            }
        }
        else {
            if(this._state == STATE.ROTATE) {
                if(this.enableAnimations) {
                    //perform rotation animation
                    let w0 = Math.min(this.calculateAngularSpeed(this._angle0, this._angle, this._t0, this._t), this.vMax);
                    if(w0 > 0) {
                        //a rotation has been performed, start animation
                        const rotationAxis = (this.calculateRotationAxis(this._startCursorPosition, this._currentCursorPosition));
                        const self = this;
                        this._animationId = window.requestAnimationFrame(function(t) {
                            self.updateTbState(STATE.ANIMATION_ROTATE, true);
                            self.onRotationAnim(t, rotationAxis, w0);
                        });
                    }
                    else {
                        //mouse has been released but rotation never happened
                        this.updateTbState(STATE.IDLE, false);
                        this.enlightGizmosR(false);
                        this.dispatchEvent(this._changeEvent);
                    }
                }
                else {
                    this.updateTbState(STATE.IDLE, false);
                    this.enlightGizmosR(false);
                    this.dispatchEvent(this._changeEvent);
                }
            }
            else if(this._state == STATE.PAN || this._prevState == STATE.PAN) {
                //maybe dispose grid when scaling?
                this.updateTbState(STATE.IDLE, false);
                if(this.enableGrid) {
                    this.disposeGrid();
                    this.dispatchEvent(this._changeEvent);
                }
            }
            else {
                this.enlightGizmosR(false);
                this.dispatchEvent(this._changeEvent);
            }
        }
    };

    onDoubleTap = (event) => {
        console.log('double_tap');
        const center = event.center;

        const hitP = this.unprojectOnObj(this.getCursorNDC(center.x, center.y, this.canvas), this.camera);
        if(hitP != null && this.enableAnimations) {
            const self = this;
            window.cancelAnimationFrame(this._animationId);
            this._timeStart = -1;
            this._animationId = window.requestAnimationFrame(function(t) {
                self.updateTbState(STATE.ANIMATION_DETAIL, true);
                self.onDetailAnim(t, hitP, self._cameraMatrixState, self._gizmoMatrixState);
            });
        }
        else if(hitP != null && !this.enableAnimations) {
            this.updateTbState(STATE.IDLE, true);
            this.detail(hitP, this.scaleFactor);
            this.dispatchEvent(this._changeEvent);
        }
    };

    //two fingers listener
    onDoublePanStart = (event) => {
        console.log('doublepan start');
        this.updateTbState(STATE.PAN, true);

        this._manager.on('doublepanmove', this.onDoublePanMove);
        this._manager.on('doublepanend', this.onDoublePanEnd);
        this._manager.on('doublepancancel', this.onDoublePanCancel);

        const center = event.center;
        this._startCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas, true));
        this._currentCursorPosition.copy(this._startCursorPosition);
    };

    onDoublePanMove = (event) => {
        console.log('doublepan move');
        const center = event.center;
        if(this._state != STATE.PAN) {
            this.updateTbState(STATE.PAN, true);
            this._startCursorPosition.copy(this._currentCursorPosition);
        }

        this._currentCursorPosition.copy(this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas, true));
        const pan = this.pan(this._startCursorPosition, this._currentCursorPosition, true);
        this.applyTransformMatrix(pan);
        this.dispatchEvent(this._changeEvent);
    };

    onDoublePanEnd = (event) => {
        console.log('doublepan end');
        this._manager.off('doublepanmove', this.onDoublePanMove);
        this._manager.off('doublepanend', this.onDoublePanEnd);
    };


    onRotateStart = (event) => {
        console.log('zRotate start');
        this.updateTbState(STATE.ZROTATE, true);
        this._startFingerRotation = event.rotation;
        this._currentFingerRotation = this._startFingerRotation;
        this.camera.getWorldDirection(this._rotationAxis);  //rotation axis

        this._manager.on('rotatemove', this.onRotateMove);
        this._manager.on('rotateend', this.onRotateEnd);
        this._manager.off('rotatecancel', this.onRotateCancel);
    };

    onRotateMove = (event) => {
        console.log('zRotate move');
        const center = event.center;

        if(this._state != STATE.ZROTATE) {
            this.updateTbState(STATE.ZROTATE, true);
            this._startFingerRotation = this._currentFingerRotation;
        }

        this._currentFingerRotation = event.rotation;
        const rotationPoint = this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas).applyQuaternion(this.camera.quaternion).multiplyScalar(1/this.camera.zoom).add(this._gizmos.position);
        //const amount = (this._startFingerRotation - this._currentFingerRotation)*Math.PI/180;
        const amount = THREE.MathUtils.DEG2RAD * (this._startFingerRotation - this._currentFingerRotation);

        const rotate = this.zRotate(rotationPoint, amount);
        this.applyTransformMatrix(rotate);
        this.dispatchEvent(this._changeEvent);
    };

    onRotateEnd = (event) => {
        console.log('zRotate end');
        this._manager.off('rotatemove', this.onRotateMove);
        this._manager.off('rotateend', this.onRotateEnd);
    };

    onPinchStart = (event) => {
        console.log('pinch start');

        this._manager.on('pinchmove', this.onPinchMove);
        this._manager.on('pinchend', this.onPinchEnd);

        this.updateTbState(STATE.SCALE, true);

        this._startFingerDistance = this.calculateDistance(event.pointers[0], event.pointers[1]);
        this._currentFingerDistance =  this._startFingerDistance;
    };

    onPinchMove = (event) => {
        console.log('pinch move');
        const center = event.center; 

        if(this._state != STATE.SCALE) {
            this._startFingerDistance = this._currentFingerDistance;
            this.updateTbState(STATE.SCALE, true);
        }

        this._currentFingerDistance = this.calculateDistance(event.pointers[0], event.pointers[1]);
        const amount = this._currentFingerDistance/this._startFingerDistance;

        let scalePoint;
        if(this.camera.type == 'OrthographicCamera') {
            scalePoint = this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas).applyQuaternion(this.camera.quaternion).multiplyScalar(1/this.camera.zoom).add(this._gizmos.position);
        }
        else if(this.camera.type == 'PerspectiveCamera') {
            scalePoint = this.unprojectOnTbPlane(this.camera, center.x, center.y, this.canvas).applyQuaternion(this.camera.quaternion).add(this._gizmos.position);
        }

        const scale = this.scale(amount, scalePoint);
        this.applyTransformMatrix(scale);
        this.dispatchEvent(this._changeEvent);
    };

    onPinchEnd = (event) => {
        console.log('pinch end');
        this._manager.off('pinchmove', this.onPinchMove);
        this._manager.off('pinchend', this.onPinchEnd);
    };


    /**
     * Apply a transformation matrix resulting from some operation to the camera and gizmos
     * @param {Object} transformation Object containing matrices to apply to camera and gizmos
     */
    applyTransformMatrix(transformation) {
        if(transformation.camera != undefined) {
            this._m4_1.copy(this._cameraMatrixState).premultiply(transformation.camera);
            this._m4_1.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
            this.camera.updateMatrix();
        }
        if(transformation.gizmo != undefined) {
            this._m4_1.copy(this._gizmoMatrixState).premultiply(transformation.gizmo);
            this._m4_1.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
            this._gizmos.updateMatrix();
        }
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
        if(t == 0) {
            return 0;
        }
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
     * Calculate the rotation axis as the vector perpendicular between two vectors
     * @param {THREE.Vector3} vec1 The first vector
     * @param {THREE.Vector3} vec2 The second vector
     * @returns {THREE.Vector3} The normalized rotation axis
     */
    calculateRotationAxis = (vec1, vec2) => {
        const rotationState = new THREE.Matrix4().extractRotation(this._cameraMatrixState);
        const quatState = new THREE.Quaternion().setFromRotationMatrix(rotationState);

        //return this._rotationAxis.crossVectors(vec1, vec2).applyQuaternion(m).normalize();
        this._rotationAxis.crossVectors(vec1, vec2);
        this._rotationAxis.applyQuaternion(quatState);
        return this._rotationAxis.normalize();
    };

    /**
     * Detail operation consist of positioning the point of interest in front of the camera and slightly zoom the whole model
     * @param {THREE.Vector3} p The point of interest 
     * @param {Number} s Scale factor
     */
    detail = (p, s, amount = 1) => {
        console.log('detail');
        const hitP = p.clone();

        //move center of camera (with gizmos) towards point of interest
        hitP.sub(this._gizmos.position).multiplyScalar(amount);
        this._translateMatrix.makeTranslation(hitP.x, hitP.y, hitP.z);

        const gizmoStateTemp = this._gizmoMatrixState.clone();
        this._gizmoMatrixState.premultiply(this._translateMatrix);
        this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale)

        const cameraStateTemp = this._cameraMatrixState.clone();
        this._cameraMatrixState.premultiply(this._translateMatrix);
        this._cameraMatrixState.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);


        //this._m4_1.copy(this._cameraMatrixState).premultiply(this._translateMatrix);
        //this.applyTransformMatrix({camera: this._m4_1.clone()});
        //this._m4_1.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);

        //apply zoom
        this.applyTransformMatrix(this.scale(s, this._gizmos.position));

        this._gizmoMatrixState.copy(gizmoStateTemp);
        this._cameraMatrixState.copy(cameraStateTemp);
        //this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale)

    };

    /**
     * Draw a grid and add it to the scene
     */
    drawGrid = () => {
        let size;
        let divisions;
        if(this.camera.type == 'OrthographicCamera') {
            const width = this.camera.right - this.camera.left;
            const height = this.camera.bottom - this.camera.top;
            size = Math.max(width, height)*2/this.camera.zoom;
            divisions = (size*0.5)*this.camera.zoom;
        }
        else if(this.camera.type == 'PerspectiveCamera') {
            const fov = THREE.MathUtils.DEG2RAD * this.camera.fov;
            const distance = this.camera.position.distanceTo(this._gizmos.position);
            const distance0 = new THREE.Vector3().setFromMatrixPosition(this._cameraMatrixState0).distanceTo(new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState0));
            size = Math.tan(fov*0.5)*distance*8;
            divisions = (size*0.5)*(distance0/distance);
        }
        
        if(this._grid == null) {
            this._grid = new THREE.GridHelper(size, divisions);
            this._grid.position.copy(this._gizmos.position);
            this._gridPosition.copy(this._grid.position);
            this._grid.quaternion.copy(this.camera.quaternion);
            this._grid.rotateX(Math.PI*0.5);
    
            this._scene.add(this._grid);
        }
    };

    /**
     * remove grid from the scene
     */
    disposeGrid = () => {
        if(this._grid != null) {
            this._scene.remove(this._grid);
            this._grid = null;
        }
    };

    /**
     * Compute the easing out cubic function for ease out effect in animation
     * @param {Number} t The absolute progress of the animation in the bound of 0 (beginning of the) and 1 (ending of animation)
     * @returns Result of easing out cubic at time t
     */
    easeOutCubic = (t) => {
        //return 1-Math.pow(1-t, 3);
        return Math.sqrt(1 - Math.pow(t - 1, 2));
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
     * @returns {THREE.Vector2} Cursor position inside the canvas
     */
    getCursorPosition = (x, y, canvas) => {
        //this._v2_1.setX((x-canvasRect.left)-canvasRect.width/2);
        //this._v2_1.setY((canvasRect.bottom-y)-canvasRect.height/2);
        this._v2_1.copy(this.getCursorNDC(x, y, canvas));
        this._v2_1.x *= (this.camera.right - this.camera.left)*0.5;
        this._v2_1.y *= (this.camera.top - this.camera.bottom)*0.5;
        return this._v2_1;
    };

    /**
     * Set the camera to be controlled
     * @param {THREE.Camera} camera The virtual camera to be controlled
     */
    setCamera = (camera) => {
        const distance = camera.position.length();

        let material = new THREE.MeshBasicMaterial({color: 0x777777, transparent: true, opacity: 0.90});
        let geometry;

        if(camera.type == 'OrthographicCamera') {
            this._tbRadius = Math.min(camera.top, camera.right)*0.66;

            this.makeGizmos(this._tbCenter, this._tbRadius);
            let width = camera.right - camera.left;
            let height = camera.top - camera.bottom;
            let depth = camera.far - camera.near;

            geometry = new THREE.BoxGeometry(width, height, depth);
            this.dummy = new THREE.Mesh(geometry, material);
            this.dummy.translateZ(-depth*0.5);
            this.dummy.updateMatrix();
        }
        else if(camera.type == 'PerspectiveCamera') {
            this._fov0 = camera.fov;
            const halfFov = THREE.MathUtils.DEG2RAD * this._fov0*0.5;  
            this._tbRadius = Math.tan(halfFov)*distance*0.66;

            this.makeGizmos(this._tbCenter, this._tbRadius);

            let aspect = camera.aspect;

            let radiusTop = Math.sqrt(Math.pow(Math.tan(halfFov)*camera.near, 2) + Math.pow(Math.tan(halfFov)*camera.near, 2));
            let radiusBottom = Math.sqrt(Math.pow(Math.tan(halfFov)*camera.far, 2) + Math.pow(Math.tan(halfFov)*camera.far, 2));
            let height = camera.far - camera.near;

            geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 4, 8, false, Math.PI*0.25);
            this.dummy = new THREE.Mesh(geometry, material);
            this.dummy.scale.set(aspect, 1, 1);
            this.dummy.rotateX(Math.PI*0.5);
            this.dummy.translateY(-camera.far*0.5);
            this.dummy.updateMatrix();
            this.dummy.matrixAutoUpdate = false;
        }


        //camera.add(dummy);

        const points = [];
        points.push(new THREE.Vector3(6, 0, 0));
        points.push(new THREE.Vector3(-4, 0, 0));

        const lineMaterialX = new THREE.LineBasicMaterial({color: 0x00FF00});
        const lineMaterialY = new THREE.LineBasicMaterial({color: 0xFF0000});
        const lineMaterialZ = new THREE.LineBasicMaterial({color: 0x0000FF});

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineX = new THREE.LineSegments(lineGeometry, lineMaterialX);
        const lineY = new THREE.LineSegments(lineGeometry, lineMaterialY);
        const lineZ = new THREE.LineSegments(lineGeometry, lineMaterialZ);

        lineY.rotation.z = Math.PI*0.5;
        lineZ.rotation.y = Math.PI*0.5;

        camera.add(lineX);
        camera.add(lineY);
        camera.add(lineZ);

        camera.add(this.dummy);

        camera.lookAt(this._tbCenter);
        camera.updateMatrix();

        //setting state
        this._cameraMatrixState0.copy(camera.matrix);
        this._cameraMatrixState.copy(this._cameraMatrixState0);
        this._cameraProjectionState.copy(camera.projectionMatrix);
        this._zoom0 = camera.zoom;
        this._zoomState = this._zoom0;

        this.dummy.matrixAutoUpdate = false;
        this._dummyMatrixState0 = this.dummy.matrix.clone();
        this._dummyMatrixState = this._dummyMatrixState0.clone();

        this.camera = camera;
    };

    /**
     * Creates the rotation gizmos with radius equals to the given trackball radius
     * @param {THREE.Vector3} tbCenter The trackball's center
     * @param {number} tbRadius The trackball radius
     */
    makeGizmos = (tbCenter, tbRadius) => {
        const gizmos = new THREE.Group();

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

        rotationGizmoX.rotation.x = Math.PI*0.5;
        rotationGizmoY.rotation.y = Math.PI*0.5;


        //setting state
        gizmos.matrix.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
        this._gizmoMatrixState0.copy(gizmos.matrix);
        this._gizmoMatrixState.copy(this._gizmoMatrixState);

        this._gizmos.clear();

        this._gizmos.add(rotationGizmoX);
        this._gizmos.add(rotationGizmoY);
        this._gizmos.add(rotationGizmoZ);
    };

    /**
     * Perform animation for detail operation
     * @param {Number} time Instant when this function is called as performance.now()
     */
    onDetailAnim = (time, hitP, cameraState, gizmoState) => {
        console.log("detailanim");
        if(this._timeStart == -1) {
            //animation start
            this._timeStart = time;
        }
        if(this._state == STATE.ANIMATION_DETAIL) {
            const deltaTime = time - this._timeStart;
            const animTime = deltaTime/this.detailAnimTime;

            this._gizmoMatrixState.copy(gizmoState);

            if(animTime >= 1) {
                //animation end
                //cameraState.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
                this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);

                this.detail(hitP, this.scaleFactor);

                this._timeStart = -1;
                this.updateTbState(STATE.IDLE, false);
                this._mouseDown = false;
                this.enlightGizmosR(false);
                window.cancelAnimationFrame(this._animationId);
                this.dispatchEvent(this._changeEvent); 
            }
            else {
                const amount = this.easeOutCubic(animTime);
                const s = ((1-amount)+(this.scaleFactor*amount));
  
                this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
                this.detail(hitP, s, amount);

                this.dispatchEvent(this._changeEvent);
                const self = this;
                this._animationId = window.requestAnimationFrame(function(t) {
                    self.onDetailAnim(t, hitP, cameraState, gizmoState.clone());
                });
            }
        }
        else {
            //interrupt animation
            this._timeStart = -1;
            this._mouseDown = false;
            window.cancelAnimationFrame(this._animationId);
        }
    };
    
    /**
     * Perform animation for rotation operation
     */
    onRotationAnim = (time, rotationAxis, w0) => {
        if(this._timeStart == -1) {
            //animation start
            this._angle0 = 0
            this._angle = 0;
            this._timeStart = time;
        }
        if(this._state == STATE.ANIMATION_ROTATE) {
            const deltaTime = (time - this._timeStart)/1000;
            this._angle0 = this._angle;
            this._angle = 0.5*this.acc*Math.pow(deltaTime, 2)+w0*deltaTime+0;
            if(this._angle >= this._angle0) {
                this.applyTransformMatrix(this.rotate(rotationAxis, this._angle));
                this.dispatchEvent(this._changeEvent);
                const self = this;
                this._animationId = window.requestAnimationFrame(function(t) {
                    self.onRotationAnim(t, rotationAxis, w0);
                });
            }
            else {
                this._timeStart = -1;
                this.updateTbState(STATE.IDLE, false);
                this.enlightGizmosR(false);

                window.cancelAnimationFrame(this._animationId);
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
            window.cancelAnimationFrame(this._animationId);
            this.dispatchEvent(this._changeEvent);
        }
    };
    
    /**
     * Perform pan operation moving camera between two points
     * @param {THREE.Vector3} p1 Initial point
     * @param {THREE.Vector3} p2 Ending point
     * @param {Boolean} adjust If movement should be adjusted considering camera zoom/distance
     * @returns {Object} Object with 'camera' and 'gizmo' fields containing transformation matrices resulting from the operation to be applied to the camera and gizmos
     */
    pan = (p1, p2, adjust = false) => {
        const distanceV = p1.clone().sub(p2);
        if(this.camera.type == 'OrthographicCamera') {
            distanceV.multiplyScalar(1/this.camera.zoom);
        }
        else if(this.camera.type == 'PerspectiveCamera' && adjust) {
            const initialCam = new THREE.Vector3().setFromMatrixPosition(this._cameraMatrixState0);
            const initialGizmo = new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState0);
            const deltaD = initialCam.distanceTo(initialGizmo)/this.camera.position.distanceTo(this._gizmos.position);
            distanceV.multiplyScalar(1/deltaD);
        }

        this._v3_1.set(distanceV.x, distanceV.y, 0).applyQuaternion(this.camera.quaternion);

        this._m4_1.makeTranslation(this._v3_1.x, this._v3_1.y,this. _v3_1.z);
       
        return {camera: this._m4_1.clone(), gizmo: this._m4_1.clone()};
    };

    /**
     * Reset trackball state
     */
    reset = () => {
        this.camera.zoom = this._zoom0;
    
        if(this.camera.type == 'PerspectiveCamera') {
            this.camera.fov = this._fov0;
        }

        this.camera.updateProjectionMatrix();
        this._cameraMatrixState.copy(this._cameraMatrixState0);
        this._cameraMatrixState.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
        this.camera.updateMatrix();

        this._gizmoMatrixState.copy(this._gizmoMatrixState0);
        this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
        this._gizmos.updateMatrix();

        this.updateTbState(STATE.IDLE, false);
        
        this.dummy.matrix.copy(this._dummyMatrixState0);
        this.dispatchEvent(this._changeEvent);   
    };

    /**
     * Rotate the camera around an axis passing by trackball's center
     * @param {THREE.Vector3} axis Rotation axis
     * @param {number} angle Angle in radians
     * @returns {Object} Object with 'camera' field containing transformation matrix resulting from the operation to be applied to the camera
     */
    rotate = (axis, angle) => {
        const point = this._gizmos.position;    //rotation point
        this._translateMatrix.makeTranslation(-point.x, -point.y, -point.z);
        this._rotateMatrix.makeRotationAxis(axis, -angle);

        //rotate camera
        this._m4_1.makeTranslation(point.x, point.y, point.z);
        this._m4_1.multiply(this._rotateMatrix);
        this._m4_1.multiply(this._translateMatrix);

        return {camera: this._m4_1.clone()};
    };

    /**
     * Perform uniform scale operation around a given point
     * @param {Number} size Scale factor
     * @param {THREE.Vector3} point Point around which scale 
     * @returns {Object} Object with 'camera' and 'gizmo' fields containing transformation matrices resulting from the operation to be applied to the camera and gizmos
     */
    scale = (size, point) => {
        const scalePoint = point.clone();
        const sizeInverse = 1/size;

        //draw debug point
        const geometry = new THREE.SphereGeometry(2);
        const material = new THREE.MeshBasicMaterial({color: 0x00FFFF});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(scalePoint)
        if(this.scalePointDebug == null) {
            this.scalePointDebug = mesh;
            this._scene.add(this.scalePointDebug);
        }
        else {
            this.scalePointDebug.copy(mesh);
        }
        
        if(this.camera.type == 'OrthographicCamera') {
            //camera zoom
            this.camera.zoom = this._zoomState;
            this.camera.zoom *= size;
            this.camera.updateProjectionMatrix();

            const pos0 = new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState0);
            const pos = new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState);
            pos0.sub(pos);

            //scale gizmos so they appear in the same spot having the same dimension
            this._scaleMatrix.makeScale(sizeInverse, sizeInverse, sizeInverse);
            this._translateMatrix.makeTranslation(pos0.x, pos0.y, pos0.z);

            this._m4_2.makeTranslation(-pos0.x, -pos0.y, -pos0.z);
            this._m4_2.multiply(this._scaleMatrix);
            this._m4_2.multiply(this._translateMatrix);


            //move camera and gizmos to obtain pinch effect
            scalePoint.sub(this._gizmos.position);

            const amount = scalePoint.clone().multiplyScalar(sizeInverse);
            scalePoint.sub(amount);

            this._m4_1.makeTranslation(scalePoint.x, scalePoint.y, scalePoint.z);
            this._m4_2.premultiply(this._m4_1);

            //scale dummy
            //const dist = this.camera.position.clone().add(this.dummy.position);
            const dist = this.dummy.position;

            this._scaleMatrix.makeScale(1/this.camera.zoom, 1/this.camera.zoom, 1);
            this._translateMatrix.makeTranslation(dist.x, dist.y, dist.z);
            let dummyMatrix = this._dummyMatrixState.clone().premultiply(this._scaleMatrix);
            this.dummy.matrix.copy(dummyMatrix);       

            return{camera: this._m4_1.clone(), gizmo: this._m4_2.clone()};
        }
        else if(this.camera.type == 'PerspectiveCamera') {
            const cameraPosition = new THREE.Vector3().setFromMatrixPosition(this._cameraMatrixState);
            const gizmosPosition = new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState);
            //move camera
            let distance = cameraPosition.distanceTo(scalePoint);
            let amount = distance - (distance*sizeInverse);
            let direction = scalePoint.clone().sub(cameraPosition).normalize().multiplyScalar(amount);

            //draw direction axis
            /*const p1 = scalePoint;
            const p2 = cameraPosition;
            //const p2 = this.camera.position.clone();

            const points = [p1, p2];

            const axisMaterial = new THREE.LineBasicMaterial({color: 0xFFFF00});
            const axisGeometry = new THREE.BufferGeometry().setFromPoints(points);
            if(this.zAxisDebug == null) {
                this.zAxisDebug = new THREE.LineSegments(axisGeometry, axisMaterial);
                this._scene.add(this.zAxisDebug);
            }
            else {
                this.zAxisDebug.copy(new THREE.LineSegments(axisGeometry, axisMaterial));
            }*/

            /*this._translateMatrix.makeTranslation(direction.x, direction.y, direction.z);
            this._m4_1.copy(this._cameraMatrixState).premultiply(this._translateMatrix);*/

            this._m4_1.makeTranslation(direction.x, direction.y, direction.z);

            //scale gizmos so they appear in the same spot having the same dimension
            const pos0 = new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState0);
            const pos = gizmosPosition;
            pos0.sub(pos);

            distance = pos.distanceTo(scalePoint);
            amount = distance - (distance*sizeInverse);
            direction = scalePoint.clone().sub(gizmosPosition).normalize().multiplyScalar(amount);

            this._m4_2.makeTranslation(direction.x, direction.y, direction.z);

            this._translateMatrix.makeTranslation(-pos0.x, -pos0.y, -pos0.z);
            this._scaleMatrix.makeScale(sizeInverse, sizeInverse, sizeInverse);
            this._m4_2.multiply(this._translateMatrix);
            this._m4_2.multiply(this._scaleMatrix);
            this._translateMatrix.makeTranslation(pos0.x, pos0.y, pos0.z);
            this._m4_2.multiply(this._translateMatrix);

            return{camera: this._m4_1.clone(), gizmo: this._m4_2.clone()};
        }
    };

    setFov = (value) => {
        if(this.camera.type == 'PerspectiveCamera') {
            if(value < 0) {
                value = 0;
            }
            this.camera.fov = value;
            this.camera.updateProjectionMatrix();

        }
    };

    /**
     * Rotate camera around its direction axis passing by a given point by a given angle
     * @param {THREE.Vector3} point The point where the rotation axis is passing trough
     * @param {Number} angle Angle in radians
     * @returns The computed transormation matix
     */
    zRotate = (point, angle) => {
        this._rotateMatrix.makeRotationAxis(this._rotationAxis, angle);
        this._translateMatrix.makeTranslation(-point.x, -point.y, -point.z);

        this._m4_1.makeTranslation(point.x, point.y, point.z);
        this._m4_1.multiply(this._rotateMatrix);
        this._m4_1.multiply(this._translateMatrix);


        //draw rotation axis
        const length = 100;
        const p1 = this._rotationAxis.clone().multiplyScalar(length);
        const p2 = this._rotationAxis.clone().multiplyScalar(-length);
        const points = [p1, p2];
        const axisMaterial = new THREE.LineBasicMaterial({color: 0xFFFF00});
        const axisGeometry = new THREE.BufferGeometry().setFromPoints(points);
        if(this.zAxisDebug == null) {
            this.zAxisDebug = new THREE.LineSegments(axisGeometry, axisMaterial);
            this.zAxisDebug.position.copy(point);
            this._scene.add(this.zAxisDebug);
        }
        else {
            this.zAxisDebug.copy(new THREE.LineSegments(axisGeometry, axisMaterial));
            this.zAxisDebug.position.copy(point);
        }

        return{camera: this._m4_1.clone(), gizmo: this._m4_1.clone()};
    };
    

    /**
     * Unproject the cursor on the 3D object surface
     * @param {THREE.Vector2} cursor Cursor coordinates in NDC
     * @param {THREE.Camera} camera Virtual camera
     * @returns {THREE.Vector3} The point of intersection with the model, if exist, null otherwise
     */
    unprojectOnObj = (cursor, camera) => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(cursor, camera);

        let obj;
        for(let i=0; i<this._scene.children.length; i++)
        {
            if(this._scene.children[i].type == 'Group' && this._scene.children[i].uuid != this._gizmos.uuid) {
                obj = this._scene.children[i];
                break;
            }
        }
        const intersect = raycaster.intersectObject(obj, true);
        if(intersect.length == 0) {
            console.log('null');
            return  null;
        }
        else {
            return new THREE.Vector3().copy(intersect[0].point);
        }
    };

    /**
     * Unproject the cursor on the trackball surface
     * @param {THREE.Camera} camera The virtual camera
     * @param {Number} x Cursor horizontal coordinate on screen
     * @param {Number} y Cursor vertical coordinate on screen
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @param {number} tbRadius The trackball radius
     * @returns {THREE.Vector3} The unprojected point on the trackball surface
     */
    unprojectOnTbSurface = (camera, x, y, canvas, tbRadius) => {
        if(camera.type == 'OrthographicCamera') {
            this._v2_1.copy(this.getCursorPosition(x, y, canvas));
            this._v3_1.set(this._v2_1.x, this._v2_1.y, 0);
            //this._v3_1.setX(this._v2_1.x);
            //this._v3_1.setY(this._v2_1.y);
            let x2 = Math.pow(this._v2_1.x, 2);
            let y2 = Math.pow(this._v2_1.y, 2);
            let r2 = Math.pow(this._tbRadius, 2);

            if(x2+y2 <= r2*0.5) {
                //intersection with sphere
                this._v3_1.setZ(Math.sqrt(r2-(x2+y2)));
            }
            else {
                //intersection with hyperboloid
                this._v3_1.setZ((r2*0.5)/(Math.sqrt(x2+y2)));
            }
            return this._v3_1;
        }
        else if(camera.type == 'PerspectiveCamera') {
            this._v2_1.copy(this.getCursorNDC(x, y, canvas));
            const nearPlanePoint = new THREE.Vector3(this._v2_1.x, this._v2_1.y, -1);

            //unproject curson on the near plane in camera space
            nearPlanePoint.applyMatrix4(camera.projectionMatrixInverse);

            const rDir = nearPlanePoint.clone().normalize();
            const hitPoint = new THREE.Vector2();   //intersesction point between the unprojected ray and the trackball surface
            const distance = camera.position.distanceTo(this._gizmos.position);
            const radius2 = Math.pow(tbRadius, 2);
        
            //for intersection with trackball's surface, consider 2D axes (X', Y') instead of 3D (X, Y, Z)
            //Y' = Z
            //X' = asse lungo cui si sviluppa la distanza dal centro della trackball al punto sulla sfera su Z=0        
            const h = nearPlanePoint.z;
            const l = Math.sqrt(Math.pow(nearPlanePoint.x, 2) + Math.pow(nearPlanePoint.y, 2));

            const m = h/l;
            const q = distance;
        

            /*
             *|y = mx + q
             *|x^2 + y^2 = r^2
             *
             * (m^2 + 1")x^2 + (2mq)x + q^2 + r^2 = 0
             */
            let a = Math.pow(m, 2)+1;
            let b = 2*m*q;
            let c = Math.pow(q, 2)-radius2;
            let delta = Math.pow(b, 2)-(4*a*c);
        
            if(delta >= 0) {
                //intersection with sphere
                hitPoint.setX((-b-Math.sqrt(delta))/(2*a));
                hitPoint.setY(m*hitPoint.x+q);

                //let angle = hitPoint.angle()*180/Math.PI;
                let angle = THREE.MathUtils.RAD2DEG * hitPoint.angle();

                if(angle >= 45) {
                    //if angle between intersection point and X' axis is >= 45°, return that point
                    //otherwise, calculate intersection point with hyperboloid
            
                    let d = Math.sqrt(Math.pow(hitPoint.x, 2) + Math.pow((distance - hitPoint.y), 2));
                    rDir.multiplyScalar(d);
                    rDir.z += distance;
                    return rDir;
                }
            }
            //intersection with hyperboloid
            a = m;
            b = q;
            c = -radius2*0.5;
            delta = Math.pow(b, 2)-(4*a*c);
            hitPoint.setX((-b-Math.sqrt(delta))/(2*a));
            hitPoint.setY(m*hitPoint.x+q);

            let d = Math.sqrt(Math.pow(hitPoint.x, 2) + Math.pow((distance - hitPoint.y), 2));

            rDir.multiplyScalar(d);
            rDir.z += distance;
            return rDir;
        }
    };


    /**
     * Unproject the cursor on the plane passing through the center of the trackball orthogonal to the camera
     * @param {THREE.Camera} camera The virtual camera
     * @param {Number} x Cursor horizontal coordinate on screen
     * @param {Number} y Cursor vertical coordinate on screen
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @returns {THREE.Vector3} The unprojected point on the trackball plane
     */
    unprojectOnTbPlane = (camera, x, y, canvas, useInitial = false) => {
        if(camera.type == 'OrthographicCamera') {
            this._v2_1.copy(this.getCursorPosition(x, y, canvas));
            this._v3_1.set(this._v2_1.x, this._v2_1.y, 0);

            return this._v3_1;
        }
        else if(camera.type == 'PerspectiveCamera') {
            this._v2_1.copy(this.getCursorNDC(x, y, canvas));

            //unproject cursor on the near plane in camera space
            this._v3_1.set(this._v2_1.x, this._v2_1.y, -1);
            this._v3_1.applyMatrix4(camera.projectionMatrixInverse);

            const rDir = this._v3_1.clone().normalize();    //direction vector

            const h = this._v3_1.z;
            const l = Math.sqrt(Math.pow(this._v3_1.x, 2) + Math.pow(this._v3_1.y, 2));
            let distance;
            if(useInitial) {
                //distance = new THREE.Vector3().setFromMatrixPosition(this._cameraMatrixState0).distanceTo(new THREE.Vector3().setFromMatrixPosition(this._gizmoMatrixState0));
                distance = this._v3_1.setFromMatrixPosition(this._cameraMatrixState0).distanceTo(this._v3_2.setFromMatrixPosition(this._gizmoMatrixState0));
            }
            else {
                distance = camera.position.distanceTo(this._gizmos.position);
            }

            /*
             *|y = mx + q
             *|y = 0
             *
             * x = -q/m
            */
            const m = h/l;
            const q = distance;
            const X = -q/m;

            const d = Math.sqrt(Math.pow(q, 2) + Math.pow(X, 2));
            rDir.multiplyScalar(d);
            //rDir.z = distance;
            rDir.z = 0;
            return rDir;
            //return r0.add(rDir.multiplyScalar(d));
        }
    };

    /**
     * Update camera and gizmos state
     */
    updateMatrixState = () => {
        //update camera and gizmos state
        this._cameraMatrixState.copy(this.camera.matrix);
        this._gizmoMatrixState.copy(this._gizmos.matrix);

        if(this.camera.type == 'OrthographicCamera') {
            this._cameraProjectionState.copy(this.camera.projectionMatrix);
            this.camera.updateProjectionMatrix();
            this._zoomState = this.camera.zoom;
        }
        else if(this.camera.type == 'PerspectiveCamera') {
            //update tb radius
            const distance = this.camera.position.distanceTo(this._gizmos.position);
            const fov = THREE.MathUtils.DEG2RAD * this.camera.fov;

            this._tbRadius = Math.tan(fov*0.5)*distance*0.66;
        }

        this._notchCounter = 0;
        //this._quatState.copy(this._gizmos.quaternion);
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
const renderer = new THREE.WebGLRenderer({canvas: canvas});

//scene
const scene = new THREE.Scene();

//camera
let camera = makeOrthographicCamera(renderer.domElement);
camera.position.z = 20;
scene.add(camera);

//light
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
camera.add(light);
light.position.set(0, 0, 0);


//debug
let debugControl; 

const canvasDebug = document.getElementById("canvasDebug");
const rendererDebug = new THREE.WebGLRenderer({canvas: canvasDebug});
let cameraDebug = makePerspectiveCamera(rendererDebug.domElement);
cameraDebug.far = 2000;

cameraDebug.updateProjectionMatrix();
cameraDebug.position.z = 120;
scene.add(cameraDebug);
const lightDebug = new THREE.DirectionalLight(lightColor, lightIntensity);
cameraDebug.add(lightDebug);
lightDebug.position.set(0, 0, 0);


const loader = new GLTFLoader();
loader.load('./popcorn_bucket.glb', onLoad);

resizeRenderer(renderer);
resizeRenderer(rendererDebug);

let arcball;

const cameraBtn = document.getElementById("cameraButton");
const resetBtn = document.getElementById("resetButton");
const animCheck = document.getElementById("animationCheckbox");
const gridCheck = document.getElementById("gridCheckbox");
const scaleSlider = document.getElementById("scaleSlider");
const accSlider = document.getElementById("accSlider");
const angularSlider = document.getElementById("angularSlider");


cameraBtn.innerHTML= "Toggle Perspective";
cameraBtn.addEventListener('click', function btnListener() {
const light = new THREE.DirectionalLight(lightColor, lightIntensity);

    if(camera.type == 'PerspectiveCamera') {
        scene.remove(camera);
        camera = makeOrthographicCamera(renderer.domElement);
        camera.position.z = 20;
        camera.updateMatrix();
        camera.add(light);
        scene.add(camera);
        cameraBtn.innerHTML = 'Toggle Perspective';
        arcball.setCamera(camera);
    }
    else if(camera.type == 'OrthographicCamera') {
        scene.remove(camera);
        camera = makePerspectiveCamera(renderer.domElement);
        camera.position.z = 20;
        camera.updateMatrix();
        camera.add(light);
        scene.add(camera);
        cameraBtn.innerHTML = 'Toggle Orthographic';
        arcball.setCamera(camera);
    }
    renderer.render(scene, camera);
});
resetBtn.addEventListener('click', function() {
    arcball.reset();
});
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
    arcball.enableGrid = gridCheck.checked;
});

window.addEventListener('resize', function windowResizeListener(){
    resizeRenderer(renderer);
    render();
});


/**
 * Set renderer size to correctly match the size of the canvas where renderer is drawing into
 * @param {THREE.WebGlRenderer} renderer The renderer
 */
function resizeRenderer(renderer) {
    const canvas = renderer.domElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    renderer.setPixelRatio(canvasWidth/canvasHeight);
    if(canvas.width != canvasWidth || canvas.height != canvasHeight) {
        renderer.setSize(canvasWidth, canvasHeight, false);
    }
};


function onLoad(o) {
    obj = o.scene;
    const bb = new THREE.Box3().setFromObject(obj);
    const bbCenter = new THREE.Vector3();
    bb.getCenter(bbCenter);
    const bbSize = new THREE.Vector3();
    bb.getSize(bbSize);
    const bbMax = Math.max(bbSize.x, bbSize.y, bbSize.z);


    let viewMin;
    if(camera.type == 'OrthographicCamera') {
        viewMin = Math.min(camera.top, camera.right)*0.66;
    }
    else if(camera.type == 'PerspectiveCamera') {
        viewMin = Math.tan(fov*0.5)*distance*0.66;
    }

    const scale = (viewMin/bbMax)*2;
    obj.scale.set(scale, scale, scale);
    obj.position.sub(bbCenter);


    scene.add(obj);

    arcball = new Arcball(camera, renderer.domElement);
    arcball.addEventListener('change', function() {
        render();
    });

    //debug
    debugControl = new OrbitControls(cameraDebug, rendererDebug.domElement);
    debugControl.addEventListener('change', function() {
        rendererDebug.render(scene, cameraDebug);
    });
    render();
};


function makeOrthographicCamera(canvas) {
    const halfW = 16;//canvasRect.width/60;
    const halfH = 8;//canvasRect.height/60;
    const near = 0.1;   //standard value
    const far = 80;   //standard value
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
    return camera
};

function makePerspectiveCamera(canvas) {
    const fov = 45;
    const aspect = canvas.clientWidth/canvas.clientHeight;
    const near = 0.1;
    const far = 80;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    return camera;
};


function render() {
    renderer.render(scene, camera);
    rendererDebug.render(scene, cameraDebug);
};

