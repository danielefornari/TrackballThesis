import * as THREE from 'https://unpkg.com/three/build/three.module.js';

//import * as THREE from 'three';

const canvas = document.getElementById("myCanvas");
const rotationAxisParagraph = document.getElementById("rotationAxisParagraph");
const cursor1Paragraph = document.getElementById("cursor1Paragraph");
const cursor2Paragraph = document.getElementById("cursor2Paragraph");
canvas.addEventListener('mouseup', mouseUpListener);
canvas.addEventListener('mousedown', mouseDownListener);
canvas.addEventListener('mousemove', mouseMoveListener);

const renderer = new THREE.WebGLRenderer({canvas}); //instanzio il renderer dicendo che lo voglio nel canvas che gli passo

let tracking = false;   //indica se sto eseguendo il tracking del cursore del mouse
let timeStart = Date.now();

//struttura dati che mantiene le coordinate correnti e precedenti del cursore
let cursorData = {
    current: {
        x:0,
        y:0,
        z:0,
        toVector3: function() {
            return new THREE.Vector3(this.x, this.y, this.z);
        }
    },
    prev: {
        x:0,
        y:0,
        z:0,
        toVector3: function() {
            return new THREE.Vector3(this.x, this.y, this.z);
        }
    },
    updateCursorPositions: function(x, y, canvas) {
        this.prev.x = this.current.x;
        this.prev.y = this.current.y;
        this.prev.z = this.current.z;

        let cursorWorldPosition = this.toWorldPosition(x, y, canvas);
        this.current.x = cursorWorldPosition.x;
        this.current.y = -cursorWorldPosition.y;
        this.current.z = cursorWorldPosition.z;
    },
    toWorldPosition: function(x, y) {
        let canvasRect = canvas.getBoundingClientRect();
        let worldPosition = new THREE.Vector2();

        //coordinate x/y del cursore rispetto al canvas con valori tra [-1, 1]
        worldPosition.x = ((x-canvasRect.left)/canvasRect.width)*2-1;
        worldPosition.y = ((y-canvasRect.top)/canvasRect.height)*2-1;
        
        //let intersect = rayscaster.intersectObjects(scene.children);
        //alert(intersect.point);
        //worldPosition.unproject(camera);
        worldPosition.z = unprojectZ(worldPosition.x, worldPosition.y);
        return worldPosition;
    }
};


//camera
let cameraOptions = {
    fov: 75,
    aspect: 2,
    near: 0.1,
    far: 5
};

const fov = 75;
const aspect = 2;
const near = 0.1
const far = 5;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

camera.position.z = 2;

//scene
const scene = new THREE.Scene();

//luce
const lightColor = 0xFFFFFF;
const lightIntensity = 1;
const light = new THREE.DirectionalLight(lightColor, lightIntensity);
light.position.set(-1, 2, 4);
scene.add(light);

//il cubo
//geometry
const boxWidth = 1;
const boxHeight = 1;
const boxDepth = 1;
const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//material
//const boxMaterial = new THREE.MeshBasicMaterial({color: 0x44aa88});   //non è affetto dalle luci
const boxMaterial = new THREE.MeshPhongMaterial({color: 0x44aa88});

//mesh
const cube = new THREE.Mesh(boxGeometry, boxMaterial);

scene.add(cube);

function resizeRenderer() {
    const canvas = renderer.domElement;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    if(canvas.width != canvasWidth || canvas.height != canvasHeight)
    {
        renderer.setSize(canvasWidth, canvasHeight, false);
    }
};

resizeRenderer();
renderer.render(scene, camera);

//listeners
function mouseUpListener() {
    tracking = false;
};

function mouseDownListener(event) {
    cursorData.updateCursorPositions(event.clientX, event.clientY, canvas);
    timeStart = Date.now();
    tracking = true;
};

function mouseMoveListener(event) {
    let currentTime = Date.now();
    if(tracking && currentTime - timeStart >= 33) {
        cursorData.updateCursorPositions(event.clientX, event.clientY, canvas);
        let rotationAxis = calculateRotationAxis(cursorData);
        let v1 = cursorData.prev.toVector3();
        let v2 = cursorData.current.toVector3();
        timeStart = currentTime;
        rotationAxisParagraph.innerHTML = "Rotation Axis: "+rotationAxis.x+", "+rotationAxis.y+", "+rotationAxis.z;
        cursor1Paragraph.innerHTML = "Vector1: "+v1.x+ ", "+v1.y+", "+v1.z;
        cursor2Paragraph.innerHTML = "Vector2: "+v2.x+", "+v2.y+", "+v2.z;
        rotateObj(cube, rotationAxis, 0.1);
    }
};


function calculateRotationAxis(cursorData) {
    let rotationAxis = new THREE.Vector3();
    rotationAxis.crossVectors(cursorData.prev.toVector3(), cursorData.current.toVector3());
    return rotationAxis.normalize();
};

function getObjCoord(obj) {
    return obj.getWorldPosition();
};

function rotateObj(obj, axis, degrees) {
    cube.rotateOnWorldAxis(axis, degrees);
    resizeRenderer();
    renderer.render(scene, camera);
};

function unprojectZ(x, y) {
    let radius = 1;
    let x2 = Math.pow(x, 2);
    let y2 = Math.pow(y, 2);
    let radius2 = Math.pow(radius, 2)
    if(x2+y2 <= radius2/2) {
        return Math.sqrt(radius2-(x2+y2));
    }
    else {
        return (radius2/2)/Math.sqrt(x2+y2);
    }
};


function keyDownListener(event) {
    const rotationSpeed = 2;
    switch (event.key) {
        case "ArrowUp":
            cube.rotateX(-rotationSpeed)
            break;

        case "ArrowDown":
            cube.rotateX(rotationSpeed);
            break;

        case "ArrowLeft":
            cube.rotateY(-rotationSpeed);
            break;

        case "ArrowRight":
            cube.rotateY(rotationSpeed);
            break;
   
        default:
            alert("default");
            break;
    }
    resizeRenderer();
    renderer.render(scene, camera);
};

window.addEventListener('keydown', keyDownListener);