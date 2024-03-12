import * as THREE from 'three';
import { gsap } from "gsap";
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CameraUtils from 'three/addons/utils/CameraUtils.js';
import colorsea from 'colorsea'

//Needed hack for pivot points
THREE.Object3D.prototype.updateMatrix = function () {

  this.matrix.compose( this.position, this.quaternion, this.scale );

  if ( this.pivot && this.pivot.isVector3 ) {

    var px = this.pivot.x;
    var py = this.pivot.y;
    var pz = this.pivot.z;

    var te = this.matrix.elements;

    te[ 12 ] += px - te[ 0 ] * px - te[ 4 ] * py - te[ 8 ] * pz;
    te[ 13 ] += py - te[ 1 ] * px - te[ 5 ] * py - te[ 9 ] * pz;
    te[ 14 ] += pz - te[ 2 ] * px - te[ 6 ] * py - te[ 10 ] * pz;

  }

  this.matrixWorldNeedsUpdate = true;

};

//colors
const PRIMARY_COLOR_A = '#37b89e';
let c = colorsea(PRIMARY_COLOR_A, 100).darken(15);
const PRIMARY_COLOR_B = c.hex();
c = colorsea(PRIMARY_COLOR_A, 100).darken(5);
const PRIMARY_COLOR_C = c.hex();
const SECONDARY_COLOR_A = '#ce166f';

const loader = new FontLoader();
const gltfLoader = new GLTFLoader();
export const stencilRefs = [];//For assigning a unique stencil ref to each clipped material

export const DEFAULT_FONT = 'fonts/Generic_Techno_Regular.json';
let DEFAULT_TEXT_PROPS = textProperties( DEFAULT_FONT, 0.02, 0.1, 0.1, 0.1, 0.05, 0.05, 1);
loader.load(DEFAULT_TEXT_PROPS.font, (font) => {
  DEFAULT_TEXT_PROPS.font = font;
});

export function CamControlProperties(autoRotate=true, minPolarAngle=0, maxPolarAngle=Math.PI, enableZoom=true, minDistance=0, maxDistance=Infinity, enableDamping=true, camControls=undefined){
  return {
    'type': 'CAM_CTRL_PROPS',
    'autoRotate': autoRotate,
    'minPolarAngle': minPolarAngle,
    'maxPolarAngle': maxPolarAngle,
    'enableZoom': enableZoom,
    'minDistance': minDistance,
    'maxDistance': maxDistance,
    'enableDamping': enableDamping,
    'camControls': camControls
  }
};

export function MainSceneProperties(scene=undefined, mouse=undefined, camera=undefined, renderer=undefined, raycaster=undefined, raycastLayer=0, camControlProps=CamControlProperties()){
  return {
    'type': 'MAIN_SCENE_PROPS',
    'scene': scene,
    'mouse': mouse,
    'camera': camera,
    'renderer': renderer,
    'raycaster': raycaster,
    'raycastLayer': raycastLayer,
    'camControlProps': camControlProps
  }
};

/**
 * This function creates a new scene, sets up lighting,
 * handles scene interactions and updates.
 * @param {object} gltf loaded gltf object.
 * 
 * @returns {object} Heavymeta scene class object.
 */
export class HVYM_Scene {
  constructor(sceneProps) {
    this.is = 'HVYM_SCENE';
    this.scene = sceneProps.scene;
    this.utils = new HVYM_Utils();
    this.anims = new HVYM_Animation(this);
    this.raycaster = sceneProps.raycaster;
    this.draggable = [];
    this.mouseOverable = [];
    this.clickable = [];
    this.inputPrompts = [];
    this.inputText = [];
    this.selectorElems = [];
    this.toggles = [];
    this.stencilRefs = [];//For assigning a unique stencil ref to each clipped material
    this.gltfModels = [];

    //Interaction variables
    this.mouseDown = false;
    this.isDragging = false;
    this.lastDragged = undefined;
    this.previousMouseX = 0;
    this.previousMouseY = 0;
    this.moveDir = 1;
    this.dragDistX = 0;
    this.dragDistY = 0;
    this.lastClick = 0;
    this.mouseOver = [];

    this.ambientLight = new THREE.AmbientLight(0x404040);
    this.ambientLight.name = 'MAIN_AMBIENT_LIGHT'
    sceneProps.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.name = 'MAIN_DIRECTIONAL_LIGHT'
    this.directionalLight.position.set(1, 1, 1);
    sceneProps.scene.add(this.directionalLight);
  }
  createMainSceneControls(mainSceneProps){
    this.camCtrls = new OrbitControls(mainSceneProps.camera, mainSceneProps.renderer.domElement);
    this.camCtrls.update(); // This is important to initialize the controls
  }
  getStencilRef(){
    let ref = this.stencilRefs.length+1;
    this.stencilRefs.push(ref);

    return this.stencilRefs[stencilRefs.length-1]
  }
  toggleSceneCtrls(state){
    if(!this.camCtrls)
      return;

    this.camCtrls.enabled = state;
  }
  mouseDownHandler(){
    this.mouseDown = true;
    this.isDragging = true;
    this.previousMouseX = event.clientX;
    this.previousMouseY = event.clientY;

    const intersectsDraggable = this.raycaster.intersectObjects(this.draggable);
    const intersectsClickable = this.raycaster.intersectObjects(this.clickable);
    const intersectsToggle = this.raycaster.intersectObjects(this.toggles);

    if ( intersectsDraggable.length > 0 ) {
      console.log('intersects draggable')
      this.lastDragged = intersectsDraggable[0].object;
    }

    if ( intersectsClickable.length > 0 ) {
      console.log("Clickable")
      let obj = intersectsClickable[0].object;
      obj.dispatchEvent({type:'action'});

      if(!this.clickable.includes(obj))
        return;

      this.anims.clickAnimation(obj);

    }

    if ( intersectsToggle.length > 0 ) {
      let obj = intersectsToggle[0].object;
      obj.dispatchEvent({type:'action'});
    }
  }
  mouseUpHandler(){
    this.mouseDown = false;
    this.isDragging = false;
    this.lastDragged = undefined;
    this.toggleSceneCtrls(true);
  }
  mouseMoveHandler(event){
    const intersectsMouseOverable = this.raycaster.intersectObjects(this.mouseOverable);
    const intersectsselectorElems = this.raycaster.intersectObjects(this.selectorElems);
    let canMouseOver = true;

    if(intersectsMouseOverable.length > 0){

      let elem = intersectsMouseOverable[0].object;

      if(elem.userData.mouseOverParent != undefined){
        canMouseOver = false;
      }

      if(!this.mouseOver.includes(elem) && canMouseOver){
        elem.userData.mouseOver = true;
        this.mouseOver.push(elem);
        this.anims.mouseOverAnimation(elem);
      }

    }else if(intersectsselectorElems.length > 0){

      let e = intersectsselectorElems[0].object;
      // console.log("elem")
      if(e.parent.userData.selectors != undefined && !e.parent.userData.open){
        this.anims.selectorAnimation(e.parent);
      }

    }else{

      this.mouseOver.forEach((elem, idx) => {
        if(elem.userData.mouseOver && canMouseOver){
          elem.userData.mouseOver = false;
          this.anims.mouseOverAnimation(elem);
          this.mouseOver.splice(this.mouseOver.indexOf(elem));
        }
      });

      this.selectorElems.forEach((elem, idx) => {
        if(elem.parent.userData.selectors != undefined && elem.parent.userData.open){
          this.anims.selectorAnimation(elem.parent, 'CLOSE');
        }
      });
    }

    if (this.lastDragged != undefined && this.lastDragged.userData.draggable && this.mouseDown && this.isDragging) {
      const deltaX = event.clientX - this.previousMouseX;
      const deltaY = event.clientY - this.previousMouseY;
      const dragPosition = this.lastDragged.position.clone();
      this.toggleSceneCtrls(false);
      if(!this.lastDragged.userData.horizontal){
        this.dragDistY = deltaY;

        if(deltaY<0){
          this.moveDir=1
        }else{
          this.moveDir=-1;
        }
        // Limit scrolling
        dragPosition.y = Math.max(this.lastDragged.userData.minScroll, Math.min(this.lastDragged.userData.maxScroll, dragPosition.y - deltaY * 0.01));
        this.lastDragged.position.copy(dragPosition);
        this.previousMouseY = event.clientY;
        this.lastDragged.dispatchEvent({type:'action'});
      }else{
        this.dragDistX = deltaX;

        if(deltaX<0){
          this.moveDir=1
        }else{
          this.moveDir=-1;
        }

        // Limit scrolling
        dragPosition.x = Math.max(this.lastDragged.userData.minScroll, Math.min(this.lastDragged.userData.maxScroll, dragPosition.x + deltaX * 0.01));
        this.lastDragged.position.copy(dragPosition);
        this.previousMouseX = event.clientX;
        this.lastDragged.dispatchEvent({type:'action'});
      }
      
    }

  }
  doubleClickHandler(){
    this.raycaster.layers.set(0);
    const intersectsInputPrompt = this.raycaster.intersectObjects(this.inputPrompts);

    if(intersectsInputPrompt.length > 0){

      let textMesh = intersectsInputPrompt[0].object;
      let userData = textMesh.userData;
      const textProps = textMesh.userData.textProps;

      // Initialize variables for typing
      let currentText = textProps.cBox.box.userData.currentText;
      let boxSize = getGeometrySize(textProps.cBox.box.geometry);
      let pos = new THREE.Vector3().copy(textMesh.position);
      let padding = textProps.padding;

      if(!textProps.draggable){
        this.inputPrompts.push(textMesh);
        this.mouseOverable.push(textMesh);
        this.clickable.push(textMesh);
      }

      let yPosition = this._inputTextYPosition(event, textMesh, boxSize, padding);

      // Listen for keyboard input
      window.addEventListener('keydown', (event) => {

          if (event.key === 'Enter') {;
            this._onEnterKey(event, textMesh, currentText, boxSize, padding);
          } else if (event.key === 'Backspace') {
              // Handle backspace
              currentText = currentText.slice(0, -1);
              this._onHandleTypingText(event, textMesh, currentText, boxSize, padding);
          } else if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Capslock') {

          } else if (event.key === 'ArrowDown' ) {

          } else if (event.key === 'ArrowUp' ) {

          } else {
            if(event.shiftKey || event.capslock){
              currentText += event.key.toUpperCase();
            }else{
              currentText += event.key;
            }
            this._onHandleTypingText(event, textMesh, currentText, boxSize, padding);

          }
          this._onHandleTextGeometry(textMesh, currentText, boxSize);
        });
      }
  }
  Update(delta){
    this.gltfModels.forEach((model, idx) => {
      model.UpdateAnimation(delta);
    });
  }
  _onEnterKey(event, textMesh, currentText, boxSize, padding){
    textMesh.dispatchEvent({type:'onEnter'});

    if(textMesh.widget == undefined){
      if(textMesh.userData.textProps.draggable){
        this.draggable.push(textMesh);
      }
    }
  }
  _onHandleTextGeometry(textMesh, currentText, boxSize){
    if(textMesh.widget != undefined)//widgets update their own text geometry
      return;

    let textProps = textMesh.userData.textProps;
    if(currentText.length > 0){
      textMesh.userData.currentText = currentText;
      textMesh.dispatchEvent({type:'update'});
    }
  }
  _onHandleTypingText(event, textMesh, currentText, boxSize, padding){
    if(textMesh.widget == undefined){
      textMesh.userData.textProps.cBox.box.userData.currentText = currentText;
    }else{

      if(!isNaN(currentText)){
        textMesh.widget.box.userData.currentText = currentText;
        textMesh.widget.SetValueText(currentText);
      }
    } 
  }
}

export class HVYM_Utils {
  constructor() {

  }
  /**
   * This function creates a random number between a minumum and maximum value.
   * @param {number} min minumum number in range.
   * @param {number} max maximum number in range.
   * 
   * @returns {number} random number.
   * 
   */
  randomNumber(min, max) {
    return Math.random() * (max - min) + min;
  }
  /**
   * This function returns a range number between 2 numbers.
   * @param {number} from the starting number for the range.
   * @param {number} to ending number in range.
   * @param {number} step the increment number in range.
   * 
   * @returns {number} random number.
   * 
   */
  * range(from, to, step = 1) {
    let value = from;
    while (value <= to) {
      yield value;
      value += step;
    }
  }
}


/**
 * This function creates a new property set for animation.
 * @param {string} [anim='FADE'] this is a localized constant to the function.
 * @param {string} [anim='IN'] this is a localized constant for fading animation in or out.
 * @param {number} [duration=0.07] the duration of the animation.
 * @param {string} [easeIn='power1.inOut'] easing in constant for animation.
 * @param {number} [delay=0.007] the delay before animation plays.
 * @param {number} [delayIdx=0] this is a delay multiplier, which acts to stagger animations played consecutively.
 * 
 * @returns {null} No return.
 * 
 */
export function animationProperties(anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, onComplete=undefined){
  return {
    'type': 'ANIMATION_PROPS',
    'anim': anim,
    'action': action,
    'duration': duration,
    'ease': ease,
    'delay': delay,
    'onComplete': onComplete
  }
};

/**
 * This function creates a new property set for information.
 * @param {string} title this is a title for a given element.
 * @param {string} author this is an author for a given element.
 * 
 * @returns {null} No return.
 * 
 */
export function infoProperties(title, author){
  return {
    'type': 'INFO_PROPS',
    'title': title,
    'author': author
  }
};

export class HVYM_Animation {
  constructor(hvymScene) {
    this.is = 'HVYM_SCENE';
    this.scene = hvymScene;
    this.posVar = new THREE.Vector3();
    this.scaleVar = new THREE.Vector3();
  }
  /**
   * This function animates text elements.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [anim='FADE'] this is a localized constant to the function.
   * @param {string} [anim='IN'] this is a localized constant for fading animation in or out.
   * @param {number} [duration=0.07] the duration of the animation.
   * @param {string} [easeIn='power1.inOut'] easing in constant for animation.
   * @param {number} [delay=0.007] the delay before animation plays.
   * @param {number} [delayIdx=0] this is a delay multiplier, which acts to stagger animations played consecutively.
   * 
   * @returns {null} No return.
   * 
   */
  txtAnimation(box, txt, anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, delayIdx=0, onComplete=undefined){
    const top = box.userData.height/2+10;
    const bottom = top-box.userData.height-10;
    const right = box.userData.width;
    const left = -box.userData.width;
    let props = {};

    switch (anim) {
        case 'FADE':
          let opacityTarget = 1;
          if(action == 'OUT'){
            opacityTarget = 0;
          }else{
            txt.material.opacity=0;
          }
          props = {duration: duration, opacity: opacityTarget, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }
          gsap.to(txt.material, props).delay(delay*delayIdx);
          break;
        case 'SCALE':
          if(action == 'OUT'){
            this.scaleVar.set(0,0,0);
          }else{
            this.scaleVar.copy(txt.scale);
            txt.scale.set(0,0,0);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.scaleVar.x, y: this.scaleVar.y, z: this.scaleVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }
          gsap.to(txt.scale, props).delay(delay*delayIdx);
          break;
        case 'SLIDE_DOWN':
          if(txt.position.y>bottom){
            if(action == 'OUT'){
              this.posVar.set(txt.position.x, top, txt.position.z);
              txt.material.opacity=1;
            }else{
              this.posVar.copy(txt.position);
              txt.position.set(txt.position.x, top, txt.position.z);
              txt.material.opacity=1;
            }
            props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
            if(onComplete != undefined){
              props.onComplete = onComplete;
            }

            gsap.to(txt.position, props).delay(delay*delayIdx);
          }
          break;
        case 'SLIDE_UP':
          if(action == 'OUT'){
            this.posVar.set(txt.position.x, bottom, txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(txt.position.x, bottom, txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

            gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        case 'SLIDE_RIGHT':
          if(action == 'OUT'){
              this.posVar.set(right, txt.position.y, txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(right, txt.position.y, txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

            gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        case 'SLIDE_LEFT':
          if(action == 'OUT'){
            this.posVar.set(left, txt.position.y, txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(left, txt.position.y, txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

          gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        case 'UNSCRAMBLE0':
          if(action == 'OUT'){
            this.posVar.set(txt.position.x+this.scene.utils.randomNumber(-0.1, 0.1), txt.position.y+this.scene.utils.randomNumber(-0.1, 0.1), txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(txt.position.x+this.scene.utils.randomNumber(-0.1, 0.1), txt.position.y+this.scene.utils.randomNumber(-0.1, 0.1), txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

          gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        case 'UNSCRAMBLE1':
          if(action == 'OUT'){
            this.posVar.set(txt.position.x+this.scene.utils.randomNumber(-1, 1), txt.position.y+this.scene.utils.randomNumber(-1, 1), txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(txt.position.x+this.scene.utils.randomNumber(-1, 1), txt.position.y+this.scene.utils.randomNumber(-1, 1), txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

          gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        case 'UNSCRAMBLE2':
          if(action == 'OUT'){
            this.posVar.set(txt.position.x+this.scene.utils.randomNumber(-2, 2), txt.position.y+this.scene.utils.randomNumber(-2, 2), txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(txt.position.x+this.scene.utils.randomNumber(-2, 2), txt.position.y+this.scene.utils.randomNumber(-2, 2), txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: ease };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

          gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        case 'SPIRAL':
          if(action == 'OUT'){
              this.posVar.set(right, top, txt.position.z);
          }else{
            this.posVar.copy(txt.position);
            txt.position.set(right, top, txt.position.z);
            txt.material.opacity=1;
          }
          props = {duration: duration, x: this.posVar.x, y: this.posVar.y, z: this.posVar.z, ease: 'cubic-bezier(0.55,0.055,0.675,0.19)' };
          if(onComplete != undefined){
            props.onComplete = onComplete;
          }

          gsap.to(txt.position, props).delay(delay*delayIdx);
          break;
        default:
          console.log("");
      }
  }
  /**
   * This function animates multi text elements.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [anim='FADE'] this is a localized constant to the function.
   * @param {string} [easeIn='power1.in'] easing in constant for animation.
   * @param {string} [easeIn='elastic.Out'] easing out constant for animation.
   * 
   * @returns {null} No return.
   * 
   */
  multiAnimation(box, txtArr, anim='FADE', action='IN', duration=0.07, ease="power1.inOut", delay=0.007, onComplete=undefined){
    let delayIdx=0;
    const top = box.userData.height/2+5;
    const bottom = top-box.userData.height-5;

    txtArr.forEach((txt, i) => {
      if(txt.position.y>bottom){
        this.txtAnimation(box, txt, anim, action, duration, ease, delay, delayIdx, onComplete);
        delayIdx+=1;
      }
    });

  }
  /**
   * This function animates an element for mouseover.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [anim='SCALE'] this is a localized constant to the function.
   * @param {string} [easeIn='power1.in'] easing in constant for animation.
   * @param {string} [easeIn='elastic.Out'] easing out constant for animation.
   * 
   * @returns {null} No return.
   * 
   */
  mouseOverAnimation(elem, anim='SCALE', duration=0.5, ease="power1.inOut", delay=0){

    let doAnim = false;

    if(elem==undefined)
      return;

    if(elem.userData.hoverAnim != undefined && elem.userData.hoverAnim.isActive())
      return;

    if(elem.userData.mouseOver && (elem.scale.x == elem.userData.defaultScale.x && elem.scale.y == elem.userData.defaultScale.z)){
      this.scaleVar.set(elem.userData.defaultScale.x*1.1,elem.userData.defaultScale.y*1.1,elem.userData.defaultScale.z);
      elem.userData.mouseOverActive = true;
      doAnim=true;
    }else if (!elem.userData.mouseOver && elem.userData.mouseOverActive && (elem.scale.x != elem.userData.defaultScale.x || elem.scale.y != elem.userData.defaultScale.z)){
      elem.userData.mouseOverActive = false;
      this.scaleVar.copy(elem.userData.defaultScale);
      doAnim=true;
    }

    if(doAnim){
      let props = { duration: duration, x: this.scaleVar.x, y: this.scaleVar.y, z: this.scaleVar.z, ease: ease };
      elem.userData.hoverAnim = gsap.to(elem.scale, props);
    }

  }
  /**
   * This function animates selector elements.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [anim='OPEN'] this is a localized constant to the function.
   * @param {string} [duration=0.1] the duration of the animation.
   * @param {string} [easeIn='power1.in'] easing in constant for animation.
   * @param {string} [easeIn='elastic.Out'] easing out constant for animation.
   * 
   * @returns {null} No return.
   * 
   */
  selectorAnimation(elem, anim='OPEN', duration=0.15, easeIn="power1.in", easeOut="elastic.Out"){
      let yPositions = [];
      let zPositions = [];
      let scales = [];
      let selected = undefined;

      elem.userData.selectors.forEach((c, idx) => {
        let size = getGeometrySize(c.geometry);
        let parentSize = getGeometrySize(c.parent.geometry);
        let yPos = size.height*idx;
        let zPos = c.userData.unselectedPos.z;
        let sel = c.children[0].userData.selected;
        c.material.renderOrder = 1;
        if(sel){
          selected = idx;
          scales.push(c.userData.selectedScale);
        }else{
          scales.push(c.userData.unselectedScale);
        }
        
        if(anim=='CLOSE'){
          yPos=0;
          if(sel){
            zPos = c.userData.selectedPos.z;
            c.material.renderOrder = 2;
          }
        }
        yPositions.push(-yPos);
        zPositions.push(zPos);
        if(idx>0){
          yPositions.push(yPos);
        }
      });

      elem.userData.open = true;
      let portalScale = 1*(elem.userData.selectors.length+1);
      if(anim=='CLOSE'){
        elem.userData.open = false;
        portalScale = 1;
      }

      if(anim=='OPEN' || anim=='CLOSE'){
        for (let i = 0; i < elem.userData.selectors.length; i++) {
          let current = elem.userData.selectors[i];
          let props = { duration: duration, x: current.position.x, y: yPositions[i], z: zPositions[i], ease: easeIn };
          gsap.to(current.position, props);
          props = { duration: duration, x: scales[i], y: scales[i], z: scales[i], ease: easeIn};
          gsap.to(current.scale, props);
        }

        if(elem.userData.hoverZPos!=undefined){
          let props = {duration: duration, x: elem.position.x, y: elem.position.y, z: elem.userData.defaultZPos}
          if(elem.userData.open){
            props = {duration: duration, x: elem.position.x, y: elem.position.y, z:elem.userData.hoverZPos};
          }
          gsap.to(elem.position, props);
        }

        if(elem.userData.properties.isPortal){
          let props = { duration: duration, 0: 0, ease: easeIn };
          if(elem.userData.open){
            props = { duration: duration, 0: 1, ease: easeIn };
          }
          gsap.to(elem.morphTargetInfluences, props);
        }
      }

      if(anim=='SELECT'){
        
        let current = elem.userData.selectors[selected];
        let currentY = current.position.y;
        let last = current.parent.userData.lastSelected;
        let props = { duration: duration, x: current.position.x, y: current.userData.selectedPos.y, z: current.userData.selectedPos.z, ease: easeIn };
        gsap.to(current.position, props);
        props = { duration: duration, x: current.userData.selectedScale, y: current.userData.selectedScale, z: current.userData.selectedScale, ease: easeIn };
        gsap.to(current.scale, props);

        if(last != undefined){
          props = { duration: duration, x: last.position.x, y: currentY, z: zPositions[selected], ease: easeIn };
          gsap.to(last.position, props);
          props = { duration: duration, x: last.userData.unselectedScale, y: last.userData.unselectedScale, z: last.userData.unselectedScale, ease: easeIn };
          gsap.to(last.scale, props);
        }
      }

  }
  /**
   * This function animates a toggle element.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [duration=0.15] the duration of the animation.
   * @param {string} [easeIn='power1.in'] easing in constant for animation.
   * @param {string} [easeIn='elastic.Out'] easing out constant for animation.
   * 
   * @returns {null} No return.
   * 
   */
  toggleAnimation(elem, duration=0.15, easeIn="power1.in", easeOut="elastic.Out"){

    if(elem.handle.userData.anim != false && gsap.isTweening( elem.handle.userData.anim ))
    return;

    let pos = elem.handle.userData.onPos;

    if(elem.handle.userData.on){
      pos=elem.handle.userData.offPos;
    }

    let props = { duration: duration, x: pos.x, y: elem.handle.position.y, z: elem.handle.position.z, ease: easeIn, onComplete: ToggleWidget.DoToggle, onCompleteParams:[elem] };

    if(!elem.handle.userData.horizontal){
      props = { duration: duration, x: elem.handle.position.x, y: pos.y, z: elem.handle.position.z, ease: easeIn, onComplete: ToggleWidget.DoToggle, onCompleteParams:[elem] };
    }

    elem.handle.userData.anim = gsap.to(elem.handle.position, props);

  }
  /**
   * This function animates panel elements.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [anim='OPEN'] this is a localized constant to the function.
   * @param {string} [duration=0.1] the duration of the animation.
   * @param {string} [easeIn='power1.in'] easing in constant for animation.
   * @param {string} [easeIn='elastic.Out'] easing out constant for animation.
   * 
   * @returns {null} No return.
   * 
   */
  panelAnimation(elem, anim='OPEN', duration=0.1, easeIn="power1.in", easeOut="elastic.Out"){
    function panelAnimComplete(elem, props){
      gsap.to(elem.scale, props);
    }

    function panelExpandComplete(elem){
      if(elem.userData.properties.expanded)
        return;
      elem.dispatchEvent({type:'hideWidgets'});
    }

    function handleRotate(handle, props){
      gsap.to(handle.rotation, props);
    }

    if(anim == 'OPEN'){
      let onScale = elem.userData.onScale;
      let offScale = elem.userData.offScale;

      if(!elem.userData.properties.open){

        let rot = elem.userData.handleOpen.userData.onRotation;
        let props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
        handleRotate(elem.userData.handleOpen, props);

        let yprops = { duration: duration, x: onScale.x, y: onScale.y, z: onScale.z, ease: easeOut };
        let xprops = { duration: duration, x: onScale.x, y: offScale.y, z: onScale.z, ease: easeOut, onComplete: panelAnimComplete, onCompleteParams:[elem, yprops] };
        
        gsap.to(elem.scale, xprops);

      }else if(elem.userData.properties.open){

        let rot = elem.userData.handleOpen.userData.offRotation;
        let props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
        handleRotate(elem.userData.handleOpen, props);

        let xprops = { duration: duration, x: offScale.x, y: offScale.y, z: offScale.z, ease: easeOut};
        let yprops = { duration: duration, x: onScale.x, y: offScale.y, z: onScale.z, ease: easeOut, onComplete: panelAnimComplete, onCompleteParams:[elem, xprops] };
        
        gsap.to(elem.scale, yprops);

      }

      elem.userData.properties.open = !elem.userData.properties.open;
    }

    if(anim == 'EXPAND'){
      
      let expanded = elem.userData.properties.expanded;
      let bottom = elem.userData.bottom;
      let topHeight = elem.userData.size.height;
      let bottomHeight = bottom.userData.size.height;
      let elemHeight = topHeight+bottomHeight;
      let yPos = -bottomHeight/2;
      let sectionsLength = elem.userData.sectionElements.length;
      let bottomYPos = -((bottomHeight/2+elemHeight * sectionsLength) + bottomHeight);
      let thisIndex = elem.userData.index;
      let parentBottom = elem.parent.userData.bottom;
      let props = {};

      if(elem.userData.sectionsValueTypes == 'container'){
        //Move sub elements to correct positions
        for (const obj of elem.userData.sectionElements) {
          if(expanded){
            let pos = obj.userData.expandedPos;
            props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
            gsap.to(obj.position, props);
            //expand handle
            props = { duration: duration, x: 1, y: 1, z: 1, ease: easeOut };
            gsap.to(obj.userData.handleExpand.scale, props);
          }else if(!expanded){
            let pos = obj.userData.closedPos;
            props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
            gsap.to(obj.position, props);
            //contract handle
            props = { duration: duration, x: 0, y: 0, z: 0, ease: easeOut };
            gsap.to(obj.userData.handleExpand.scale, props);
          }
        }
      } else if(elem.userData.sectionsValueTypes == 'controls'){
        sectionsLength = elem.userData.widgetElements.length;
        let widgetHeight = elem.userData.widgetHeight;
        bottomYPos = -((bottomHeight/2+widgetHeight * sectionsLength) + bottomHeight);

        for (const obj of elem.userData.widgetElements) {
          if(expanded){
            let pos = obj.userData.expandedPos;
            props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
            gsap.to(obj.position, props);
          }else if(!expanded){
            let pos = obj.userData.closedPos;
            props = { duration: duration, x: pos.x, y: pos.y, z: pos.z, ease: easeOut };
            gsap.to(obj.position, props);
          }
        }
      }

      //Do animation for expand handle and move down bottom element of main container
      if(expanded){
        let rot = elem.userData.handleExpand.userData.onRotation;
        props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
        handleRotate(elem.userData.handleExpand, props);
        let pos = bottom.userData.expandedPos;
        props = { duration: duration, x: pos.x, y: bottomYPos, z: pos.z, ease: easeOut };
        gsap.to(bottom.position, props);
      }else if(!expanded){
        let rot = elem.userData.handleExpand.userData.offRotation;
        props = { duration: duration, x: rot.x, y: rot.y, z: rot.z, ease: easeOut };
        handleRotate(elem.userData.handleExpand, props);
        let pos = bottom.userData.closedPos;
        bottomYPos = pos.y;
        props = { duration: duration, x: pos.x, y: bottomYPos, z: pos.z, ease: easeOut };
        gsap.to(bottom.position, props); 
      }

      //if a sub panel is opened, we need to manage positions of other sub panels and base panel elements
      if(elem.userData.properties.isSubPanel){
        let subPanelBottom = undefined;
        let startIdx = elem.userData.index+1;
        let parentSectionsLength = elem.parent.userData.sectionElements.length;
        let YPos = elem.position.y;
        
        if(expanded){
          if(elem.userData.index==parentSectionsLength){
            //YPos -= elem.userData.expandedHeight-parentBottom.userData.height-parentBottom.userData.height;
          }else{
            for (const i of this.scene.utils.range(startIdx, parentSectionsLength)) {
              let idx = i-1;
              let el = elem.parent.userData.sectionElements[idx];
              let prev = elem.parent.userData.sectionElements[idx-1];
              let pos = el.position;
              let Y = prev.userData.expandedHeight;
              
              if(idx>startIdx-1){
                if(!prev.userData.properties.expanded){
                  Y = prev.userData.closedHeight;
                }
              }
              YPos -= Y;
              props = { duration: duration, x: pos.x, y: YPos, z: pos.z, ease: easeOut };
              gsap.to(el.position, props);
              if(i==parentSectionsLength){
                subPanelBottom = el.userData.bottom;
              }
            }
          }
          
        }else if(!expanded){
          if(elem.userData.index==parentSectionsLength){;
            //YPos -= elem.userData.closedHeight-parentBottom.userData.height-parentBottom.userData.height;
          }else{
            for (const i of this.scene.utils.range(startIdx, parentSectionsLength)) {
              let idx = i-1;
              let el = elem.parent.userData.sectionElements[idx];
              let prev = elem.parent.userData.sectionElements[idx-1];
              let pos = el.position;
              let Y = prev.userData.closedHeight;
              
              if(idx>startIdx-1){
                if(prev.userData.properties.expanded){
                  Y = prev.userData.expandedHeight;
                }
              }
              YPos -= Y;
              props = { duration: duration, x: pos.x, y: YPos, z: pos.z, ease: easeOut };
              gsap.to(el.position, props);
              if(i==parentSectionsLength){
                subPanelBottom = el.userData.bottom;
              }
            }      
          }

        }

        //calculate bottom based on child bottom position
        let lastElem = elem.parent.userData.sectionElements[parentSectionsLength-1];

        if(!lastElem.userData.properties.expanded){
          YPos -= lastElem.userData.closedHeight-parentBottom.userData.height/2;
        }else{
          YPos -= lastElem.userData.expandedHeight-parentBottom.userData.height/2;
        }

        //Adjust the bottom for parent container again
        props = { duration: duration, x: parentBottom.position.x, y: YPos, z: parentBottom.position.z, ease: easeOut, onComplete: panelExpandComplete, onCompleteParams:[elem]};
        gsap.to(parentBottom.position, props);

      }

      //textMesh.widget.base.userData.valueBox.dispatchEvent({type:'update'});

    }

  }
  /**
   * This function creates a click animation on passed element.
   * @param {object} elem the Object3D to be animated.
   * @param {string} [anim='SCALE'] this is a localized constant to the function.
   * @param {string} [duration=0.15] the duration of the animation.
   * @param {string} [easeIn='power1.in'] easing in constant for animation.
   * @param {string} [easeIn='elastic.Out'] easing out constant for animation.
   * 
   * @returns {null} No return.
   * 
   */
  clickAnimation(elem, anim='SCALE', duration=0.15, easeIn="power1.in", easeOut="elastic.Out"){
    const self = this;
    this.scaleVar.set(elem.userData.defaultScale.x*0.9,elem.userData.defaultScale.y*0.9,elem.userData.defaultScale.z);
    let props = { duration: duration, x: this.scaleVar.x, y: this.scaleVar.y, z: this.scaleVar.z, ease: easeIn, transformOrigin: '50% 50%' };
    props.onComplete = function(e){
      self.scaleVar.copy(elem.userData.defaultScale);
      let props = { duration: duration, x: self.scaleVar.x, y: self.scaleVar.y, z: self.scaleVar.z, ease: easeOut, transformOrigin: '50% 50%' };
      gsap.to(elem.scale, props);
    }
    gsap.to(elem.scale, props);
  }
}

/**
 * This function an object with width, height, and depth based on passed geometry.
 * @param {object} geometry the geometry of an Object3D.
 * 
 * @returns {object} an object with geometry size dimensions.
 * 
 */
export function getGeometrySize(geometry) {
  const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  return { width, height, depth };
};

/**
 * This function creates a new text mesh property set, property of text geometry.
 * useCase='SIMPLE','STENCIL','STENCIL_CHILD'
 * @param {number} [curveSegments=12] the mesh curve segments.
 * @param {bool} [bevelEnabled=false] if true, text has an edge bevel.
 * @param {number} [bevelThickness=0.1] thickness of bevel.
 * @param {number} [bevelSize=0.1] size of bevel.
 * @param {number} [bevelOffset=0] offset of bevel.
 * @param {number} [bevelSegments=3] number of segments in bevel.
 * 
 * @returns {object} Data (materialRefProperties).
 * 
 */
export function textMeshProperties(curveSegments=12, bevelEnabled=false, bevelThickness=0.1, bevelSize=0.1, bevelOffset=0, bevelSegments=3){
  return {
    'type': 'TEXT_MESH_PROPS',
    'curveSegments': curveSegments,
    'bevelEnabled': bevelEnabled,
    'bevelThickness': bevelThickness,
    'bevelSize': bevelSize,
    'bevelOffset': bevelOffset,
    'bevelSegments': bevelSegments,
  }
};

//default widget text mesh properties
const W_CURVE_SEGMENTS = 12;
const W_BEVEL_ENABLED = false;
const W_BEVEL_THICKNESS = 0.1;
const W_BEVEL_SIZE = 0.1;
const W_BEVEL_OFFSET = 0;
const W_BEVEL_SEGMENTS = 3;

/**
 * This function returns default (textMeshProperties) for widgets.
 */
export function defaultWidgetTextMeshProperties(){
  return textMeshProperties(W_CURVE_SEGMENTS, W_BEVEL_ENABLED, W_BEVEL_THICKNESS, W_BEVEL_SIZE, W_BEVEL_OFFSET, W_BEVEL_SEGMENTS)
}

//default value text mesh properties
const VT_CURVE_SEGMENTS = 12;
const VT_BEVEL_ENABLED = false;
const VT_BEVEL_THICKNESS = 0.1;
const VT_BEVEL_SIZE = 0.1;
const VT_BEVEL_OFFSET = 0;
const VT_BEVEL_SEGMENTS = 3;

/**
 * This function returns default (textMeshProperties).
 */
export function defaultValueTextMeshProperties(){
  return textMeshProperties(VT_CURVE_SEGMENTS, VT_BEVEL_ENABLED, VT_BEVEL_THICKNESS, VT_BEVEL_SIZE, VT_BEVEL_OFFSET, VT_BEVEL_SEGMENTS)
}


//MATERIAL CREATION

/**
 * This function returns material string constant based on passed material.
 * @param {object} material the three js material to clone.
 * 
 * @returns {string} string constant for material type.
 * 
 */
export function materialTypeConstant(material){
  let result = undefined;

  switch (material.type) {
    case 'MeshBasicMaterial':
      result = 'BASIC';
      break;
    case 'MeshLambertMaterial':
      result = 'LAMBERT';
      break;
    case 'MeshPhongMaterial':
      result = 'PHONG';
      break;
    case 'MeshStandardMaterial':
      result = 'STANDARD';
      break;
    case 'MeshPhysicalMaterial':
      result = 'PBR';
      break;
    case 'MeshToonMaterial':
      result = 'TOON';
      break;
    default:
      console.log('X');
  }

  return result
};

/**
 * This function creates a new material reference prperty set based on passed material and target property.
 * useCase='SIMPLE','STENCIL','STENCIL_CHILD'
 * @param {string} [type='BASIC'] the type of material.
 * @param {string} [color='white'] the color of the material.
 * @param {bool} [transparent=false] if true, material has transparent property enabled.
 * @param {number} [opacity=1] the opacity value for the material.
 * @param {object} [side=THREE.FrontSide] the side of the mesh that gets rendered.
 * @param {string} [useCase='SIMPLE'] used to set stencil rendering.
 * @param {bool} [emissive=false] if true, material made emissive.
 * @param {bool} [reflective=false] if true, material made reflective.
 * @param {bool} [iridescent=false] if true, material made iridescent.
 * 
 * @returns {object} Data (materialRefProperties).
 * 
 */
export function materialProperties(type='BASIC', color='white', transparent=false, opacity=1, side=THREE.FrontSide, useCase='SIMPLE', emissive=false, reflective=false, iridescent=false){
  return {
    'type': type,
    'color': color,
    'transparent': transparent,
    'opacity': opacity,
    'side': side,
    'useCase': useCase,
    'emissive': emissive,
    'reflective': reflective,
    'iridescent':iridescent
  }
};

/**
 * This function creates a new material reference prperty set based on passed material and target property.
 * @param {string} [matType='PHONG'] the type of material.
 * @param {object} [ref=undefined] the reference to the material.
 * @param {string} [targetProp='animation'] target propert of mesh.
 * @param {bool} [useMaterialView=false] if true view for material preview is created.
 * @param {bool} [isHVYM=false] identifier for mesh that has heavymeta data.
 * @param {object} [hvymCtrl=undefined] (HVYM_Data) class object.
 * 
 * @returns {object} Data (materialRefProperties).
 * 
 */
export function materialRefProperties(matType='PHONG', ref=undefined, targetProp='color', valueProps=numberValueProperties( 0, 0, 1, 3, 0.001, false), useMaterialView=false, isHVYM=false, hvymCtrl=undefined){
  return {
    'type': 'MAT_REF',
    'matType': matType,
    'ref': ref,
    'targetProp': targetProp,
    'valueProps': valueProps,
    'useMaterialView': useMaterialView,
    'isHVYM': isHVYM,
    'hvymCtrl': hvymCtrl
  }
};

/**
 * This function creates a new material reference prperty set based on passed material and target property.
 * used to set up control over a specific material property.
 * @param {object} material the three js material to base propert set on.
 * @param {string} prop the target property on the material.
 * @param {bool} [useMaterialView=false] if true, widget will use an indicator for the material.
 * 
 * @returns {object} (materialRefProperties).
 * 
 */
export function materialRefPropertiesFromMaterial(material, prop, useMaterialView=false){
  let matType = materialTypeConstant(material);
  let valProp = materialNumberValueProperties(material, prop);

  return materialRefProperties(matType, material, prop, valProp, useMaterialView);
}

/**
 * This function creates a new material based on another copying all the first level properties.
 * @param {object} material the three js material to clone.
 * 
 * @returns {object} new three js material.
 * 
 */
export function shallowCloneMaterial(material){
  const matType = materialTypeConstant(material);
  let clonedMat = getBaseMaterial('#'+material.color.getHexString(), matType);
  Object.keys(material).forEach((prop, idx) => {
    if(BaseWidget.IsMaterialSliderProp(prop) || BaseWidget.IsMaterialColorProp(prop)){
      clonedMat[prop] = material[prop];
    }
  });

  return clonedMat
}

/**
 * This function creates a new material porperty set for phong material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function basicMatProperties(color='white'){
  return materialProperties('BASIC', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

/**
 * This function creates a new material porperty set for phong stencil material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function basicStencilMatProperties(color='white'){
  return materialProperties('BASIC', color, false, 1, THREE.FrontSide, 'STENCIL');
};

/**
 * This function creates a new material porperty set for basic stencil child material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function basicStencilChildMatProperties(color='white'){
  return materialProperties('BASIC', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

/**
 * This function creates a new material porperty set for phong material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function phongMatProperties(color='white'){
  return materialProperties('PHONG', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

/**
 * This function creates a new material porperty set for phong stencil material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function phongStencilMatProperties(color='white'){
  return materialProperties('PHONG', color, false, 1, THREE.FrontSide, 'STENCIL');
};

/**
 * This function creates a new material porperty set for phong stencil child material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function phongStencilChildMatProperties(color='white'){
  return materialProperties('PHONG', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

/**
 * This function creates a new material porperty set for lambert material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function lambertMatProperties(color='white'){
  return materialProperties('LAMBERT', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

/**
 * This function creates a new material porperty set for lambert stencil material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function lambertStencilMatProperties(color='white'){
  return materialProperties('LAMBERT', color, false, 1, THREE.FrontSide, 'STENCIL');
};

/**
 * This function creates a new material porperty set for lambert stencil child material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function lambertStencilChildMatProperties(color='white'){
  return materialProperties('LAMBERT', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

/**
 * This function creates a new material porperty set for standard material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function standardMatProperties(color='white'){
  return materialProperties('STANDARD', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

/**
 * This function creates a new material porperty set for standard stencil material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function standardMatStencilProperties(color='white'){
  return materialProperties('STANDARD', color, false, 1, THREE.FrontSide, 'STENCIL');
};

/**
 * This function creates a new material porperty set for standard stencil child material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function standardMatStencilChildProperties(color='white'){
  return materialProperties('STANDARD', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

/**
 * This function creates a new material porperty set for pbr material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function pbrMatProperties(color='white'){
  return materialProperties('PBR', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

/**
 * This function creates a new material porperty set for pbr stencil material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function pbrMatStencilProperties(color='white'){
  return materialProperties('PBR', color, false, 1, THREE.FrontSide, 'STENCIL');
};

/**
 * This function creates a new material porperty set for pbr stencil child material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function pbrMatStencilChildProperties(color='white'){
  return materialProperties('PBR', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

/**
 * This function creates a new material porperty set for toon material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function toonMatProperties(color='white'){
  return materialProperties('TOON', color, false, 1, THREE.FrontSide, 'SIMPLE');
};

/**
 * This function creates a new material porperty set for toon stencil material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function toonMatStencilProperties(color='white'){
  return materialProperties('TOON', color, false, 1, THREE.FrontSide, 'STENCIL');
};

/**
 * This function creates a new material porperty set for toon stencil child material.
 * @param {string} [color='white'] the color of the material.
 * 
 * @returns {object} (materialProperties).
 * 
 */
export function toonMatStencilChildProperties(color='white'){
  return materialProperties('TOON', color, false, 1, THREE.FrontSide, 'STENCIL_CHILD');
};

/**
 * This function creates a new material based on passed properties.
 * material type constants: 'BASIC', 'PHONG', 'LAMBERT', 'STANDARD', 'PBR', 'TOON'
 * @param {string} [color='white'] (materialProperties) properties of material used on box.
 * @param {string} [type='BASIC'] the material constant type.
 * @param {object} [side=THREE.FrontSide] the side of the mesh that gets rendered.
 * 
 * @returns {object} new three js material.
 * 
 */
export function getBaseMaterial(color='white', type='BASIC', side=THREE.FrontSide){
  let mat = undefined;
  switch (type) {
    case 'BASIC':
      mat = new THREE.MeshBasicMaterial({ color: color, side: side });
      break;
      
    case 'PHONG':
      mat = new THREE.MeshPhongMaterial({ color: color, side: side });
      break;

    case 'LAMBERT':
      mat = new THREE.MeshLambertMaterial({ color: color, side: side });
      break;

    case 'STANDARD':
      mat = new THREE.MeshStandardMaterial({ color: color, side: side });
      break;

    case 'PBR':
      mat = new THREE.MeshPhysicalMaterial({ color: color, side: side });
      break;

    case 'TOON':
      mat = new THREE.MeshToonMaterial({ color: color, side: side });
      break;

    default:
      mat = new THREE.MeshBasicMaterial({ color: color, side: side });
  }

  return mat
};

/**
 * This function creates and stores a new stencil reference.
 * 
 * @returns {int} new stencil integer.
 * 
 */
export function getStencilRef(){
  let ref = stencilRefs.length+1;
  stencilRefs.push(ref);

  return stencilRefs[stencilRefs.length-1]
}

/**
 * This function creates a new transparent material.
 * @param {object} matProps (materialProperties) properties of material used on box.
 * @param {number} [stencilRef=0] the stencil ref to be used.
 * 
 * @returns {object} new three js material.
 * 
 */
export function getMaterial(matProps, stencilRef=0){
  const mat = getBaseMaterial(matProps.color, matProps.type, matProps.side);
  mat.transparent = matProps.transparent;
  mat.opacity = matProps.opacity;

  if(matProps.useCase == 'STENCIL'){
    setupStencilMaterial(mat, getStencilRef());
  }else if(matProps.useCase == 'STENCIL_CHILD'){
    setupStencilChildMaterial(mat, stencilRef);
  }

  return mat
};

/**
 * This function creates a new transparent material.
 * 
 * @returns {object} new three js material.
 * 
 */
export function transparentMaterial(){
  const mat = new THREE.MeshBasicMaterial();
  mat.transparent = true;
  mat.opacity = 0;

  return mat
};

/**
 * This function sets up material to render another inside of it.
 * @param {object} material the material to be darkened.
 * @param {number} stencilRef the stencil reference to be set on the material.
 * 
 * @returns {null} no return.
 * 
 */
export function setupStencilMaterial(mat, stencilRef){
  mat.depthWrite = false;
  mat.stencilWrite = true;
  mat.stencilRef = stencilRef;
  mat.stencilFunc = THREE.AlwaysStencilFunc;
  mat.stencilZPass = THREE.ReplaceStencilOp;
};

/**
 * This function sets up material to be rendered inside another, no depth sorting.
 * @param {object} material the material to be darkened.
 * @param {number} stencilRef the stencil reference to be set on the material.
 * 
 * @returns {null} no return.
 * 
 */
export function setupStencilChildMaterial(mat, stencilRef){
  mat.depthWrite = false;
  mat.stencilWrite = true;
  mat.stencilTest = true;
  mat.stencilRef = stencilRef;
  mat.stencilFunc = THREE.EqualStencilFunc;
};

/**
 * This function sets up material to be rendered inside another with depth sorting.
 * @param {object} material the material to be darkened.
 * @param {number} stencilRef the stencil reference to be set on the material.
 * 
 * @returns {null} no return.
 * 
 */
export function setupStencilChildDepthMaterial(mat, stencilRef){
  mat.depthWrite = true;
  mat.stencilWrite = true;
  mat.stencilTest = true;
  mat.stencilRef = stencilRef;
  mat.stencilFunc = THREE.EqualStencilFunc;
};

/**
 * This function creates a new material based on passed property set, assigns a new stencil ref.
 * @param {object} matProps (materialProperties) property set.
 * 
 * @returns {object} new three js material.
 * 
 */
export function stencilMaterial(matProps){
  let stencilRef = getStencilRef();
  return getMaterial(matProps, stencilRef);
};

/**
 * This function darkens passed material color by passed value.
 * @param {object} material the material to be darkened.
 * @param {number} value the amount the material color value should be lightened.
 * @param {number} [alpha=100] the alpha value of the material.
 * 
 * @returns {null} no return.
 * 
 */
export function darkenMaterial(material, value, alpha=100){
  let c = colorsea('#'+material.color.getHexString(), alpha).darken(value);
  material.color.set(c.hex());
}

/**
 * This function lightens passed material color by passed value.
 * @param {object} material the material to be lightened.
 * @param {number} value the amount the material color value should be lightened.
 * @param {number} [alpha=100] the alpha value of the material.
 * 
 * @returns {null} no return.
 * 
 */
export function lightenMaterial(material, value, alpha=100){
  let c = colorsea('#'+material.color.getHexString(), alpha).lighten(value);
  material.color.set(c.hex());
}

/**
 * This function creates vector 3 position for the center of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function centerPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(parentSize.width-parentSize.width, parentSize.height-parentSize.height, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the left top center of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function topCenterPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(parentSize.width-parentSize.width, (parentSize.height/2)-childSize.height/2-padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the top center outside of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function topCenterOutsidePos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(parentSize.width-parentSize.width, (parentSize.height/2)+childSize.height/2+padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the bottom center of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function bottomCenterPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(parentSize.width-parentSize.width, -(parentSize.height/2)+childSize.height/2+padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the bottom center outside of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function bottomCenterOutsidePos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(parentSize.width-parentSize.width, -(parentSize.height/2)-childSize.height/2-padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the right center of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function rightCenterPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3((parentSize.width/2)-childSize.width/2-padding, parentSize.height-parentSize.height, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the right top corner of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function rightTopCornerPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3((parentSize.width/2)-childSize.width/2-padding, (parentSize.height/2)-childSize.height/2-padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the left bottom corner of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function rightBottomCornerPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3((parentSize.width/2)-childSize.width/2-padding, -(parentSize.height/2)+childSize.height/2+padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the left center of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function leftCenterPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(-(parentSize.width/2)+childSize.width/2+padding, parentSize.height-parentSize.height, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the left top corner of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function leftTopCornerPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(-(parentSize.width/2)+childSize.width/2+padding, (parentSize.height/2)-childSize.height/2-padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates vector 3 position for the left bottom corner of the parent.
 * @param {number} parentSize size of parent object.
 * @param {number} childSize size of child object.
 * @param {number} [zPosDir=1] if 1, object aligned in front of parent, else behind parent.
 * @param {object} [padding=0.025] extra padding on size of object.
 * 
 * @returns {object} Data THREE.Vector3.
 * 
 */
export function leftBottomCornerPos(parentSize, childSize, zPosDir=1, padding=0.025){
  return new THREE.Vector3(-(parentSize.width/2)+childSize.width/2+padding, -(parentSize.height/2)+childSize.height/2+padding, (parentSize.depth/2+childSize.depth/2)*zPosDir);
}

/**
 * This function creates a property set for animation reference.
 * loop constants: 'loopOnce', 'loopRepeat', 'pingPong', 'clamp'
 * @param {number} start animation start time.
 * @param {number} end animation end time.
 * @param {string} [loop='loopRepeat'] how the animations loop.
 * @param {object} [ref=undefined] reference for the animation object in imported model.
 * @param {object} [valueProps=stringValueProperties] property set for value type of widget.
 * @param {string} [targetProp='animation'] target propert of mesh.
 * @param {bool} [useMaterialView=false] if true view for material preview is created.
 * @param {bool} [isHVYM=false] identifier for mesh that has heavymeta data.
 * @param {object} [hvymCtrl=undefined] (HVYM_Data) class object.
 * 
 * @returns {object} Data animRefProperties.
 * 
 */
export function animRefProperties( start, end, loop='loopRepeat', ref=undefined, valueProps=stringValueProperties(), targetProp='animation', useMaterialView=false, isHVYM=false, hvymCtrl=undefined){
  return {
    'type': 'ANIM_REF',
    'start': start,
    'end': end,
    'loop': loop,
    'ref': ref,
    'valueProps': valueProps,
    'targetProp': targetProp,
    'useMaterialView': useMaterialView,
    'isHVYM': isHVYM,
    'hvymCtrl': hvymCtrl
  }
};

/**
 * This function creates a property set for mesh reference.
 * @param {bool} [isGroup=false] if three js mesh consists of multiple meshes.
 * @param {object} [ref=undefined] Object3D mesh reference.
 * @param {object} [valueProps=stringValueProperties] property set for value type of widget.
 * @param {string} [targetProp='visibility'] target propert of mesh.
 * @param {bool} [useMaterialView=false] if true view for material preview is created.
 * @param {object} [targetMorph=undefined] if defined morph.
 * @param {bool} [isHVYM=false] identifier for mesh that has heavymeta data.
 * @param {object} [hvymCtrl=undefined] (HVYM_Data) class object.
 * 
 * @returns {object} Data meshRefProperties.
 * 
 */
export function meshRefProperties(isGroup=false, ref=undefined, valueProps=stringValueProperties(), targetProp='visbility', useMaterialView=false, targetMorph=undefined, isHVYM=false, hvymCtrl=undefined){
  return {
    'type': 'MESH_REF',
    'isGroup': isGroup,
    'ref': ref,
    'valueProps': valueProps,
    'targetProp': targetProp,
    'useMaterialView': useMaterialView,
    'targetMorph': targetMorph,
    'isHVYM': isHVYM,
    'hvymCtrl': hvymCtrl
  }
};

/**
 * This function creates a property set for text mesh creation.
 * @param {string} font path to the font json file.
 * @param {number} letterSpacing space between letters.
 * @param {number} lineSpacing space between text lines.
 * @param {number} wordSpacing space between words.
 * @param {number} text padding.
 * @param {number} size text size.
 * @param {number} height text height.
 * @param {number} zOffset position of text in z.
 * @param {object} [matProps=materialProperties] (materialProperties) properties of material used on box.
 * @param {number} [meshProps=textMeshProperties] text mesh properties.
 * @param {string} [align='CENTER'] text alignment.
 * @param {bool} [editText=false] if true, text is editable.
 * @param {bool} [wrap=true] if true, text wraps in box.
 * 
 * @returns {object} Data textProperties.
 * 
 */
export function textProperties(font, letterSpacing, lineSpacing, wordSpacing, padding, size, height, zOffset=-1, matProps=materialProperties(), meshProps=textMeshProperties(), align='CENTER', editText=false, wrap=true) {
  return {
    'font': font,
    'letterSpacing': letterSpacing,
    'lineSpacing': lineSpacing,
    'wordSpacing': wordSpacing,
    'padding': padding,
    'size': size,
    'height': height,
    'zOffset': zOffset,
    'matProps': matProps,
    'meshProps': meshProps,
    'align': align,
    'editText': editText,
    'wrap': wrap
  }
};

//Default widget text properties
const W_LETTER_SPACING = 0.02;
const W_LINE_SPACING = 0.1;
const W_WORD_SPACING = 0.1;
const W_TEXT_PADDING = 0.015;
const W_TEXT_SIZE = 0.03;
const W_TEXT_HEIGHT = 0.005;
const W_TEXT_Z_OFFSET = 1;
const W_TEXT_MAT_PROPS = basicMatProperties(SECONDARY_COLOR_A);
const W_TEXT_MESH_PROPS = defaultWidgetTextMeshProperties();

/**
 * This function creates a default material properties for text elements.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data materialProperties.
 */
export function defaultWidgetTextProperties(font){
  return textProperties( font, W_LETTER_SPACING, W_LINE_SPACING, W_WORD_SPACING , W_TEXT_PADDING, W_TEXT_SIZE, W_TEXT_HEIGHT, W_TEXT_Z_OFFSET, W_TEXT_MAT_PROPS, W_TEXT_MESH_PROPS);
};

/**
 * This function creates a default material properties for text portal elements.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data materialProperties.
 */
export function defaultWidgetStencilTextProperties(font){
  let textProps = defaultWidgetTextProperties(font);
  textProps.matProps = phongStencilMatProperties(SECONDARY_COLOR_A);

  return textProps
};

//Default value text properties
const VT_LETTER_SPACING = 0.02;
const VT_LINE_SPACING = 0.1;
const VT_WORD_SPACING = 0.1;
const VT_TEXT_PADDING = 0.01;
const VT_TEXT_SIZE = 0.05;
const VT_TEXT_HEIGHT = 0.05;
const VT_TEXT_Z_OFFSET = 1;
const VT_TEXT_MAT_PROPS = basicMatProperties(SECONDARY_COLOR_A);
const VT_TEXT_MESH_PROPS = defaultValueTextMeshProperties();

/**
 * This function creates a default material properties for value text elements.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data materialProperties.
 */
export function defaultValueTextProperties(font){
  return textProperties( font, VT_LETTER_SPACING, VT_LINE_SPACING, VT_WORD_SPACING , VT_TEXT_PADDING, VT_TEXT_SIZE, VT_TEXT_HEIGHT, VT_TEXT_Z_OFFSET, VT_TEXT_MAT_PROPS, VT_TEXT_MESH_PROPS);
};

/**
 * This function creates a default material properties for value text portal elements.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data materialProperties.
 */
export function defaultStencilValueTextProperties(font){
  let textProps = defaultValueTextProperties(font);
  textProps.matProps = phongStencilMatProperties(SECONDARY_COLOR_A);

  return textProps
};

/**
 * This function creates base class for all elements with text.
 * @param {object} textProps (textProperties) property set.
 * 
 * @returns {object} Basetext class object.
 */
export class BaseText {
  constructor(textProps){
    this.textProps = textProps;
    this.padding = textProps.padding;
    this.zPosDir = 1;
    this.MultiLetterMeshes = textProps.MultiLetterMeshes;
    this.multiTextArray = [];
    this.material = getMaterial(textProps.matProps);
    this.meshes = {};
    this.editText = textProps.editText;
    this.wrap = textProps.wrap;
  }
  DarkenTextMaterial(amount=10){
    darkenMaterial(this.material, amount);
  }
  LightenTextMaterial(amount=10){
    lightenMaterial(this.material, amount);
  }
  HandlePortalStencil(){
    if(this.parent.userData.isPortal){
      setupStencilChildMaterial(this.material, this.parent.material.stencilRef);
    }
  }
  SetMaterial(material){
    this.HandlePortalStencil();
    this.material = material;
  }
  SetParent(parent){
    this.parent = parent.box;
    this.parentSize = getGeometrySize(this.parent.geometry);
    this.parentCtrl = parent;
    this.initialPositionY = (this.parentSize.height / 2) - (this.textProps.height) - (this.textProps.padding);

    if(this.parent.userData.isPortal){
      this.zPosDir = -1;
    }
  }
  ParentText(key){
    this.parent.add(this.meshes[key]);
  }
  NewTextMesh(key, text){
    const geometry = this.GeometryText(text);
    this.HandlePortalStencil();
    if(this.MultiLetterMeshes){
      this.multiTextArray = geometry.letterMeshes;
      this.meshes[key] = this.MergedMultiText(geometry);
    }else{
      geometry.center();
      this.meshes[key] = new THREE.Mesh(geometry, this.material);
    }
    
    this.meshes[key].userData.size = getGeometrySize(this.meshes[key].geometry);
    this.meshes[key].userData.key = key;
    this.meshes[key].userData.currentText = text;
    this.meshes[key].userData.controller = this;
    this.meshes[key].userData.wrap = this.wrap;
    this.ParentText(key);
    this.AlignTextPos(key);

    if(this.editText){
      this.meshes[key].addEventListener('update', function(event) {
        this.userData.controller.UpdateTextMesh(this.userData.key, this.userData.currentText);
      });

      this.meshes[key].addEventListener('onEnter', function(event) {
        this.userData.controller.AlignEditTextToTop(this.userData.key);
      });
    }

    return this.meshes[key]
  }
  NewSingleTextMesh(key, text, sizeMult=1){
    const geometry = this.SingleTextGeometry(text, sizeMult);
    geometry.center();
    this.HandlePortalStencil();
    this.meshes[key] = new THREE.Mesh(geometry, this.material);
    this.meshes[key].userData.size = getGeometrySize(geometry);
    this.meshes[key].userData.key = key;
    this.meshes[key].userData.controller = this;
    this.ParentText(key);
    this.AlignTextPos(key);

    return this.meshes[key]
  }
  AlignEditTextToTop(key){
    let pos = new THREE.Vector3(this.meshes[key].position.x, this.initialPositionY, this.meshes[key].position.z);
    this.meshes[key].position.copy(pos);
  }
  AlignEditTextToCenter(key){
    let yPosition = -this.parentSize.height/2;
    let pos = new THREE.Vector3(this.meshes[key].position.x, yPosition, this.meshes[key].position.z);
    this.meshes[key].position.copy(pos);
  }
  AlignTextPos(key){
    if(this.textProps.align == 'CENTER'){
      this.CenterTextPos(key)
    }else if(this.textProps.align == 'LEFT'){
      this.LeftTextPos(key)
    }
  }
  AlignTextZOuterBox(key, boxSize){
    this.meshes[key].position.copy(new THREE.Vector3(this.meshes[key].position.x, this.meshes[key].position.y, boxSize.depth/2));
  }
  CenterTopTextPos(key){
    this.meshes[key].position.copy(topCenterPos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  CenterTopOutsideTextPos(key){
    this.meshes[key].position.copy(topCenterOutsidePos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  CenterTopOutsideChildTextPos(key, childSize){
    this.meshes[key].position.copy(topCenterOutsidePos(childSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  CenterBottomTextPos(key){
    this.meshes[key].position.copy(bottomCenterPos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  CenterBottomOutsideTextPos(key){
    this.meshes[key].position.copy(bottomCenterOutsidePos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  CenterTextPos(key){
    this.meshes[key].position.copy(centerPos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  LeftTextPos(key){
    this.meshes[key].position.copy(leftCenterPos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  LeftBottomCornerTextPos(key){
    this.meshes[key].position.copy(leftBottomCornerPos(this.parentSize, this.meshes[key].userData.size, this.zPosDir, this.padding));
  }
  OffsetTextX(key, offset){
    this.meshes[key].translateX(offset);
  }
  OffsetTextY(key, offset){
    this.meshes[key].translateY(offset);
  }
  OffsetTextZ(key, offset){
    this.meshes[key].translateZ(offset);
  }
  DeleteTextGeometry(key){
    this.meshes[key].geometry.dispose();
  }
  UpdateTextMesh(key, text){
    if(this.meshes[key]==undefined)
      return;

    let ctrl = this.parent.userData.boxCtrl.is;
    
    this.meshes[key].geometry.dispose();
    this.meshes[key].geometry = this.GeometryText(text);
    this.meshes[key].userData.size = getGeometrySize(this.meshes[key].geometry);
    if(!this.wrap && ctrl == 'INPUT_TEXT_WIDGET'){
      this.AlignEditTextToCenter(key);
    }else{
      this.AlignTextPos(key);
    }
  }
  MergedMultiTextMesh(text){
    const geometry = this.MergedMultiGeometry(text);
    return new THREE.Mesh(geometry, this.material);
  }
  MergedTextMesh(text){
    const geometry = this.MergedTextGeometry(text);
    return new THREE.Mesh(geometry, this.material);
  }
  GeometryText(text){
    let geometry = undefined;
    if(this.MultiLetterMeshes){
      geometry = this.MergedMultiGeometry(text);
    }else{
      geometry = this.MergedTextGeometry(text);
    }

    return geometry
  }
  MergedTextGeometry(text) {
    const boxSize = getGeometrySize(this.parent.geometry);
    let lineWidth = -(this.parentSize.width / 2 - (this.textProps.padding));
    let yPosition = this.initialPositionY;
    

    let letterGeometries = [];

    for (let i = 0; i < text.length; i++) {
      const character = text[i];

      let geoHandler = this.TextLineGeometry(character, lineWidth, yPosition, letterGeometries);
      lineWidth = geoHandler.lineWidth;
      letterGeometries = geoHandler.letterGeometries;

      // Check if lineWidth exceeds cBox width - padding
      if (lineWidth > this.parentSize.width / 2 - this.textProps.padding && this.wrap) {
        lineWidth = -(this.parentSize.width / 2) + this.textProps.padding; // Reset x position to the upper-left corner
        yPosition -= this.textProps.lineSpacing; // Move to the next line
      }
    }

    // Merge the individual letter geometries into a single buffer geometry
    return BufferGeometryUtils.mergeGeometries(letterGeometries);
  }
  SingleTextGeometry(text, sizeMult=1){
    return new TextGeometry(text, {
      font: this.textProps.font,
      size: this.textProps.size*sizeMult,
      height: this.textProps.height,
      curveSegments: this.textProps.curveSegments,
      bevelEnabled: this.textProps.bevelEnabled,
      bevelThickness: this.textProps.bevelThickness,
      bevelSize: this.textProps.bevelSize,
      bevelOffset: this.textProps.bevelOffset,
      bevelSegments: this.textProps.bevelSegments,
    });
  }
  TextLineGeometry(character, lineWidth, yPosition, letterGeometries){
    const boxSize = getGeometrySize(this.parent.geometry);
    if (character === ' ') {
      // Handle spaces by adjusting the x position
      lineWidth += this.textProps.wordSpacing;
    } else {

      const geometry = this.SingleTextGeometry(character);
      const charSize = getGeometrySize(geometry);
      geometry.translate(lineWidth, yPosition, (this.parentSize.depth+boxSize.depth)-charSize.depth*this.zPosDir);

      // Calculate the width of the letter geometry
      let { width } = getGeometrySize(geometry);
      width+=this.textProps.letterSpacing;

      letterGeometries.push(geometry);

      // Update lineWidth
      lineWidth += width;
    }

    return { letterGeometries, lineWidth }
  }
  MergedMultiText(merged){

    const mergedMesh = new THREE.Mesh(merged.geometry, transparentMaterial());

    const boxSize = getGeometrySize(this.parent.geometry);
    const geomSize = getGeometrySize(merged.geometry);
    mergedMesh.position.set(0, -this.textProps.padding, 0);
    setMergedMeshUserData(this.parentSize, geomSize, this.textProps.padding, mergedMesh);
    mergedMesh.userData.draggable=true;
    mergedMesh.userData.horizontal=false;
    if(name==''){
      name='text-'+this.parent.id;
    }
    this.parent.name = name;
    merged.letterMeshes.forEach((m, i) => {
      mergedMesh.add(m);
    });

    return mergedMesh
  }
  MergedMultiGeometry(text){

    let lineWidth = -(this.parentSize.width / 2 - (this.textProps.padding));
    let yPosition = this.parentSize.height / 2 ;
    const letterGeometries = [];
    const letterMeshes = [];
    const cubes = [];

    for (let i = 0; i < text.length; i++) {
        const character = text[i];

        if (character === ' ') {
          // Handle spaces by adjusting the x position
          lineWidth += this.textProps.wordSpacing;
        } else {

           if(this.textProps.meshProps == undefined){
            this.textProps.meshProps = textMeshProperties()
          }
          const geometry = this.SingleTextGeometry(character);
          const cube = new THREE.BoxGeometry(this.textProps.size*2, this.textProps.size*2, this.textProps.height);

          cube.translate((this.textProps.size/2)+lineWidth, (this.textProps.size/2)+yPosition, this.parent.userData.depth/2*this.zPosDir);

          const letterMesh = new THREE.Mesh(geometry, this.material);
          letterMesh.position.set(lineWidth, yPosition, this.parent.userData.depth/2*this.zPosDir);

          // Calculate the width of the letter geometry
          let { width } = getGeometrySize(geometry);
          width+=this.textProps.letterSpacing;

          // Check if the letter is within the bounds of the cBox mesh
          if (width <= this.parent.userData.width / 2 - this.textProps.padding) {
            letterMeshes.push(letterMesh);
            letterGeometries.push(geometry);
            cubes.push(cube);
          }
          // Update lineWidth
          lineWidth += width;
        }

        // Check if lineWidth exceeds cBox width - padding
        if (lineWidth > this.parentSize.width / 2 - this.textProps.padding) {
          lineWidth = -(this.parentSize.width / 2) + this.textProps.padding; // Reset x position to the upper-left corner
          yPosition -= this.textProps.lineSpacing; // Move to the next line
        }
      }


      const mergedGeometry = BufferGeometryUtils.mergeGeometries(cubes);

      return { 'geometry': mergedGeometry, 'letterMeshes': letterMeshes }

  }
  SetMergedTextUserData(key){
    let extraSpace = this.padding*0.5;
    let geomSize = this.meshes[key].userData.size;
    this.meshes[key].userData.initialPositionY = this.parentSize.height/2 - geomSize.height/2;
    this.meshes[key].userData.maxScroll = geomSize.height/2 - this.parentSize.height/2 - (this.padding+extraSpace);
    this.meshes[key].userData.minScroll = this.meshes[key].userData.initialPositionY+this.meshes[key].userData.maxScroll+(this.padding-extraSpace);
    this.meshes[key].userData.padding = this.padding;
  }
  static CreateTextGeometry(character, font, size, height, curveSegments, bevelEnabled, bevelThickness, bevelSize, bevelOffset, bevelSegments) {
    return new TextGeometry(character, {
      'font': font,
      'size': size,
      'height': height,
      'curveSegments': curveSegments,
      'bevelEnabled': bevelEnabled,
      'bevelThickness': bevelThickness,
      'bevelSize': bevelSize,
      'bevelOffset': bevelOffset,
      'bevelSegments': bevelSegments,
    });
  }
}

/**
 * This function creates a property set toggle widgets.
 * @param {string} name element name.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {number} width  the width of the box.
 * @param {number} height  the height of the box.
 * @param {number} depth  the depth of the box.
 * @param {number} smoothness amount of geometry smoothness.
 * @param {number} radius  the curvature of the box edges.
 * @param {number} [zOffset=1]  offset of box in z relative to the parent.
 * @param {bool} [complexMesh=true] if true box created has curved edges, else simple box is used.
 * @param {object} [matProps=materialProperties] (materialProperties) properties of material used on box.
 * @param {string} [pivot='CENTER'] pivot point of the box.
 * @param {number} [padding=0.01] box padding.
 * @param {bool} [isPortal=false] if true, element is curved flat plane with stencil shader, children box are rendered inside of it.
 * 
 * @returns {object} Data object for toggle elements.
 */
export function boxProperties(name, parent, width, height, depth, smoothness, radius, zOffset = 1, complexMesh=true, matProps=materialProperties(), pivot='CENTER', padding=0.01, isPortal=false){
  return {
    'type': 'BOX_PROPS',
    'name': name,
    'parent': parent,
    'width': width,
    'height': height,
    'depth': depth,
    'smoothness': smoothness,
    'radius': radius,
    'zOffset': zOffset,
    'complexMesh': complexMesh,
    'matProps': matProps,
    'pivot': pivot,
    'padding': padding,
    'isPortal': isPortal
  }
};

//default box geometry constants
const SMOOTHNESS = 3;
const RADIUS = 0.02;
const Z_OFFSET = 0.025;
const COMPLEX_MESH = true;
const MAT_PROPS = basicMatProperties(PRIMARY_COLOR_A);
const PIVOT = 'CENTER';
const PADDING = 0;
const IS_PORTAL = false;

//default widget box constants
const W_WIDTH = 1.5;
const W_HEIGHT = 0.25;
const W_DEPTH = 0.1;

/**
 * This function creates default box property set for widgets on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultWidgetBoxProps(name, parent){
  return boxProperties(name, parent, W_WIDTH, W_HEIGHT, W_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for widget portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultWidgetPortalProps(name, parent){
  let boxProps = defaultWidgetBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default panel widget box constants
const PW_WIDTH = 1.7;
const PW_HEIGHT = 0.25;
const PW_DEPTH = 0.05;

/**
 * This function creates default box property set for panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelWidgetBoxProps(name, parent){
  return boxProperties(name, parent, PW_WIDTH, PW_HEIGHT, PW_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for panel portals.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelWidgetPortalProps(name, parent){
  let boxProps = defaultPanelWidgetBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

const PCTRL_MAT_PROPS = basicMatProperties(PRIMARY_COLOR_B);
//default panel ctrl widget constants
const PCTRL_HEIGHT = 0.13;
const PCTRL_DEPTH = 0.01;

//default panel widget box constants
const PIT_WIDTH = 1.5;

/**
 * This function creates default box property set for edit texts on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelEditTextBoxProps(name, parent){
  return boxProperties(name, parent, PIT_WIDTH, PCTRL_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for edit text portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelEditTextPortalProps(name, parent){
  let boxProps = defaultPanelEditTextBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default panel widget box constants
const EDTBTN_WIDTH = 1;

/**
 * This function creates default box property set for edit text buttons on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultEditTextButtonBoxProps(name, parent){
  return boxProperties(name, parent, EDTBTN_WIDTH, PCTRL_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for edit text button portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultEditTextButtonPortalProps(name, parent){
  let boxProps = defaultEditTextButtonBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default panel toggle box constants
const PTGL_WIDTH = 1;

/**
 * This function creates default box property set for toggles on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelToggleBoxProps(name, parent){
  return boxProperties(name, parent, PTGL_WIDTH, PCTRL_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for toggle portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelTogglePortalProps(name, parent){
  let boxProps = defaultPanelToggleBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default panel toggle box constants
const PSL_WIDTH = 1.2;

/**
 * This function creates default box property set for sliders on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelSliderBoxProps(name, parent){
  return boxProperties(name, parent, PSL_WIDTH, PCTRL_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for slider portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelSliderPortalProps(name, parent){
  let boxProps = defaultPanelSliderBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

const CW_HEIGHT = 0.18;

/**
 * This function creates default box property set for color widgets on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelColorWidgetBoxProps(name, parent){
  return boxProperties(name, parent, W_WIDTH, CW_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for color widget portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelColorWidgetPortalProps(name, parent){
  let boxProps = defaultPanelColorWidgetBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default selector box broperties
const PLS_HEIGHT = 0.13;
const PLS_WIDTH = 0.75;

/**
 * This function creates default box property set for selector on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelListSelectorBoxProps(name, parent){
  return boxProperties(name, parent, PLS_WIDTH, PLS_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for selector portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelListSelectorPortalProps(name, parent){
  let boxProps = defaultPanelListSelectorBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default selector box broperties
const PBTN_WIDTH = 0.75;

/**
 * This function creates default box property set for button on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelButtonBoxProps(name, parent){
  return boxProperties(name, parent, PLS_WIDTH, PCTRL_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for button portals on panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelButtonPortalProps(name, parent){
  let boxProps = defaultPanelButtonBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

//default panel gltf model box props
const PGL_WIDTH = 0.15;
const PGL_HEIGHT = 0.15;

/**
 * This function creates default box property set for gltf model panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelGltfModelBoxProps(name, parent){
  return boxProperties(name, parent, PGL_WIDTH, PGL_HEIGHT, PCTRL_DEPTH, SMOOTHNESS, RADIUS, Z_OFFSET, COMPLEX_MESH, PCTRL_MAT_PROPS, PIVOT, PADDING, IS_PORTAL)
};

/**
 * This function creates default box property set for gltf model panel portals.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (boxProperties).
 */
export function defaultPanelGltfModelPortalProps(name, parent){
  let boxProps = defaultPanelGltfModelBoxProps(parent);
  boxProps.isPortal = true;

  return boxProps
};

/**
 * This function sets the mesh pivot based on passed constant type.
 * Pivot Constants: 'LEFT', 'RIGHT', 'TOP', 'TOP_LEFT', 'TOP_RIGHT','BOTTOM_LEFT', 'BOTTOM_RIGHT'
 * @param {object} mesh Object3D mesh.
 * @param {object} boxProps (boxProperties) property set.
 * 
 * @returns {null} No return.
 */
function setGeometryPivot(mesh, boxProps){
  let geomSize = getGeometrySize(mesh.geometry);
  switch (boxProps.pivot) {
    case 'LEFT':
      mesh.pivot = new THREE.Vector3(-boxProps.width/2, boxProps.height/2, boxProps.depth/2);
      break;
    case 'RIGHT':
      mesh.pivot = new THREE.Vector3(boxProps.width/2, boxProps.height/2, boxProps.depth/2);
      break;
    case 'TOP':
      mesh.pivot = new THREE.Vector3(boxProps.width/2, -boxProps.height, boxProps.depth/2);
      break;
    case 'TOP_LEFT':
      mesh.pivot = new THREE.Vector3(-boxProps.width, -boxProps.height, boxProps.depth/2);
      break;
    case 'TOP_RIGHT':
      mesh.pivot = new THREE.Vector3(boxProps.width, -boxProps.height, boxProps.depth/2);
      break;
    case 'BOTTOM':
      mesh.pivot = new THREE.Vector3(boxProps.width/2, boxProps.height, boxProps.depth/2);
      break;
    case 'BOTTOM_LEFT':
      mesh.pivot = new THREE.Vector3(-boxProps.width, boxProps.height, boxProps.depth/2);
      break;
    case 'BOTTOM_RIGHT':
      mesh.pivot = new THREE.Vector3(boxProps.width, boxProps.height, boxProps.depth/2);
      break;
    default:
      mesh.pivot = new THREE.Vector3(0, 0, 0);
  }
}

/**
 * This function creates base class for all elements with boxes.
 * @param {object} boxProps (boxProperties) property set.
 * 
 * @returns {object} BaseBox class object.
 */
export class BaseBox {
  constructor(boxProps) {
    this.is = 'BASE_BOX';
    this.parent = boxProps.parent;
    this.width = boxProps.width;
    this.height = boxProps.height;
    this.depth = boxProps.depth;
    this.matProps = boxProps.matProps;
    this.padding = boxProps.padding;
    this.complexMesh = boxProps.complexMesh;
    this.isPortal = boxProps.isPortal;
    this.material = getMaterial(boxProps.matProps);
    this.geometry = this.CreateBoxGeometry(boxProps);
    this.box = new THREE.Mesh(this.geometry, this.material);
    setGeometryPivot(this.box, boxProps);
    this.box.userData.width = this.width;
    this.box.userData.height = this.height;
    this.box.userData.depth = this.depth;
    this.box.userData.padding = this.padding;
    this.size = getGeometrySize(this.box.geometry);
    this.parentSize = getGeometrySize(this.parent.geometry);

    this.box.userData.width = boxProps.width;
    this.box.userData.height = boxProps.height;
    this.box.userData.depth = boxProps.depth;
    this.box.userData.padding = boxProps.padding;
    this.box.userData.isPortal = boxProps.isPortal;

    this.parentPanel = undefined;

    this.zPosDir = 1;
    //this.zPos = this.depth/2;

    if(this.isPortal){
      this.parent.material.depthWrite = false;
      this.zPosDir = -1;
      //this.zPos = 0;
    }

    
    if(!this.parent.isScene){
      this.parent.add(this.box);
      this.parentSize = getGeometrySize(boxProps.parent.geometry);
      this.box.position.copy(this.CenterBoxPos());
      //this.box.position.set(this.box.position.x, this.box.position.y, this.parentSize.depth/2);
    }
    
    this.stencilRef = this.box.material.stencilRef;
    this.box.userData.stencilRef = this.box.material.stencilRef;
    this.box.userData.boxCtrl = this;

  }
  MakePortalChild(stencilRef){
    this.stencilRef = stencilRef;
    this.box.userData.stencilRef = stencilRef;
    setupStencilChildMaterial(this.box.material, stencilRef)
    this.MakeChidrenStencilChild(this.box, stencilRef);
  }
  MakeChidrenStencilChild(child, stencilRef){
    child.traverse( function( object ) {
        if(object.isMesh){
          setupStencilChildDepthMaterial(object.material, stencilRef);
        }
    });
  }
  ToggleVisible(visible){
    this.box.traverse( function( object ) {
        if(object.isMesh){
          object.visible = visible;
        }
    });
  }
  CreateBoxGeometry(boxProps) {
    let result = undefined;
    if(this.complexMesh){
      if(this.isPortal){
        result = BaseBox.RoundedPlaneGeometry(boxProps.width, boxProps.height, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
      }else{
        result = BaseBox.RoundedBoxGeometry(boxProps.width, boxProps.height, boxProps.depth, boxProps.radius, boxProps.smoothness, boxProps.zOffset);
      }
    }else{
      result = new THREE.BoxGeometry(boxProps.width, boxProps.height, boxProps.depth);
    }

    result.morphAttributes.position = [];

    return result
  }
  UpdateBoxGeometry(boxProps) {
    this.geometry.dispose();
    this.CreateBoxGeometry(boxProps);
    setGeometryPivot(this.box, boxProps);
  }
  UpdateMaterial(matProps){
    this.material.dispose();
    this.material = getMaterial(matProps);
    this.box.material = this.material;
  }
  ReplaceMaterial(material){
    this.material.dispose();
    this.material = material;
    this.box.material = this.material;
  }
  CreateHeightExpandedMorph(sizeMult){
    if(this.box.geometry == undefined)
      return;

    this.material.morphTargets = true;
    const morphGeometry = this.box.geometry.clone();
    const expansionY = (this.height/2)*sizeMult;
    //move the top verts upward, and the bottom verts downward.
    morphGeometry.attributes.position.array.forEach((v, i) => {
      let x = morphGeometry.attributes.position.getX(i);
      let y = morphGeometry.attributes.position.getY(i);
      let z = morphGeometry.attributes.position.getZ(i);
      if(y>0){
        morphGeometry.attributes.position.setXYZ(i, x, y+expansionY, z);
      }else if(y<0){
        morphGeometry.attributes.position.setXYZ(i, x, y-expansionY, z);
      }
    });

    this.box.geometry.morphAttributes.position[ 0 ] = new THREE.Float32BufferAttribute( morphGeometry.attributes.position.array, 3 );
    this.box.updateMorphTargets();
  }
  HandleListConfig(listConfig){
    if(listConfig != undefined){
      this.parent.material.depthWrite = false;
      this.box.name = listConfig.boxProps.name;
      this.listItem = new ListItemBox(listConfig);
      this.listItem.SetContent(this);
    }else{
      this.parent.add(this.box);
    }
  }
  SetColor(color){
    this.box.material.color.set(color);
  }
  SetOpacity(opacity){
    this.box.material.opacity = opacity;
  }
  NewBoxStencilMaterial(stencilRef){
    this.box.material = getMaterial(this.matProps, stencilRef);
  }
  SetStencilRef(stencilRef){
    this.box.material.stencilRef = stencilRef;
  }
  ConvertBoxMaterialToPortalMaterial(){
    this.box.material.stencilWrite = true;
    this.box.material.depthWrite = false;
    this.box.material.stencilFunc = THREE.AlwaysStencilFunc;
    this.box.material.stencilZPass = THREE.ReplaceStencilOp;
  }
  ConvertBoxMaterialToPortalChildMaterial(){
    this.box.material.depthWrite = false;
    this.box.material.stencilWrite = true;
    this.box.material.stencilFunc = THREE.EqualStencilFunc;
  }
  MakeBoxMaterialInvisible(){
    this.box.material.opacity = 0;
    this.box.material.transparent = true;
  }
  MakeBoxMaterialVisible(){
    this.box.material.opacity = 1;
    this.box.material.transparent = false;
  }
  DarkenBoxMaterial(amount=10){
    darkenMaterial(this.box.material, amount);
  }
  LightenBoxMaterial(amount=10){
    lightenMaterial(this.box.material, amount);
  }
  CreateComplemetaryColorMaterial(matProps){
    let c = '#'+this.box.material.color.getHexString()
    let colsea = colorsea(c, 100);
    matProps.color = colsea.complement().hex();

    return getMaterial(matProps, matProps.stencilRef);
  }
  AlignCenter(){
    this.box.position.copy(this.CenterBoxPos(this.zPosDir));
  }
  AlignTop(){
    this.box.position.copy(this.TopCenterBoxPos(this.zPosDir));
  }
  AlignAsTopSibling(zPosDir=1){
    this.box.position.copy(this.TopCenterParallelOutsideBoxPos());
  }
  AlignBottom(zPosDir=1){
    this.box.position.copy(this.BottomCenterBoxPos(this.zPosDir));
  }
  AlignOutsideBottom(zPosDir=1){
    this.box.position.copy(this.BottomCenterOutsideBoxPos(zPosDir));
  }
  AlignAsBottomSibling(zPosDir=1){
    this.box.position.copy(this.BottomCenterParallelOutsideBoxPos());
  }
  AlignLeft(){
    this.box.position.copy(this.LeftCenterBoxPos(this.zPosDir));
  }
  AlignLeftOfTransform(){
    this.box.position.set(-this.size.width/2, 0, 0);
  }
  AlignOutsideLeft(zPosDir=1){
    this.box.position.copy(this.LeftCenterOutsideBoxPos(zPosDir));
  }
  AlignRight(){
    this.box.position.copy(this.RightCenterBoxPos(this.zPosDir));
  }
  AlignRightOfTransform(){
    this.box.position.set(this.size.width/2, 0, 0);
  }
  AlignOutsideRight(zPosDir=1){
    this.box.position.copy(this.RightCenterOutsideBoxPos(zPosDir));
  }
  AlignOutsideFrontParent(){
    this.box.translateZ(this.parentSize.depth+this.depth/2);
  }
  AlignOutsideBehindParent(){
    this.box.translateZ(-this.parentSize.depth-this.depth/2);
  }
  CenterBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, this.parentSize.height-this.parentSize.height, (this.parentSize.depth/2)*zPosDir);
  }
  TopCenterBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, this.parentSize.height/2-this.size.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  TopCenterOutsideBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, this.parentSize.height/2+this.size.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  TopCenterParallelOutsideBoxPos(){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, this.parentSize.height/2+this.size.height/2, -(this.parentSize.depth-this.size.depth));
  }
  BottomCenterBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, -this.parentSize.height/2+this.size.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  BottomCenterOutsideBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, -(this.parentSize.height/2+this.size.height/2), (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  BottomCenterParallelOutsideBoxPos(){
    return new THREE.Vector3(this.parentSize.width-this.parentSize.width, -(this.parentSize.height/2+this.size.height/2), -(this.parentSize.depth-this.size.depth));
  }
  RightCenterBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width/2-this.size.width/2, this.parentSize.height/2-this.parentSize.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  RightCenterOutsideBoxPos(zPosDir=1){
    return new THREE.Vector3(this.parentSize.width/2+this.size.width/2, this.parentSize.height/2-this.parentSize.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  LeftCenterBoxPos(zPosDir=1){
    return new THREE.Vector3(-(this.parentSize.width/2-this.size.width/2), this.parentSize.height/2-this.parentSize.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  LeftCenterOutsideBoxPos(zPosDir=1){
    return new THREE.Vector3(-(this.parentSize.width/2+this.size.width/2), this.parentSize.height/2-this.parentSize.height/2, (this.parentSize.depth/2+this.size.depth/2)*zPosDir);
  }
  SetParentPanel(){
    if(this.box.parent.userData.panelProps!=undefined && this.box.parent.userData.panelCtrl!=undefined){
      this.parentPanel = this.box.parent.userData.panelCtrl;
      this.box.userData.parentPanel = this.parentPanel;
    }
  }
  static RoundedBoxGeometry(width, height, depth, radius, smoothness, zOffset=1){
    const shape = new THREE.Shape();
    let eps = 0.00001;
    let _radius = radius - eps;
    shape.absarc( eps, eps, eps, -Math.PI / 2, -Math.PI, true );
    shape.absarc( eps, height -  radius * 2, eps, Math.PI, Math.PI / 2, true );
    shape.absarc( width - radius * 2, height -  radius * 2, eps, Math.PI / 2, 0, true );
    shape.absarc( width - radius * 2, eps, eps, 0, -Math.PI / 2, true );

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelSegments: smoothness * 2,
      steps: 1,
      bevelSize: _radius,
      bevelThickness: zOffset*radius,
      curveSegments: smoothness
    };

    const geometry = new THREE.ExtrudeGeometry( shape, extrudeSettings );
    geometry.center();
    BufferGeometryUtils.mergeVertices(geometry);
    geometry.computeVertexNormals();


    return geometry
  }
  static RoundedPlaneGeometry( width, height, radius, smoothness ) {
    
    const pi2 = Math.PI * 2;
    const n = ( smoothness + 1 ) * 4; // number of segments    
    let indices = [];
    let positions = [];
    let uvs = [];   
    let qu, sgx, sgy, x, y;
      
    for ( let j = 1; j < n + 1; j ++ ) indices.push( 0, j, j + 1 ); // 0 is center
      indices.push( 0, n, 1 );   
      positions.push( 0, 0, 0 ); // rectangle center
      uvs.push( 0.5, 0.5 );   
      for ( let j = 0; j < n ; j ++ ) contour( j );
      
      const geometry = new THREE.BufferGeometry( );
      geometry.setIndex( new THREE.BufferAttribute( new Uint32Array( indices ), 1 ) );

    geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
    geometry.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( uvs ), 2 ) );
    geometry.center();
      
      return geometry;
      
      function contour( j ) {
          
          qu = Math.trunc( 4 * j / n ) + 1 ;      // quadrant  qu: 1..4         
          sgx = ( qu === 1 || qu === 4 ? 1 : -1 ) // signum left/right
          sgy =  qu < 3 ? 1 : -1;                 // signum  top / bottom
          x = sgx * ( width / 2 - radius ) + radius * Math.cos( pi2 * ( j - qu + 1 ) / ( n - 4 ) ); // corner center + circle
          y = sgy * ( height / 2 - radius ) + radius * Math.sin( pi2 * ( j - qu + 1 ) / ( n - 4 ) );   
   
          positions.push( x, y, 0 );       
          uvs.push( 0.5 + x / width, 0.5 + y / height );       
          
      }
      
  }

}

/**
 * This function creates a property set for button widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name='Button'] name for the element.
 * @param {string} [value=''] button value.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {bool} [mouseOver=false] if true, button expands on ouse-over.
 * @param {string} [attach='RIGHT'] alignment of where button is attached.
 * @param {object} [objectControlProps=undefined] slot for object that will be updated by widget.
 * 
 * @returns {object} Data object for button elements.
 */
export function buttonProperties( scene, boxProps, name='Button', value='', textProps=undefined, mouseOver=false, attach='RIGHT', objectControlProps=undefined){
  return {
    'type': 'BUTTON',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'value': value,
    'textProps': textProps,
    'mouseOver': mouseOver,
    'attach': attach,
    'objectControlProps': objectControlProps
  }
};

/**
 * This function creates a default property set for button widgets, used in panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for button elements, used in panels.
 */
export function defaultPanelButtonProps(scene, name, parent, font){
  const boxProps = defaultPanelButtonBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);

  return buttonProperties(scene, boxProps, name, '', textProps, false, 'CENTER')
};

/**
 * This function creates a default property set for edit text button widgets, used in panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for edit text button elements, used in panels.
 */
export function defaultPanelEditTextButtonProps(name, parent, font){
  const boxProps = defaultEditTextButtonBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);

  return buttonProperties(boxProps, name, '', textProps)
};

/**
 * This function creates base class for elements that are boxes containing text such as buttons.
 * @param {object} buttonProps (buttonProperties) property set.
 * 
 * @returns {object} BaseTextBox class object.
 */
class BaseTextBox extends BaseBox {
  constructor(buttonProps) {
    let indicatorBoxProps = undefined;
    if(buttonProps.objectControlProps != undefined){
      let adjustBoxProps = BaseWidget.ModelIndicatorBoxProps(buttonProps);
      buttonProps.boxProps = adjustBoxProps.base;
      indicatorBoxProps = adjustBoxProps.indicator;
    }
    super(buttonProps.boxProps);
    this.is = 'BASE_TEXT_BOX';
    this.scene = buttonProps.scene;
    this.objectControlProps = buttonProps.objectControlProps;
    this.text = buttonProps.name;
    this.textProps = buttonProps.textProps;
    this.textProps.MultiLetterMeshes = false;
    this.matProps = buttonProps.matProps;
    this.animProps = buttonProps.animProps;
    this.listConfig = buttonProps.listConfig;
    this.mouseOver = buttonProps.mouseOver;
    this.portal = buttonProps.portal;

    this.BaseText = new BaseText(this.textProps);
    this.BaseText.SetParent(this);

    this.textMaterial = getMaterial(this.textProps.matProps, this.box.material.stencilRef);
    this.BaseText.SetMaterial(this.textMaterial);
    this.textMesh = this.CreateText();
    this.UpdateText(this.text);
    this.textMesh.userData.value = buttonProps.value;
    this.box.userData.value = buttonProps.value;
    this.box.userData.properties = buttonProps;
    adjustBoxScaleRatio(this.box, this.parent);

    BaseWidget.SetUpObjectControlProps(this);

    if(indicatorBoxProps!=undefined){
      indicatorBoxProps.parent = this.box;
      BaseWidget.AddModelInnerIndicator(this, indicatorBoxProps);
      if(this.objectControlProps.type == 'MAT_REF'){
        BaseWidget.HandleMaterialMesh(this, this.useAlpha);
        this.BaseText.OffsetTextX('btn_text', this.modelIndicator.size.width/2);
      }
      
    }

  }
  CreateText(){
    const boxSize = getGeometrySize(this.box.geometry);
    let result = this.BaseText.NewSingleTextMesh('btn_text', this.text);
    setMergedMeshUserData(boxSize, result.userData.size, this.textProps.padding, result);

    return result
  }
  UpdateText(text){
    this.text = text;
    this.textMesh.geometry.dispose();
    this.textMesh.geometry = this.BaseText.SingleTextGeometry(this.text);
    this.textMesh.geometry.center();
    this.BaseText.ParentText('btn_text');
    this.BaseText.AlignTextPos('btn_text');
  }
  DeleteText(){
    this.textMesh.geometry.dispose();
    this.box.remove(this.textMesh);
  }
}

/**
 * This function creates panel box for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelBox class object.
 */
export class PanelBox extends BaseTextBox {
  constructor(panelProps) {
    super(buttonProperties(panelProps.scene, panelProps.boxProps, panelProps.name, panelProps.value, panelProps.textProps, panelProps.mouseOver));
    this.is = 'PANEL_BOX';
    this.SetParentPanel();
    this.DeleteText();
    this.AlignOutsideBehindParent();
  }
};

/**
 * This function creates panel gltf label widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelLabel class object.
 */
export class PanelLabel extends BaseTextBox {
  constructor(panelProps) {
    super(buttonProperties(panelProps.scene, panelProps.boxProps, panelProps.name, panelProps.value, panelProps.textProps, panelProps.mouseOver));
    this.is = 'PANEL_LABEL';
    this.SetParentPanel();
    this.AlignOutsideBehindParent();
  }
};

/**
 * This function creates panel gltf model widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelGltfModel class object.
 */
export class PanelGltfModel extends BaseTextBox {
  constructor(panelProps) {
    super(buttonProperties(panelProps.scene, panelProps.boxProps, panelProps.name, panelProps.value, panelProps.textProps, panelProps.mouseOver));
    this.is = 'PANEL_GLTF_MODEL';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    this.AlignOutsideBehindParent();
    this.panelProps = panelProps;
    const section = panelProps.sections.data[this.panelProps.index];
    this.valProps = section.data;
    this.useLabel = this.valProps.useLabel;
    this.loadedCallback = undefined;

    if(!this.useLabel){
      this.DeleteText();
    }

    let gltfProps = defaultPanelGltfModelProps(this.scene, this.panelProps.name, this.box, this.panelProps.textProps.font, this.valProps.path);
    gltfProps.ctrl = this;

    gltfLoader.load( gltfProps.gltf,function ( gltf ) {
        gltfProps.hvymData = new HVYM_Data(gltf);
        gltfProps.gltf = gltf;
        gltfProps.ctrl.modelBox = new GLTFModelWidget(gltfProps);
        gltfProps.ctrl.box.userData.modelBox = gltfProps.ctrl.ctrlWidget;
        if(gltfProps.ctrl.useLabel){
          gltfProps.ctrl.BaseText.CenterTopOutsideChildTextPos('btn_text', gltfProps.ctrl.modelBox.size);
          gltfProps.ctrl.BaseText.AlignTextZOuterBox('btn_text', gltfProps.ctrl.size);
        }

        if(gltfProps.ctrl.loadedCallback){
          gltfProps.ctrl.loadedCallback();
        }
      },
      // called while loading is progressing
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( error );
      }
    );
  }
};

/**
 * This function creates panel gltf model meter widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelGltfModelMeter class object.
 */
export class PanelGltfModelMeter extends PanelGltfModel{
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_GLTF_MODEL_METER';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    this.meterProps = defaultPanelMeterProps(this.scene, this.panelProps.name, this.box, this.panelProps.textProps.font, this.valProps.widgetValueProp);
    this.DeleteText();
    this.loadedCallback = this.SetupMeter;
  }
  SetupMeter(){
    this.meterProps.boxProps.width = this.meterProps.boxProps.width-this.modelBox.size.width;
    this.ctrlWidget = new MeterWidget(this.meterProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
    this.modelBox.box.translateX(-this.ctrlWidget.size.width/2);
    this.ctrlWidget.box.translateX(this.modelBox.size.width/2);
    this.ctrlWidget.widgetText.translateX(-this.modelBox.size.width/2);
  }
};

/**
 * This function creates panel gltf model value meter widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelGltfModelValueMeter class object.
 */
export class PanelGltfModelValueMeter extends PanelGltfModelMeter{
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_GLTF_MODEL_VALUE_METER';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    this.meterProps = defaultPanelValueMeterProps(this.scene, this.panelProps.name, this.box, this.panelProps.textProps.font, this.valProps.widgetValueProp);
    this.loadedCallback = this.SetupValueMeter;
  }
  SetupValueMeter(){
    this.meterProps.boxProps.width = this.meterProps.boxProps.width-this.modelBox.size.width;
    this.ctrlWidget = new MeterWidget(this.meterProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
    this.modelBox.box.translateX(-(this.ctrlWidget.size.width/2+this.ctrlWidget.valueTextBox.width/2));
    this.ctrlWidget.box.translateX(this.modelBox.size.width/2);
    this.ctrlWidget.widgetText.translateX(-this.modelBox.size.width/2);
  }
};

/**
 * This function creates panel edit text widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelEditText class object.
 */
export class PanelEditText extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.SetParentPanel();
    this.is = 'PANEL_EDIT_TEXT';
    this.scene = panelProps.scene;
    const section = panelProps.sections.data[panelProps.name];
    const editTextProps = defaultPanelEditTextProps(this.scene, panelProps.name, this.box, panelProps.textProps.font);
    editTextProps.name = section.name;
    editTextProps.textProps.wrap = false;
    this.ctrlWidget = new InputTextWidget(editTextProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel input text widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelInputText class object.
 */
export class PanelInputText extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_INPUT_TEXT';
    this.scene = panelProps.scene;
    const section = panelProps.sections.data[panelProps.name];
    this.SetParentPanel();
    const inputTextProps = defaultPanelInputTextProps(this.scene, panelProps.name, this.box, panelProps.textProps.font);
    inputTextProps.name = section.name;
    inputTextProps.textProps.wrap = false;
    this.ctrlWidget = new InputTextWidget(inputTextProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel toggle widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelBooleanToggle class object.
 */
export class PanelBooleanToggle extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_BOOLEAN_TOGGLE';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    this.DeleteText();
    const toggleProps = defaultPanelBooleanToggleProps(this.scene, panelProps.name, this.box, panelProps.textProps.font);
    this.ctrlWidget = new ToggleWidget(toggleProps);

  }
};

/**
 * This function creates panel slider widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelSlider class object.
 */
export class PanelSlider extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_SLIDER';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    let valProps = section.data;
    let objectControlProps = undefined;
    if(section.data.type.includes('HVYM')){
      valProps = valProps.val_props;
      if(section.data.type.includes('MORPH_SET_REF')){
        objectControlProps = meshRefProperties(section.data.mesh_ref.isGroup, section.data.mesh_ref, valProps, 'morph', false, section.data.morph_name, true);
      }else if(section.data.type.includes('ANIM_PROP')){
        objectControlProps = section.data.val_props;
        valProps = section.data.val_props.valueProps
      }
    }
    const sliderProps = defaultPanelSliderProps(this.scene, panelProps.name, this.box, panelProps.textProps.font, valProps);
    if(objectControlProps!=undefined){
      sliderProps.objectControlProps = objectControlProps;
    }
    this.ctrlWidget = new SliderWidget(sliderProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel material slider widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelMaterialSlider class object.
 */
export class PanelMaterialSlider extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_MATERIAL_SLIDER';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    const matRefProps = section.data;
    matRefProps.valueProps.editable = true;
    const sliderProps = defaultPanelSliderProps(this.scene, panelProps.name, this.box, panelProps.textProps.font, matRefProps.valueProps);
    sliderProps.objectControlProps = matRefProps;
    this.ctrlWidget = new SliderWidget(sliderProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel meter widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelMeter class object.
 */
export class PanelMeter extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_METER';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    let valProps = section.data;
    if(valProps.type == 'HVYM_VAL_PROP_REF'){
      valProps = valProps.val_props;
    }
    const meterProps = defaultPanelMeterProps(this.scene, panelProps.name, this.box, panelProps.textProps.font, valProps);
    this.ctrlWidget = new MeterWidget(meterProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  } 
};

/**
 * This function creates panel value meter widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelValueMeter class object.
 */
export class PanelValueMeter extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_VALUE_METER';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    let valProps = section.data;
    if(valProps.type == 'HVYM_VAL_PROP_REF'){
      valProps = valProps.val_props;
    }
    const meterProps = defaultPanelValueMeterProps(this.scene, panelProps.name, this.box, panelProps.textProps.font, valProps);
    this.ctrlWidget = new MeterWidget(meterProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel color widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelColorWidget class object.
 */
export class PanelColorWidget extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_COLOR_WIDGET';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const colorWidgetProps = defaultPanelColorWidgetProps(this.scene, panelProps.name, this.box, panelProps.textProps.font);
    this.ctrlWidget = new ColorWidget(colorWidgetProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel material color widget for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelMaterialColorWidget class object.
 */
export class PanelMaterialColorWidget extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_MATERIAL_COLOR_WIDGET';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    const matRefProps = section.data;
    this.colorWidgetProps = defaultPanelColorWidgetProps(this.scene, panelProps.name, this.box, panelProps.textProps.font);
    if(matRefProps.targetProp=='color'){
      matRefProps.useMaterialView = true;
      this.colorWidgetProps.useAlpha = true;
    }else{
      this.colorWidgetProps.useAlpha = false;
      matRefProps.useMaterialView = false;
    }
    this.colorWidgetProps.objectControlProps = matRefProps;
    this.ctrlWidget = new ColorWidget(this.colorWidgetProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel selector for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelListSelector class object.
 */
export class PanelListSelector extends PanelBox {
  constructor(panelProps) {
    panelProps.boxProps.matProps.useCase = 'STENCIL';
    super(panelProps);
    this.is = 'PANEL_LIST_SELECTOR';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    this.selectors = section.data;

    if(!dataIsHVYMWidget(this.selectors))
      return;

    const listSelectorProps = defaultPanelListSelectorProps(this.scene, panelProps.name, this.box, panelProps.textProps.font);
    this.ctrlWidget = new SelectorWidget(listSelectorProps);
    this.ctrlWidget.box.userData.hoverZPos = this.size.depth*2;
    this.ctrlWidget.AssignSelectionSet(this.selectors);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel toggle for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelToggle class object.
 */
export class PanelToggle extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_TOGGLE';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const section = panelProps.sections.data[panelProps.name];
    const sectionProps = section.data;
    let on = false;
    let toggleProps = defaultPanelBooleanToggleProps(this.scene, sectionProps.name, this.box, panelProps.textProps.font, false);
    if(sectionProps.type == 'HVYM_MESH_PROP_REF'){
      toggleProps.on = sectionProps.visible;
      toggleProps.objectControlProps = sectionProps.val_props;
    }else if(sectionProps.type == 'HVYM_ANIM_PROP'){
      toggleProps.objectControlProps = sectionProps.val_props;
    }
    
    this.ctrlWidget = new ToggleWidget(toggleProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};

/**
 * This function creates panel button for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} PanelButton class object.
 */
export class PanelButton extends PanelBox {
  constructor(panelProps) {
    super(panelProps);
    this.is = 'PANEL_BUTTON';
    this.scene = panelProps.scene;
    this.SetParentPanel();
    const buttonProps = defaultPanelButtonProps(this.scene, panelProps.name, this.box, panelProps.textProps.font)
    this.ctrlWidget = ButtonElement(buttonProps);
    this.box.userData.ctrlWidget = this.ctrlWidget;
  }
};


/**
 * This function creates a property set for panels.
 * value types: container, controls, label, edit_text, input_text, toggle, int_slider, float_slider
 * @param {string} [name='Section'] name of the panel section.
 * @param {string} [value_type='container'] use for this panel.
 * @param {object} [data={}] value data attached to the panel.
 * 
 * @returns {object} Data (panelSectionProperties)
 */
export function panelSectionProperties(name='Section', value_type='container', data={}){
  return {
    'type': 'PANEL_SECTION',
    'name': name,
    'value_type': value_type,
    'data': data
  }
};

/**
 * This function creates a default property set for material panels.
 * @param {object} material target material.
 * @param {bool} [emissive=false] if true, emissive property is exposed.
 * @param {bool} [reflective=false] if true, reflective property is exposed.
 * @param {bool} [iridescent=false] if true, iridescent property is exposed.
 * @param {bool} [sheen=false] if true, sheen property is exposed.
 * 
 * @returns {object} Data (panelSectionProperties)
 */
export function panelMaterialSectionPropertySet(material, emissive=false, reflective=false, iridescent=false, sheen=false){
  let sectionData = {};
  let matType = materialTypeConstant(material);
  let props = {}

  switch (material.type) {
    case 'MeshBasicMaterial':
      props['color'] = 'mat_color_widget';
      break;
    case 'MeshLambertMaterial':
      props['color'] = 'mat_color_widget';
      break;
    case 'MeshPhongMaterial':
      props['color'] = 'mat_color_widget';
      props['specular'] = 'mat_color_widget';
      props['shininess'] = 'mat_slider';
      break;
    case 'MeshStandardMaterial':
      props['color'] = 'mat_color_widget';
      props['roughness'] = 'mat_slider';
      props['metalness'] = 'mat_slider';
      break;
    case 'MeshPhysicalMaterial':
      props['color'] = 'mat_color_widget';
      props['roughness'] = 'mat_slider';
      props['metalness'] = 'mat_slider';
      if(reflective){
        props['ior'] = 'mat_slider';
        props['reflectivity'] = 'mat_slider';
      }
      if(iridescent){
        props['iridescence'] = 'mat_slider';
        props['iridescenceIOR'] = 'mat_slider';
      }
      if(sheen){
        props['sheen'] = 'mat_slider';
        props['sheenRoughness'] = 'mat_slider';
        props['sheenColor'] = 'mat_color_widget';
      }
      
      props['clearcoat'] = 'mat_slider';
      props['clearCoatRoughness'] = 'mat_slider';
      props['specularColor'] = 'mat_color_widget';
      break;
    case 'MeshToonMaterial':
      props['color'] = 'mat_color_widget';
      break;
    default:
      console.log('X');
  }

  if(emissive){
    props['emissive'] = 'mat_color_widget';
    props['emissiveIntensity'] = 'mat_slider';
  }

  sectionData['Material Properties'] = panelSectionProperties('Material Properties', 'label', {});

  Object.keys(props).forEach((prop, idx) => {
    let valProp = materialNumberValueProperties(material, prop);

     let matRefProp = materialRefProperties(matType, material, prop, valProp);
     let widget = props[prop];
     let i = (idx+1).toString();
     sectionData[prop] = panelSectionProperties(prop, widget, matRefProp);
  });

  return panelSectionProperties(material.name, 'controls', sectionData)
};

/**
 * This function creates a default property set for panels.
 * @param {object} materialSet Object3D that the model widget should be parented to.
 * 
 * @returns {object} Data (panelSectionProperties)
 */
export function panelMaterialSetSectionPropertySet(materialSet){
  let sectionData = {};
  let matType = undefined;
  let props = {}

  return panelSectionProperties(materialSet.name, 'controls', sectionData)
};

/**
 * This function creates a property set for panel widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name=''] name for the element.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {string} [attach='LEFT'] how the panel is attached.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {object} [sections={}] (panelSectionProperties) used to create panels.
 * @param {bool} [open=true] if true panel is open, else closed.
 * @param {bool} [expanded=true] if true panel is expanded, else collapsed.
 * @param {bool} [isSubPanel=true] identifier indicating whether panel is child of another panel.
 * @param {object} [topPanel=undefined] (Object3D) this is always set to the topmost panel element.
 * @param {object} [topCtrl=undefined] (BasePanel) if subPane, this is the hook to the parent BasePanel class.
 * @param {number} [index=0] index of the panel.
 * 
 * @returns {object} Data object for panel elements.
 */
export function panelProperties( scene, boxProps, name='Panel', textProps, attach='LEFT', sections={}, open=true, expanded=false, isSubPanel=false, topPanel=undefined, topCtrl=undefined){
  return {
    'type': 'PANEL',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'textProps': textProps,
    'attach': attach,
    'sections': sections,
    'open': open,
    'expanded': expanded,
    'isSubPanel': isSubPanel,
    'topPanel': topPanel,
    'topCtrl': topCtrl,
    'index': 0
  }
};

/**
 * This function creates a default property set for panels.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for panels.
 */
export function hvymPanelProperties(parent, font){
  let panelBoxProps = three_text.defaultPanelWidgetBoxProps('gltf-panel-box', parent);
  let panelTextProps = three_text.defaultWidgetTextProperties(font);
};

/**
 * This function creates panel elements for expandable ui elements.
 * @param {object} panelProps (panelProperties) property set.
 * 
 * @returns {object} BasePanel class object.
 */
export class BasePanel extends BaseTextBox {
  constructor(panelProps) {
    super(buttonProperties(panelProps.scene, panelProps.boxProps, panelProps.name, panelProps.value, panelProps.textProps, panelProps.mouseOver));
    this.is = 'BASE_PANEL';
    this.scene = panelProps.scene;
    this.boxProps = panelProps.boxProps;
    this.name = panelProps.name;
    this.textProps = panelProps.textProps;
    this.matProps = panelProps.boxProps.matProps;
    this.attach = panelProps.attach;
    this.sections = panelProps.sections;
    this.sectionsValueTypes = panelProps.sections.value_type;
    this.open = panelProps.open;
    this.isSubPanel = panelProps.isSubPanel;
    this.panelList = [];
    this.controlList = [];
    this.panelProps = panelProps;
    this.siblingPanel = undefined;
    this.box.userData.panelProps = this.panelProps;
    this.box.userData.panelCtrl = this;
    this.panelMaterials = [];
    this.SetParentPanel();


    if(this.isSubPanel){
      this.subPanelMaterial = panelProps.topCtrl.subPanelMaterial;
      this.ctrlPanelMaterial = panelProps.topCtrl.ctrlPanelMaterial;
      this.handleMaterial = panelProps.topCtrl.handleMaterial;
    }else{
      this.subPanelMaterial = getMaterial(this.matProps, this.matProps.stencilRef);
      darkenMaterial(this.subPanelMaterial, 10);
      this.panelMaterials.push(this.subPanelMaterial);
      this.ctrlPanelMaterial = getMaterial(this.matProps, this.matProps.stencilRef);
      darkenMaterial(this.ctrlPanelMaterial, 20);
      this.panelMaterials.push(this.ctrlPanelMaterial);
      this.handleMaterial = this.textMaterial;
      this.panelMaterials.push(this.textMaterial);
    }

    this.box.userData.properties = panelProps;
    
    this.handleExpand = this.CreateHandle(panelProps);
    this.CreateTop();
    
    this.bottom = this.CreateBottom();
    this.box.add(this.handleExpand);
    this.box.userData.handleExpand = this.handleExpand;
    this.handleExpand.userData.targetElem = this.box;
    this.handleExpand.position.set(this.width/2, this.height/2 - this.handleExpand.userData.size.height*2, this.depth/2);

    if(panelProps.topPanel == undefined){
      panelProps.topPanel = this.box;
      panelProps.topCtrl = this;
      this.handleOpen = this.CreateTopHandle();
      this.box.renderOrder = 2;
      this.bottom.box.renderOrder = 2;
    }


    if(panelProps.expanded){
      this.handleExpand.rotation.z = this.handleExpand.rotation.z+0.8;
    }

    this.handleOpen = undefined;
    this.SetUserData();

    if(panelProps.sections != undefined){
      if(this.sectionsValueTypes == 'controls'){
        this.CreateControlSections(panelProps);
      }else if(this.sectionsValueTypes == 'container'){
        this.CreateContainerSections(panelProps);
      }
    }

    const self = this;

    this.handleExpand.addEventListener('close', function(event) {
      this.userData.targetElem.userData.properties.expanded = false;
      self.scene.anims.panelAnimation(this.userData.targetElem, 'EXPAND');
      this.userData.targetElem.userData.widgetElements.forEach((widget, index) =>{
        widget.userData.boxCtrl.ToggleVisible(false);
      });
    });


    this.handleExpand.addEventListener('action', function(event) {
      this.userData.targetElem.userData.properties.expanded = !this.userData.targetElem.userData.properties.expanded;
      if(!this.userData.targetElem.userData.properties.expanded){
        this.userData.targetElem.userData.panelList.forEach((panel, idx) => {

            panel.handleExpand.dispatchEvent({type:'close'});
        });
      }
      self.scene.anims.panelAnimation(this.userData.targetElem, 'EXPAND');

      if(!this.userData.targetElem.userData.properties.expanded)
      return;

      this.userData.targetElem.dispatchEvent({type:'showWidgets'});

    });


    this.box.addEventListener('hideWidgets', function(event) {
      this.userData.handleExpand.userData.targetElem.userData.widgetElements.forEach((widget, index) =>{
        widget.userData.boxCtrl.ToggleVisible(false);
      });
    });

    this.box.addEventListener('showWidgets', function(event) {
      this.userData.handleExpand.userData.targetElem.userData.widgetElements.forEach((widget, index) =>{
        widget.userData.boxCtrl.ToggleVisible(true);
      });
    });

    if(this.isSubPanel){
      this.box.dispatchEvent({type:'hideWidgets'});
    }

  }
  CreateTopHandle() {
    const handle = this.CreateHandle();

    this.parent.add(handle);

    if(this.attach == 'CENTER'){
      handle.position.set(this.width/2, this.height/2, this.parentSize.depth+this.depth/2);
    }else if(this.attach == 'LEFT'){
      handle.position.set(-(this.parentSize.width/2), this.parentSize.height/2, this.parentSize.depth+this.depth/2);
    }else if(this.attach == 'RIGHT'){
      handle.position.set(this.parentSize.width/2, this.parentSize.height/2, -(this.parentSize.depth+this.depth/2));
    }

    if(!this.open){
      handle.rotation.z = handle.rotation.z;
    }else if(this.open){
      handle.rotation.z = handle.rotation.z+0.8;
    }

    this.box.userData.handleOpen = handle;
    handle.userData.targetElem = this.box;
    const self = this;

    handle.addEventListener('action', function(event) {
      self.scene.anims.panelAnimation(this.userData.targetElem);
    });
  }
  CreateHandle() {
    let result = undefined;
    let geometry = new THREE.OctahedronGeometry(this.height*0.2, 0);
    geometry.center();
    const size = getGeometrySize(geometry);
    result = new THREE.Mesh(geometry, this.handleMaterial);
    result.userData.offRotation = new THREE.Vector3().copy(result.rotation);
    result.userData.onRotation = new THREE.Vector3(result.rotation.x, result.rotation.y, result.rotation.z+0.8)
    result.userData.size = size;
    mouseOverUserData(result);
    this.scene.clickable.push(result);

    return result
  }
  CreateBottom(){
    let boxProps = {...this.boxProps};
    boxProps.height=boxProps.height*0.5;
    boxProps.parent = this.box;
    const result = new BaseBox(boxProps);
    let size = getGeometrySize(result.box.geometry);
    if(this.isSubPanel){
      result.box.material = this.subPanelMaterial;
    }else{
      result.box.material = this.box.material;
    }
    
    result.box.position.set(result.box.position.x, -(this.height/2+result.height/2), 0);
    this.box.add(result.box);
    result.box.userData.expandedPos = new THREE.Vector3().set(result.box.position.x, -(this.height+result.height), result.box.position.z);
    if(this.sectionsValueTypes == 'controls'){
      result.box.userData.expandedPos = new THREE.Vector3().set(result.box.position.x, -result.height, result.box.position.z);
    }
    result.box.userData.closedPos = new THREE.Vector3().copy(result.box.position);
    result.box.userData.size = size;

    return result
  }
  CreateTop(){
    if(this.attach == 'CENTER'){
      this.box.position.set(this.parentSize.width/2, this.parentSize.height/2, this.parentSize.depth);
    }else if(this.attach == 'LEFT'){
      this.boxProps.pivot = 'RIGHT';
      this.box.position.set(-(this.parentSize.width/2+this.width/2), this.parentSize.height/2-this.height/2, this.parentSize.depth);
    }else if(this.attach == 'RIGHT'){
      this.boxProps.pivot = 'LEFT';
      this.box.position.set(this.parentSize.width/2+this.width/2, this.parentSize.height/2-this.height/2, this.parentSize.depth);
    }

    if(!this.open){
      this.box.scale.set(0,0,0);
    }

    if(this.isSubPanel){
      this.box.position.copy(this.parent.position);
      this.DarkenBoxMaterial();
      this.box.userData.onPos = new THREE.Vector3(this.box.position.x, -(this.parentSize.height/2-this.height/2), this.box.position.z);
      this.box.userData.offPos = new THREE.Vector3().copy(this.box.position);
    }

  }
  static GetParentPanel(box){
    let result = undefined;

    if(box.parent.userData.panelProps!=undefined && box.parent.userData.panelCtrl!=undefined){
      result = box.parent.userData.panelCtrl;
    }

    return result
  }
  SetUserData(){
    this.box.userData.textMesh = this.textMesh;
    this.box.userData.bottom = this.bottom.box;
    this.box.userData.isSubPanel = this.isSubPanel;
    this.box.userData.sectionsValueTypes = this.sectionsValueTypes;
    this.box.userData.expandedPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.closedPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.closedHeight = this.height+this.bottom.height;
    this.box.userData.onPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.offPos = new THREE.Vector3().copy(this.box.position);
    this.box.userData.onScale = new THREE.Vector3(0,0,0).copy(this.box.scale);
    this.box.userData.offScale = new THREE.Vector3(0,0,0);
    this.box.userData.sectionCount = Object.keys(this.sections).length;
    this.box.userData.openSections = 0;
    this.box.userData.sectionElements = [];
    this.box.userData.widgetElements = [];
    this.box.userData.panelList = [];
    this.box.userData.size = getGeometrySize(this.box.geometry);
  }
  CreateControlSections(panelProps){
    let index = 1;
    let widgetHeight = undefined;
    for (const [name, sect] of Object.entries(panelProps.sections.data)) {
      let sectionProps = {...panelProps};
      sectionProps.name = name;
      sectionProps.isSubPanel = true;
      sectionProps.boxProps = defaultPanelWidgetBoxProps('panel-box-'+index.toString(), this.box);
      sectionProps.index = index;
      let ctrlBox = undefined;

      switch (sect.value_type) {
        case 'label':
          ctrlBox = new PanelLabel(sectionProps);
          break;
        case 'edit_text':
          ctrlBox = new PanelEditText(sectionProps);
          break;
        case 'input_text':
          ctrlBox = new PanelInputText(sectionProps);
          break;
        case 'boolean_toggle':
          ctrlBox = new PanelBooleanToggle(sectionProps);
          break;
        case 'slider':
          ctrlBox = new PanelSlider(sectionProps);
          break;
        case 'mat_slider':
          ctrlBox = new PanelMaterialSlider(sectionProps);
          break;
        case 'meter':
          ctrlBox = new PanelMeter(sectionProps);
          break;
        case 'gltf_meter':
          ctrlBox = new PanelGltfModelMeter(sectionProps);
          break;
        case 'value_meter':
          ctrlBox = new PanelValueMeter(sectionProps);
          break;
        case 'gltf_value_meter':
          ctrlBox = new PanelGltfModelValueMeter(sectionProps);
          break;
        case 'color_widget':
          ctrlBox = new PanelColorWidget(sectionProps);
          break;
        case 'mat_color_widget':
          ctrlBox = new PanelMaterialColorWidget(sectionProps);
          break;
        case 'gltf':
          ctrlBox = new PanelGltfModel(sectionProps);
          break;
        case 'selector':
          ctrlBox = new PanelListSelector(sectionProps);
          break;
        case 'button':
          ctrlBox = new PanelButton(sectionProps);
          break;
        case 'toggle':
          ctrlBox = new PanelToggle(sectionProps);
          break;
        default:
          console.log('X');
      }

      this.controlList.push(ctrlBox);
      this.box.userData.widgetElements.push(ctrlBox.box);

      let bottomHeight = this.bottom.height;
      let yPos =  -(this.height)*index;
      ctrlBox.ReplaceMaterial(this.ctrlPanelMaterial);
      ctrlBox.box.userData.index = index;
      ctrlBox.box.userData.expandedPos = new THREE.Vector3(ctrlBox.box.position.x, yPos, ctrlBox.box.position.z);
      ctrlBox.box.userData.closedPos = new THREE.Vector3().copy(ctrlBox.box.position);
      ctrlBox.box.renderOrder = panelProps.topPanel.renderOrder-2;
      widgetHeight = ctrlBox.box.userData.height;
      
      index += 1;
    }
    this.box.userData.widgetHeight = widgetHeight;
    this.box.userData.expandedHeight = this.height+(widgetHeight*Object.keys(this.sections.data).length)+this.bottom.height;
  }
  CreateContainerSections(panelProps){
    let index = 1;
    for (const [name, sect] of Object.entries(panelProps.sections.data)) {
      let sectionProps = {...panelProps};
      sectionProps.name = name;
      sectionProps.isSubPanel = true;
      sectionProps.boxProps.parent = panelProps.topPanel;

      sectionProps.sections = sect;
      let section = new BasePanel(sectionProps);
      section.ReplaceMaterial(this.subPanelMaterial);
      section.handleExpand.scale.set(0,0,0);
      section.box.position.set(this.width/2-section.width/2, 0, -this.depth);

      let bottom = section.box.userData.bottom;
      let bottomHeight = this.bottom.height;
      let yPos =  bottomHeight - (this.height + bottomHeight)*index;
      section.box.userData.index = index;
      section.box.userData.expandedPos.set(section.box.position.x, yPos, section.box.position.z);
      section.box.userData.closedPos = new THREE.Vector3().copy(section.box.position);
      section.box.renderOrder = panelProps.topPanel.renderOrder-1;
      section.bottom.box.renderOrder = section.box.renderOrder;
      panelProps.topPanel.userData.sectionElements.push(section.box);
      this.box.userData.panelList.push(section);
      this.panelList.push(section);
      
      index += 1;
    }
  }
};

export function CreateBasePanel(panelProps) {
  if(typeof panelProps.textProps.font === 'string'){
    // Load the font
    loader.load(panelProps.textProps.font, (font) => {
      panelProps.textProps.font = font;
      let panel = new BasePanel(panelProps);
    });
  }else if(panelProps.textProps.font.isFont){
    let panel = new BasePanel(panelProps);
  } 
  
};

/**
 * This function creates a property set for various widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name=''] name for the element.
 * @param {bool} [horizontal=true] if true toggle is horizontal, else vertical.
 * @param {bool} [on=false] if true initial state of widget is on, else off.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {bool} [useValueText=true] if true toggle has a text portal for value.
 * @param {bool} [numeric=true] the meter value is numeric.
 * @param {object} [valueProps=stringValueProperties] property set for value type of widget.
 * @param {number} [handleSize=2] size of handle on toggle.
 * @param {object} [objectControlProps=undefined] slot for object that will be updated by widget.
 * 
 * @returns {object} Data object for widget elements.
 */
export function widgetProperties(scene, boxProps, name='', horizontal=true, on=false, textProps=undefined, useValueText=true, valueProps=stringValueProperties(), listConfig=undefined, handleSize=2, objectControlProps=undefined ){
  return {
    'type': 'WIDGET',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'on': on,
    'textProps': textProps,
    'useValueText': useValueText,
    'valueProps': valueProps,
    'listConfig': listConfig,
    'handleSize': handleSize,
    'objectControlProps': objectControlProps
  }
};

/**
 * This function creates base class used by several widgets with handles.
 * @param {object} widgetProps (widgetProperties) property set.
 * 
 * @returns {object} BaseWidget class object.
 */
export class BaseWidget extends BaseBox {
  constructor(widgetProps) {
    let size = BaseWidget.CalculateWidgetSize(widgetProps.boxProps, widgetProps.horizontal, widgetProps.useValueText, widgetProps.handleSize);
    let baseBoxProps = {...widgetProps.boxProps};
    baseBoxProps.width = size.baseWidth;
    baseBoxProps.height = size.baseHeight;
    baseBoxProps.depth = size.baseDepth/2;
    super(baseBoxProps);
    this.is = 'BASE_WIDGET';
    this.isHVYM = false;
    this.objectControlProps = widgetProps.objectControlProps;
    this.zOffset = 1;
    this.value = widgetProps.valueProps.defaultValue;
    this.box.userData.horizontal = widgetProps.horizontal;
    this.box.userData.hasSubObject = widgetProps.useValueText;
    this.box.userData.properties = widgetProps;

    this.name = widgetProps.name;
    this.widgetSize = size;
    this.handleSize = 2;
    this.baseBoxProps = baseBoxProps;
    this.widgetSize = size;
    this.complexMesh = widgetProps.boxProps.complexMesh;

    this.BaseText = new BaseText(widgetProps.textProps);
    this.BaseText.SetParent(this);

    darkenMaterial(this.box.material, 20);

    if(this.isPortal){
      this.zOffset = -1;
    }

    if(this.handleSize > 0){
      this.handleMaterial = getMaterial(widgetProps.boxProps.matProps, widgetProps.boxProps.parent.material.stencilRef);
      this.handleCtrl = this.WidgetHandle();
      this.handle = this.handleCtrl.box;
      this.handle.renderOrder = 2;

      if(widgetProps.horizontal){
        this.handleCtrl.AlignLeft();
      }else{
        this.handleCtrl.AlignBottom();
      }
    }

    this.widgetText = this.WidgetText();
    if(this.widgetText!=undefined){
      this.widgetTextSize = getGeometrySize(this.widgetText.geometry);
    }
    
    BaseWidget.SetUpObjectControlProps(this);

  }
  WidgetHandle(){
    let handleBoxProps = {...this.baseBoxProps};
    handleBoxProps.parent = this.box;
    handleBoxProps.width = this.widgetSize.handleWidth;
    handleBoxProps.height = this.widgetSize.handleHeight;
    handleBoxProps.depth = this.widgetSize.handleDepth;
    this.handleZPos = this.widgetSize.baseDepth/2+this.widgetSize.handleDepth/2;

    let handle = new BaseBox(handleBoxProps);
    handle.box.material = this.handleMaterial;

    return handle
  }
  WidgetText(){
    if(this.name.length>0){
      const props = this.box.userData.properties;
      const boxProps = props.boxProps;
      const textProps = this.BaseText.textProps;

      const text = this.BaseText.NewSingleTextMesh('widgetText', this.name);
      const textSize = text.userData.size;
      const padding = this.BaseText.textProps.padding;

      this.box.add(text);
      this.BaseText.CenterTopOutsideTextPos('widgetText');

      return text
    }
  }
  CenterWidgetText(){
    let pos = this.CenterBoxPos();
    if(this.isPortal){
      pos.z = -(this.widgetTextSize.depth+this.size.depth);
    }
    this.widgetText.position.copy(pos);
  }
  Recenter(width){
    this.box.translateX(-width/2);
    this.widgetText.translateX(width/2);
  }
  DeleteWidgetText(){
    this.BaseText.DeleteTextGeometry('widgetText');
    this.box.remove(this.widgetText);
  }
  ValueText(){
    const widgetProps = {...this.box.userData.properties};
    widgetProps.boxProps.parent = this.box;
    const boxProps = widgetProps.boxProps;
    const valBox = new ValueTextWidget(widgetProps);
    darkenMaterial(valBox.box.material, 30);
    this.box.userData.valueBoxCtrl = valBox;
    this.box.userData.valueBox = valBox.box;

    this.Recenter(valBox.width);

    if(widgetProps.horizontal){
      valBox.AlignOutsideRight();
    }else{
      valBox.AlignOutsideBottom();
    }

    return valBox
  }
  UpdateMaterialRefFloatValue(value){
    if(BaseWidget.IsMaterialSliderProp(this.targetProp)){
      value = parseFloat(value)
      this.objectRef[this.targetProp] = value;
    }
    
    this.objectRef.dispatchEvent({type:'refreshMaterialViews'});
  }
  UpdateMeshRefFloatValue(value){
    if(BaseWidget.IsMorphSliderProp(this.targetProp)){
      value = parseFloat(value);
      this.objectRef.userData.hvymCtrl.UpdateMorph(this.objectControlProps, value);
    }
    
  }
  UpdateAnimRefFloatValue(value){
    if(BaseWidget.IsAnimationSliderProp(this.targetProp)){
      value = parseFloat(value);
      this.objectRef.hvymCtrl.SetAnimWeight(this.objectRef.ref, value);
    }
    
  }
  static UpdateMaterialRefColor(elem, hex, alpha=undefined){
    if(!isNaN(elem.objectRef[elem.targetProp]) && !BaseWidget.IsMaterialColorProp(this.targetProp))
      return;
    elem.objectRef[elem.targetProp].set(hex);
    if(alpha!=undefined){
      elem.objectRef.opacity = alpha;
    }
    elem.objectRef.dispatchEvent({type:'refreshMaterialViews'});
  }
  static RefreshMaterialRefs(mat){
    if(mat==undefined)
      return;
    mat.userData.materialCtrls.forEach((ctrl) =>{
      let parentPanel = ctrl.box.parent.userData.parentPanel;
      if(parentPanel!=undefined){
        parentPanel.controlList.forEach((elem) =>{
          let widget = elem.ctrlWidget;
          if(widget!=undefined && widget.RefreshMaterialView!=undefined){
            widget.RefreshMaterialView();
          }
        });
      }
    });
  }
  static ModelIndicatorBoxProps(elemProps){
    let baseBoxProps = {...elemProps.boxProps};
    let indicatorBoxProps = {...elemProps.boxProps};
    let indicatorMatProps = {...elemProps.boxProps.matProps};
    indicatorMatProps.color = 'black';
    indicatorMatProps.isPortal = true;

    indicatorMatProps.useCase = 'STENCIL'
    elemProps.boxProps.width = elemProps.boxProps.width-elemProps.boxProps.height;
    indicatorBoxProps.width = elemProps.boxProps.height;
    indicatorBoxProps.matProps = indicatorMatProps;


    return {'base': baseBoxProps, 'indicator': indicatorBoxProps};
  }
  static SetObjectRef(elem){
    elem.objectRef = elem.objectControlProps.ref;
    elem.targetProp = elem.objectControlProps.targetProp;
    elem.isHVYM = elem.objectControlProps.isHVYM;
  }
  static SetUpObjectControlProps(elem){
    if(elem.objectControlProps != undefined){
      if(elem.objectControlProps.type == 'MAT_REF'){
        BaseWidget.SetObjectRef(elem);
        elem.objectRef.userData.materialCtrls = [];
        elem.objectRef.userData.refreshCallback = BaseWidget.RefreshMaterialRefs;
        elem.objectRef.addEventListener('refreshMaterialViews', function(event) {
          elem.objectRef.userData.refreshCallback(this);
        });
      }else if(elem.objectControlProps.type == 'SET_REF'){
        elem.setRef = elem.objectControlProps.setRef;
        if(elem.objectControlProps.setType == 'MATERIAL'){

        }else if(elem.objectControlProps.setType == 'MESH'){
          
        } 
      }else if(elem.objectControlProps.type == 'MESH_REF'){
        BaseWidget.SetObjectRef(elem);
        if(elem.targetProp=='morph'){
          elem.targetMorph = elem.objectControlProps.targetMorph;
        }
      }else if(elem.objectControlProps.type.includes('ANIM')){
        elem.objectRef = elem.objectControlProps;
        elem.targetProp = elem.objectControlProps.targetProp;
        elem.isHVYM = elem.objectControlProps.isHVYM;
      }
    }
  }
  static AddModelInnerIndicator(elem, boxProps){
    elem.modelIndicator = new BaseBox(boxProps);
    elem.modelIndicator.AlignLeft();
    elem.materialView = undefined;
  }
  static AddModelOuterIndicator(elem, boxProps){
    elem.modelIndicator = new BaseBox(boxProps);
    elem.modelIndicator.AlignOutsideLeft();
    elem.materialView = undefined;
  }
  static MaterialViewMesh(parentBox, objectRef){
    let radius = parentBox.size.width/2;
    if(parentBox.size.height<parentBox.size.width){
      radius = parentBox.size.height/2;
    }
    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    const size = getGeometrySize(geometry)
    const material = shallowCloneMaterial(objectRef);
    setupStencilChildMaterial(material, parentBox.material.stencilRef);
    const sphere = new THREE.Mesh( geometry, material );

    parentBox.box.add(sphere);
    sphere.position.set(0,0,0);
    sphere.translateZ(-size.depth/2);

    return sphere
  }
  static HandleMaterialMesh(elem, useAlpha=false){
    if(elem.modelIndicator == undefined || !elem.objectControlProps.useMaterialView)
      return;

    elem.materialView = BaseWidget.MaterialViewMesh(elem.modelIndicator, elem.objectRef);
    elem.objectRef.userData.materialCtrls.push(elem);

    if(useAlpha){
      elem.materialView.material.transparent = true;
    }
  }
  static CalculateElementSizeOffset(elementSize, horizontal, boxProps){
    let bProps = {...boxProps};
    if(horizontal){
      bProps.width = bProps.width-elementSize.width;
    }else{
      bProps.height = bProps.height-elementSize.height;
    }

    return bProps
  }
  static CalculateWidgetSize(boxProps, horizontal, useSubObject, operatorSizeDivisor, defaultSubOffset=0.65){
    let subOffset = 1;
    if(useSubObject){
      subOffset = defaultSubOffset;
    }
    let baseWidth = boxProps.width*subOffset;
    let baseHeight = boxProps.height;
    let baseDepth=boxProps.depth/2;
    let handleWidth=boxProps.width/operatorSizeDivisor*subOffset;
    let handleHeight=boxProps.height;
    let handleDepth=boxProps.depth;
    let subWidth=baseWidth*(1-1*subOffset);
    let subHeight=baseHeight;
    let subDepth=baseDepth;

    if(horizontal==false){
      baseWidth = boxProps.width;
      baseHeight = boxProps.height*subOffset;
      handleWidth=boxProps.width;
      handleHeight=boxProps.height/operatorSizeDivisor*subOffset;
      subWidth=baseWidth;
      subHeight=baseHeight*(1-1*subOffset);
      subDepth=baseDepth;
    }

    return {baseWidth, baseHeight, baseDepth, handleWidth, handleHeight, handleDepth, subWidth, subHeight, subDepth}
  }
  static IsMaterialColorProp(prop){
    return (prop == 'color' || prop == 'specular' || prop == 'emissive')
  }
  static IsMaterialSliderProp(prop){
    return (prop == 'shininess' || prop == 'roughness' || prop == 'metalness' || prop == 'clearcoat' || prop == 'clearCoatRoughness' || prop == 'emissiveIntensity'|| prop == 'ior' || prop == 'reflectivity' || prop == 'iridescence' || prop == 'sheen' || prop == 'sheenRoughness' || prop == 'specularIntensity')
  }
  static IsMaterialPBRSliderProp(prop){
    return (prop == 'roughness' || prop == 'metalness' || prop == 'clearcoat' || prop == 'clearCoatRoughness' || prop == 'ior' || prop == 'reflectivity' || prop == 'iridescence' || prop == 'sheen' || prop == 'sheenRoughness' || prop == 'specularIntensity')
  }
  static IsMorphSliderProp(prop){
    return (prop == 'morph')
  }
  static IsAnimationSliderProp(prop){
    return (prop == 'animation')
  }
};

/**
 * This function creates a number value property set.
 * @param {number} [defaultvalue=0] default numeric value.
 * @param {number} [min=0] minimum value.
 * @param {number} [max=1] maximum value.
 * @param {number} [places=3] number of place values used in number.
 * @param {number} [step=0.001] decimal places that numbers use.
 * @param {bool} [editable=true] if true, number text is editable.
 * 
 * @returns {object} Data object for number values.
 */
export function numberValueProperties( defaultValue=0, min=0, max=1, places=3, step=0.001, editable=true){
  return {
    'type': 'NUMBER_VALUE_PROPS',
    'defaultValue': defaultValue,
    'min': min,
    'max': max,
    'places': places,
    'step': step,
    'editable': editable
  }
};

/**
 * This function creates a number value property set for static integers.
 * @param {number} [defaultvalue=0] default numeric value.
 * @param {number} [min=0] minimum value.
 * @param {number} [max=1] maximum value.
 * 
 * @returns {object} Data object for integer values.
 */
export function intValueProperties( defaultValue=0, min=0, max=1){
  return numberValueProperties( defaultValue, min, max, 0, 0.001, false)
};

/**
 * This function creates a number value property set for editable integers.
 * @param {number} [defaultvalue=0] default numeric value.
 * @param {number} [min=0] minimum value.
 * @param {number} [max=1] maximum value.
 * 
 * @returns {object} Data object for integer values.
 */
export function intValuePropertiesEditable( defaultValue=0, min=0, max=1){
  return numberValueProperties( defaultValue, min, max, 0, 0.001, true)
};

/**
 * This function creates a number value property set for floats.
 * @param {number} [defaultvalue=0] default numeric value.
 * @param {number} [min=0] minimum value.
 * @param {number} [max=1] maximum value.
 * 
 * @returns {object} Data object for float values.
 */
export function floatValueProperties( defaultValue=0, min=0, max=1){
  return numberValueProperties( defaultValue, min, max, 3, 0.001, false)
};

/**
 * This function creates a number value property set for editable floats.
 * @param {number} [defaultvalue=0] default numeric value.
 * @param {number} [min=0] minimum value.
 * @param {number} [max=1] maximum value.
 * 
 * @returns {object} Data object for float values.
 */
export function floatValuePropertiesEditable( defaultValue=0, min=0, max=1){
  return numberValueProperties( defaultValue, min, max, 3, 0.001, true)
};

/**
 * This function creates a number value property set for materials.
 * @param {object} material object.
 * @param {string} prop target property in the material.
 * 
 * @returns {object} Data object for float values.
 */
export function materialNumberValueProperties(material, prop){
  let result = undefined;

  if(BaseWidget.IsMaterialColorProp(prop)){
    result = numberValueProperties( material[prop], 0, 255, 0, 0.001, false);
  }else if (BaseWidget.IsMaterialSliderProp(prop)){
    result = numberValueProperties( material[prop], 0, 100, 3, 0.001, false);
    if(BaseWidget.IsMaterialPBRSliderProp(prop)){
      result = numberValueProperties( material[prop], 0, 1, 3, 0.001, false);
      if(prop == 'ior' || prop == 'iridescenceIOR'){
        result = numberValueProperties( material[prop], 1, 2.33, 3, 0.001, false);
      }
    }
  }

  return result
}

/**
 * This function creates a value text widget based on passed property set.
 * @param {object} widgetProps (widgetProperties) property set.
 * 
 * @returns {object} ValueTextWidget class object.
 */
export class ValueTextWidget extends BaseTextBox{
  constructor(widgetProps) {
    let valBoxProps = {...widgetProps.boxProps};
    valBoxProps.isPortal = true;
    let textProps = widgetProps.textProps;
    textProps.align = 'CENTER';
    let valMatProps = materialProperties('BASIC', widgetProps.textProps.matProps.color, false, 1, THREE.FrontSide, 'STENCIL');
    let size = BaseWidget.CalculateWidgetSize(widgetProps.boxProps, widgetProps.horizontal, widgetProps.useValueText);
    let defaultVal = widgetProps.valueProps.defaultValue.toString();

    valBoxProps.matProps = valMatProps;

    if(widgetProps.horizontal){
      valBoxProps.height=widgetProps.boxProps.height;
      valBoxProps.width=size.subWidth;
    }else{
      valBoxProps.height=size.subHeight;
      valBoxProps.width=widgetProps.boxProps.width;
    }
    super(buttonProperties(widgetProps.scene, valBoxProps, defaultVal, widgetProps.value, textProps, false));
    this.is = 'VALUE_TEXT_WIDGET';
    this.scene = widgetProps.scene;
    this.widgetSize = size;
    this.numeric = widgetProps.numeric;
    this.places = widgetProps.valueProps.places;
    this.steps = widgetProps.valueProps.steps;
    if(this.numeric){
      this.min = widgetProps.valueProps.min;
      this.max = widgetProps.valueProps.max;
    }
    this.box.userData.targetElem = this;

    darkenMaterial(this.box.material, 30);

    if(widgetProps.valueProps.editable){
      this.EditableSetup();
    }

    this.box.addEventListener('update', function(event) {
      this.userData.targetElem.UpdateValueText();
    });

  }
  SetValueText(val){
    if(this.box.parent.userData.value == undefined)
      return;

    if(this.numeric){
      if(!this.NumericValueValid(val))
        return;
      this.box.parent.userData.value = val;

    }else{
      this.box.parent.userData.value = val;
    }
    this.UpdateValueText();
    this.box.parent.dispatchEvent({type:'update'});
  }
  UpdateValueText(){
    if(this.box.parent.userData.value == undefined)
      return;
    if(this.numeric){
      this.box.parent.userData.value = Number.parseFloat(this.box.parent.userData.value).toFixed(this.places);
    }
    this.UpdateText(this.box.parent.userData.value.toString());
    this.box.dispatchEvent({type:'onValueUpdated'});
  }
  EditableSetup(){
    this.scene.inputPrompts.push(this.textMesh);
    const textProps = this.box.userData.properties.textProps;
    const tProps = editTextProperties(this, '', this.textMesh, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, false, textProps.meshProps);
    this.textMesh.userData.textProps = tProps;
    this.box.userData.mouseOverParent = true;
    this.box.userData.currentText = '';
    this.textMesh.userData.numeric = this.box.userData.properties.numeric;
    this.textMesh.widget = this;
    this.scene.mouseOverable.push(this.box);
    mouseOverUserData(this.textMesh);
  }
  NumericValueValid(val){
    let result = true;
    if(val < this.min && val > this.max){
      result = false;
    }
    if(isNaN(val)){
      result = false;
    }

    return result
  }

}

/**
 * This function creates a property set slider widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name=''] name for the element.
 * @param {bool} [horizontal=true] if true toggle is horizontal, else vertical.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {bool} [useValueText=true] if true toggle has a text portal for value.
 * @param {bool} [numeric=true] the meter value is numeric.
 * @param {object} [valueProps=numberValueProperties] property set for value type of meter widget.
 * @param {number} [handleSize=8] size of handle on toggle.
 * @param {bool} [draggable=true] if true, widgets hadles are draggable.
 * @param {object} [objectControlProps=undefined] slot for object that will be updated by widget.
 * 
 * @returns {object} Data object for slider elements.
 */
export function sliderProperties(scene, boxProps, name='', horizontal=true, textProps=undefined, useValueText=true, numeric=true, valueProps=numberValueProperties(), handleSize=8, objectControlProps=undefined){
  return {
    'type': 'SLIDER',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'textProps': textProps,
    'useValueText': useValueText,
    'numeric': numeric,
    'valueProps': valueProps,
    'handleSize': handleSize,
    'draggable': true,
    'objectControlProps': objectControlProps
  }
};

/**
 * This function creates a default property set for slider widgets, used in panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * @param {object} valueProps value property object used by widget.
 * 
 * @returns {object} Data object for slider elements, used in panels.
 */
export function defaultPanelSliderProps(scene, name, parent, font, valueProps){
  const boxProps = defaultPanelSliderBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  return sliderProperties(scene, boxProps, name, true, textProps, true, true, valueProps)
};

/**
 * This function creates a slider widget based on passed property set.
 * @param {object} widgetProps (widgetProperties) property set.
 * 
 * @returns {object} SliderWidget class object.
 */
export class SliderWidget extends BaseWidget {
  constructor(widgetProps) {
    widgetProps.textProps.align = 'LEFT';
    super(widgetProps);
    this.is = 'SLIDER_WIDGET';
    this.scene = widgetProps.scene;
    if(widgetProps.valueProps.editable){
      this.scene.draggable.push(this.handle);
    }
    
    if(this.box.userData.hasSubObject){
      this.valueTextBox = this.ValueText(this, widgetProps.boxProps, widgetProps, this.size.baseWidth, this.size.baseHeight);
      this.valueTextBox.box.userData.updateValTargetElem = this;

      this.valueTextBox.box.addEventListener('onValueUpdated', function(event) {

      });
    }

    this.SetSliderUserData();
    
    if(this.objectControlProps != undefined){
      if(this.objectControlProps.type == 'MAT_REF'){
        if(BaseWidget.IsMaterialSliderProp(this.targetProp)){
          this.box.userData.valueBoxCtrl.SetValueText(this.objectRef[this.targetProp]);
          this.objectRef.userData.materialCtrls.push(this);
        }
      }
    }

    this.handle.addEventListener('action', function(event) {
      this.userData.targetElem.OnSliderMove();
    });

    this.box.addEventListener('update', function(event) {
      this.userData.targetElem.UpdateSliderPosition();
    });

    this.UpdateSliderPosition();

  }
  SetValue(value){
    value = parseFloat(value);
    this.box.userData.value = value;
    this.value = value;
    this.UpdateMaterialRefFloatValue(value);
    this.box.dispatchEvent({type:'update'});
  }
  SetSliderUserData(){
    let sliderProps = this.box.userData.properties;
    let size = BaseWidget.CalculateWidgetSize(sliderProps.boxProps, sliderProps.horizontal, sliderProps.useValueText, 8);

    this.box.userData.type = 'SLIDER';
    this.box.userData.size = {'width': size.baseWidth, 'height': size.baseHeight, 'depth': size.baseDepth};
    this.box.userData.handle = this.handle;
    this.box.userData.horizontal = sliderProps.horizontal;
    this.box.userData.valueProps = sliderProps.valueProps;
    this.box.userData.value = sliderProps.valueProps.defaultValue;
    this.box.normalizedValue = sliderProps.valueProps.defaultValue;
    this.box.userData.targetElem = this;

    this.handle.userData.type = 'SLIDER';
    this.handle.userData.size = {'width': size.handleWidth, 'height': size.handleHeight, 'depth': size.handleDepth};
    this.handle.userData.horizontal = sliderProps.horizontal;
    this.handle.userData.min = sliderProps.valueProps.min;
    this.handle.userData.max = sliderProps.valueProps.max;
    this.handle.userData.places = sliderProps.valueProps.places;


    if(sliderProps.horizontal){
      this.handle.userData.maxScroll = this.handle.position.x + (size.baseWidth-size.handleWidth);
      this.handle.userData.minScroll = -size.baseWidth+(this.handle.userData.maxScroll+size.handleWidth);
    }else{
      this.handle.userData.maxScroll = this.handle.position.y + (size.baseHeight-size.handleHeight);
      this.handle.userData.minScroll = -size.baseHeight+(this.handle.userData.maxScroll+size.handleHeight);
    }

    this.handle.userData.draggable = true;
    this.handle.userData.targetElem = this;
  }
  SliderValue(){
    let coord = 'x';
    let divider = (this.box.userData.size.width-this.handle.userData.size.width);

    if(!this.handle.userData.horizontal){
      coord = 'y';
      divider = (this.box.userData.size.height-this.handle.userData.size.height);
    }

    let pos = this.handle.position[coord];
    let minScroll = this.handle.userData.minScroll;
    let max = this.handle.userData.max;
    let min = this.handle.userData.min;

    let value = (pos-minScroll)/divider*max;

    if(this.handle.userData.min<0){
      value = ((pos-minScroll)/divider*(max-min))+min;
    }

    this.UpdateNormalizedValue();

    return value.toFixed(this.handle.userData.places);
  }
  OnSliderMove(){
    let value = this.SliderValue();
    this.box.userData.value = value;
    this.value = value;

    if(BaseWidget.IsMaterialSliderProp(this.targetProp)){
      this.UpdateMaterialRefFloatValue(value);
    }else if(BaseWidget.IsMorphSliderProp(this.targetProp)){
      this.UpdateMeshRefFloatValue(value);
    }else if(BaseWidget.IsAnimationSliderProp(this.targetProp)){
      this.UpdateAnimRefFloatValue(value);
    }

    if(this.box.userData.valueBox != undefined){
      this.box.userData.valueBox.currentText = this.box.userData.value;
    }

    if(this.box.userData.valueBox != undefined){
      this.box.userData.valueBox.dispatchEvent({type:'update'});
    }

  }
  UpdateSliderPosition(){
    let minScroll = this.handle.userData.minScroll;
    let maxScroll = this.handle.userData.maxScroll;
    let max = this.handle.userData.max;
    let min = this.handle.userData.min;
    let value = this.box.userData.value;
    this.UpdateNormalizedValue();
    if(value>max){
      this.box.userData.value = max;
      value = max;
    }else if(value<min){
      this.box.userData.value = min;
      value = min;
    }
    if(isNaN(value))
      return;

    let coord = 'x';
    let divider = (this.box.userData.size.width-this.handle.userData.size.width);

    if(!this.handle.userData.horizontal){
      coord = 'y';
      divider = (this.box.userData.size.height-this.handle.userData.size.height);
    }

    let vec = ((value-min)/(max-min))*divider+minScroll;
    let pos = new THREE.Vector3(this.handle.position.x, vec, this.handle.position.z);

    if(this.box.userData.horizontal){
      pos.set(vec, this.handle.position.y, this.handle.position.z);
    }

    this.handle.position.copy(pos);
  }
  UpdateNormalizedValue(){
    let max = this.handle.userData.max;
    let min = this.handle.userData.min;
    let value = this.box.userData.value;
    this.box.normalizedValue = (value-min)/(max-min);
    this.box.userData.normalizedValue = this.box.normalizedValue;
  }
};

/**
 * This function creates a property set toggle widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name=''] name for the element.
 * @param {bool} [horizontal=true] if true toggle is horizontal, else vertical.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {bool} [useValueText=true] if true toggle has a text portal for value.
 * @param {bool} [numeric=true] the meter value is numeric.
 * @param {object} [valueProps=numberValueProperties] property set for value type of meter widget.
 * @param {number} [handleSize=8] size of handle on toggle.
 * @param {bool} [draggable=true] if true, widgets hadles are draggable.
 * @param {string} [meterColor=SECONDARY_COLOR_A] color of meter.
 * 
 * @returns {object} Data object for toggle elements.
 */
export function meterProperties(scene, boxProps, name='', horizontal=true, textProps=undefined, useValueText=true, numeric=true, valueProps=numberValueProperties(), handleSize=8, draggable=true, meterColor=SECONDARY_COLOR_A){
  return {
    'type': 'METER',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'textProps': textProps,
    'useValueText': useValueText,
    'numeric': numeric,
    'valueProps': valueProps,
    'handleSize': handleSize,
    'draggable': draggable,
    'meterColor': meterColor
  }
};

/**
 * This function creates a default property set for color widgets, used in panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * @param {object} valueProps value property object used by widget.
 * 
 * @returns {object} Data object for color elements, used in panels.
 */
export function defaultPanelMeterProps(scene, name, parent, font, valueProps){
  const boxProps = defaultPanelSliderBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  return meterProperties(scene, boxProps, name, true, textProps, false, true, valueProps)
};

/**
 * This function creates a default property set for color widgets with value text, used in panels.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * @param {object} valueProps value property object used by widget.
 * 
 * @returns {object} Data object for color elements, used in panels.
 */
export function defaultPanelValueMeterProps(scene, name, parent, font, valueProps){
  const boxProps = defaultPanelSliderBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  return meterProperties(scene, boxProps, name, true, textProps, true, true, valueProps)
};

/**
 * This function creates a meter widget based on passed property set.
 * @param {object} widgetProps (widgetProperties) property set.
 * 
 * @returns {object} MeterWidget class object.
 */
export class MeterWidget extends SliderWidget {
  constructor(widgetProps) {
    super(widgetProps);
    this.is = 'METER_WIDGET';
    const meterBoxProps = {...widgetProps.boxProps}
    let meterMatProps = {...widgetProps.boxProps.matProps}
    meterMatProps.color = widgetProps.meterColor;
    meterBoxProps.width = this.box.userData.size.width;
    meterBoxProps.height = this.box.userData.size.height;
    meterBoxProps.pivot = 'LEFT';
    meterBoxProps.matProps = meterMatProps;
    if(!widgetProps.horizontal){
      meterBoxProps.pivot = 'BOTTOM';
    }
    meterBoxProps.parent = this.box;

    this.meter = new BaseBox(meterBoxProps);

    if(this.box.userData.horizontal){
      this.meter.AlignLeft();
    }else{
      this.meter.AlignBottom();
    }

    this.handle.material.visible=false;
    this.handle.userData.meterElem = this;
    this.box.userData.meterElem = this;

    this.handle.scale.x = this.handle.scale.x*2;

    this.handle.addEventListener('action', function(event) {
      this.userData.meterElem.UpdateMeter();
    });

    this.box.addEventListener('update', function(event) {
      this.userData.meterElem.UpdateMeter();
    });

    this.UpdateMeter();
  }
  UpdateMeter(){
    if(this.box.userData.horizontal){
      this.meter.box.scale.set(this.box.normalizedValue, this.meter.box.scale.y, this.meter.box.scale.z);
    }else{
      this.meter.box.scale.set(this.meter.box.scale.x, this.box.normalizedValue, this.meter.box.scale.z);
    }
  }
  SetMeterColor(color){
    this.meter.material.color = color;
  }

};

export function createMeterPortal(meterProps) {
  meterProps.boxProps.isPortal = true;
  createMeter(meterProps);
};

export function createMeter(meterProps) {
  if(typeof meterProps.textProps.font === 'string'){
    // Load the font
    loader.load(meterProps.textProps.font, (font) => {
      meterProps.textProps.font = font;
      new MeterWidget(meterProps);

    });
  }else if(meterProps.textProps.font.isFont){
    new MeterWidget(meterProps);
  }
};

/**
 * This function creates a property set toggle widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name=''] name for the element.
 * @param {bool} [horizontal=true] if true toggle is horizontal, else vertical.
 * @param {bool} [defaultColor='#ffffff'] if true initial state of widget is toggled(on), else off.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {bool} [useValueText=true] if true toggle has a text portal for value.
 * @param {bool} [useAlpha=true] alpha property of color is set by widget.
 * @param {bool} [draggable=true] if true, widgets hadles are draggable.
 * @param {number} [alpha=100] Alpha value.
 * @param {bool} [meter=false] if true, slider elements use meter bars, instead of handles.
 * @param {string} [colorValueType='hex'] value type generated by widget.
 * @param {object} [objectControlProps=undefined] slot for object that will be updated by widget.
 * 
 * @returns {object} Data object for toggle elements.
 */
export function colorWidgetProperties(scene, boxProps, name='', horizontal=true, defaultColor='#ffffff', textProps=undefined, useValueText=true, useAlpha=true, draggable=true, alpha=100, meter=true, colorValueType='hex', objectControlProps=undefined ){
  return {
    'type': 'COLOR_WIDGET',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'defaultColor': defaultColor,
    'textProps': textProps,
    'useValueText': useValueText,
    'valueProps': numberValueProperties( 0, 0, 1, 0, 0.001, true),
    'useAlpha': useAlpha,
    'handleSize': 0,
    'draggable': draggable,
    'alpha': alpha,
    'meter': meter,
    'colorValueType': colorValueType,
    'objectControlProps': objectControlProps
  }
};

/**
 * This function creates a default property set for color widgets.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for color elements.
 */
export function defaultPanelColorWidgetProps(scene, name, parent, font){
  const boxProps = defaultPanelColorWidgetBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  return colorWidgetProperties(scene, boxProps, name, true, '#ffffff', textProps)
};

/**
 * This function creates a color widget based on passed property set.
 * @param {object} widgetProps (widgetProperties) property set.
 * 
 * @returns {object} ColorWidget class object.
 */
export class ColorWidget extends BaseWidget {
  constructor(widgetProps) {
    let colorWidgetProps = ColorWidget.ColorWidgetProps(widgetProps);
    if(!widgetProps.boxProps.matProps.transparent){
      widgetProps.useAlpha = false;
    }
    super(colorWidgetProps.base);
    this.is = 'COLOR_WIDGET';
    this.scene = widgetProps.scene;
    this.value = widgetProps.defaultColor;
    this.isMeter = widgetProps.meter;

    this.colorManipulator = MeterWidget;
    if(!this.isMeter){
      this.colorManipulator = SliderWidget;
    }

    colorWidgetProps = this.InitColorWidgetProps(colorWidgetProps)
    this.useAlpha = colorWidgetProps.base.useAlpha;
    this.redSlider = new this.colorManipulator(colorWidgetProps.red);
    this.greenSlider = new this.colorManipulator(colorWidgetProps.green);
    this.blueSlider = new this.colorManipulator(colorWidgetProps.blue);
    this.sliders = [this.redSlider, this.greenSlider, this.blueSlider];

    if(widgetProps.useAlpha){
      this.alphaSlider = new this.colorManipulator(colorWidgetProps.alpha);
      this.sliders.push(this.alphaSlider);
    }
    BaseWidget.AddModelInnerIndicator(this, colorWidgetProps.indicator);

    if(this.objectControlProps != undefined){
      if(this.objectControlProps.type == 'MAT_REF'){
        this.value = '#'+this.objectRef[this.targetProp].getHexString();
        this.box.userData.value = this.value;
        let alpha = this.objectRef[this.targetProp].opacity;
        let color = colorsea(this.value, alpha).rgba();

        this.sliders.forEach((slider, index) =>{
          slider.box.userData.valueBoxCtrl.SetValueText(color[index]);
        });

        BaseWidget.HandleMaterialMesh(this, this.useAlpha);

        if(this.useAlpha){
          this.alphaSlider.box.userData.valueBoxCtrl.SetValueText(color[3]);
        }

        this.UpdateColor();
      }
    }

    this.sliders.forEach((slider, index) =>{
      let pos = slider.TopCenterBoxPos();
      pos.y = pos.y-(slider.size.height*index);
      slider.box.position.copy(pos);
      slider.CenterWidgetText();
      slider.box.userData.targetColorElem = this;
      slider.handle.userData.targetColorElem = this;
      slider.valueTextBox.box.userData.targetColorElem = this;

      if(widgetProps.meter){
        slider.DeleteWidgetText();
      }

      slider.handle.addEventListener('action', function(event) {
        this.userData.targetColorElem.UpdateColor();
      });
      slider.valueTextBox.box.addEventListener('onValueUpdated', function(event) {
        this.userData.targetColorElem.UpdateColor();
      });
    });

  }
  CurrentColor(){
    let rgb = [this.redSlider.value, this.greenSlider.value, this.blueSlider.value];
    let alpha = 100;
    if(this.useAlpha){
      alpha = this.alphaSlider.value;
    }

    return colorsea(rgb, alpha);
  }
  UpdateColor(){
    let alpha = 100;
    this.UpdateSliderValues();
    let color = this.CurrentColor();
    if(this.useAlpha){
      alpha = this.alphaSlider.value;
    }

    if(this.objectRef != undefined && this.objectControlProps.type == 'MAT_REF'){
      BaseWidget.UpdateMaterialRefColor(this, color.hex(), alpha);
      this.UpdateMaterialView(color.hex(), alpha);
      if(this.materialView==undefined){
        this.UpdateColorIndicator(color.hex(), alpha);
      }
    }else{
      this.UpdateColorIndicator(color.hex(), alpha);
    }
  }
  UpdateSliderValues(){
    this.sliders.forEach((slider, index) =>{
      slider.value = slider.box.userData.value;
    });
    if(this.useAlpha){
      this.alphaSlider.value = this.alphaSlider.box.userData.value;
    }
  }
  UpdateColorIndicator(hex, alpha=undefined){
    this.modelIndicator.SetColor(hex);
    if(alpha!=undefined){
      this.modelIndicator.SetOpacity(alpha*0.01);
    }
  }
  UpdateMaterialView(hex, alpha=undefined){
    if(this.materialView==undefined)
      return;
    this.materialView.material[this.targetProp].set(hex);
    if(alpha!=undefined){
      this.materialView.material.opacity = alpha*0.01;
    }
  }
  RefreshMaterialView(){
    let color = this.CurrentColor();
    if(this.materialView==undefined)
      return;
    Object.keys(this.materialView.material).forEach((prop, idx) => {
      if(BaseWidget.IsMaterialSliderProp(prop) || BaseWidget.IsMaterialColorProp(prop)){
        this.materialView.material[prop] = this.objectRef[prop];
      }
    });
  }
  InitColorWidgetProps(sliderWidgetProps){
    let colors = ['red', 'blue', 'green'];
    let boxMatProps = ColorWidget.SliderMatProps(sliderWidgetProps.base);
    let valProps = ColorWidget.SliderValueProps(sliderWidgetProps.base);
    let sliderHeight = 0.25;
    if(!sliderWidgetProps.base.useAlpha){
      sliderHeight = 0.33;
    }else{
      colors.push('alpha');
    }
    let sliderBoxProps = {...sliderWidgetProps.base.boxProps};
    sliderBoxProps.width = sliderBoxProps.width*0.54;
    sliderBoxProps.height = sliderBoxProps.height*sliderHeight;

    colors.forEach((color, index) =>{
      sliderWidgetProps[color].name = color;
      sliderWidgetProps[color].meterColor = color;
      sliderWidgetProps[color].valueProps = valProps[color];
      sliderWidgetProps[color].boxProps.isPortal = true;
      sliderWidgetProps[color].boxProps = {...sliderBoxProps};
      sliderWidgetProps[color].boxProps.matProps = boxMatProps[color];
      sliderWidgetProps[color].boxProps.parent = this.box;
    });

    sliderWidgetProps['indicator'].parent = this.box;
    sliderWidgetProps['indicator'].isPortal = true;
    sliderWidgetProps['indicator'].matProps = boxMatProps['indicator'];

    return sliderWidgetProps
  }
  static ColorWidgetProps(widgetProps){
    let props = {...widgetProps};
    let indicatorBoxProps = {...widgetProps.boxProps};
    widgetProps.boxProps.width = widgetProps.boxProps.width*1.3;
    indicatorBoxProps.width = indicatorBoxProps.width*0.18;
    props.handleSize = 8;
    const redProps = {...props};
    const greenProps = {...props};
    const blueProps = {...props};
    const alphaProps = {...props};

    alphaProps.valueProps = numberValueProperties( 100, 0, 100, 0, 0.001, true);

    if(alphaProps.objectControlProps!=undefined && alphaProps.objectControlProps.type == 'MAT_REF'){
      alphaProps.objectControlProps.valueProps = numberValueProperties( 100, 0, 100, 0, 0.001, true);
    }

    return {'base': widgetProps, 'red': redProps, 'blue': blueProps, 'green': greenProps, 'alpha': alphaProps, 'indicator': indicatorBoxProps};
  }
  static SliderMatProps(widgetProps){
    let col = colorsea(widgetProps.defaultColor, 100);
    let boxMatProps = {...widgetProps.boxProps.matProps};
    let redMatProps = {...boxMatProps};
    redMatProps.color = 'red';
    let greenMatProps = {...boxMatProps};
    greenMatProps.color = 'green';
    let blueMatProps = {...boxMatProps};
    blueMatProps.color = 'blue';
    let indicatorMatProps = {...boxMatProps};
    indicatorMatProps.color = widgetProps.defaultColor;
    if(widgetProps.objectControlProps!=undefined && widgetProps.objectControlProps.useMaterialView){
      indicatorMatProps.color = 'black';
    }
    indicatorMatProps.useCase = 'STENCIL';
    let props = {'red': redMatProps, 'blue': blueMatProps, 'green': greenMatProps, 'indicator': indicatorMatProps};
    if(widgetProps.useAlpha){
      let alphaMatProps = {...boxMatProps};
      alphaMatProps.color = 'gray';
      props = {'red': redMatProps, 'blue': blueMatProps, 'green': greenMatProps, 'alpha': alphaMatProps, 'indicator': indicatorMatProps};
    }

    return props;
  }
  static SliderValueProps(widgetProps){
    let col = colorsea(widgetProps.defaultColor, widgetProps.alpha);
    let rgba = col.rgba();
    let redValProps = numberValueProperties( rgba[0], 0, 255, 0, 0.001, true);
    let greenValProps = numberValueProperties( rgba[1], 0, 255, 0, 0.001, true);
    let blueValProps = numberValueProperties( rgba[2], 0, 255, 0, 0.001, true);
    let alphaValProps = numberValueProperties( rgba[3], 0, 100, 0, 0.001, true);

    let props = {'red': redValProps, 'blue': blueValProps, 'green': greenValProps};

    if(widgetProps.useAlpha){
      props = {'red': redValProps, 'blue': blueValProps, 'green': greenValProps, 'alpha': alphaValProps};
    }

    return props
  }

};

/**
 * This function creates a color (inset inside of parent, 
 * rendered using stencil ref)widget based on passed property set.
 * @param {object} colorWidgetProps (colorWidgetProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
export function createColorWidget(colorWidgetProps) {
  colorWidgetProps.useValueText = true;
  if(typeof colorWidgetProps.textProps.font === 'string'){
    // Load the font
    loader.load(colorWidgetProps.textProps.font, (font) => {
      colorWidgetProps.textProps.font = font;
      new ColorWidget(colorWidgetProps);
    });
  }else if(colorWidgetProps.textProps.font.isFont){
    new ColorWidget(colorWidgetProps);
  }
};

/**
 * This function creates a color portal(inset inside of parent, 
 * rendered using stencil ref)widget based on passed property set.
 * @param {object} colorWidgetProps (colorWidgetProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
export function createColorWidgetPortal(colorWidgetProps) {
  colorWidgetProps.useValueText = true;
  colorWidgetProps.boxProps.isPortal = true;
  createColorWidget(colorWidgetProps);
};

/**
 * This function creates string value property set for toggle widgets.
 * @param {string} [defaultValue='Off'] default value of widget.
 * @param {string} [onValue='On'] on value of widget.
 * @param {string} [offValue='On'] off value of widget.
 * @param {bool} [editable=false] if true attached text element is editable.
 * 
 * @returns {object} Data value property object for toggle elements.
 */
export function stringValueProperties(defaultValue='Off', onValue='On', offValue='Off', editable=false){
  return {
    'type': 'STRING_VALUE_PROPS',
    'defaultValue': defaultValue,
    'onValue': onValue,
    'offValue': offValue,
    'editable': editable
  }
};

/**
 * This function creates a property set toggle widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} [name=''] for the element.
 * @param {bool} [horizontal=true] if true toggle is horizontal, else vertical.
 * @param {bool} [on=false] if true initial state of widget is toggled(on), else off.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {bool} useValueText if true toggle has a text portal for value.
 * @param {object} [valueProps=stringValueProperties] property set for value type of toggle widget.
 * @param {number} [handleSize=2] size of handle on toggle.
 * @param {object} [objectControlProps=undefined] slot for object that will be updated by widget.
 * 
 * @returns {object} Data object for toggle elements.
 */
export function toggleProperties(scene, boxProps, name='', horizontal=true, on=false, textProps=undefined, useValueText=true, valueProps=stringValueProperties(), handleSize=2, objectControlProps=undefined ){
  return {
    'type': 'TOGGLE',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'horizontal': horizontal,
    'on': on,
    'textProps': textProps,
    'useValueText': useValueText,
    'valueProps': valueProps,
    'handleSize': handleSize,
    'objectControlProps': objectControlProps
  }
};

/**
 * This function creates a default property set for toggle widgets.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * @param {bool} [on=false] initial toggled state of widget.
 * 
 * @returns {object} Data object for toggle elements.
 */
export function defaultPanelBooleanToggleProps(scene, name, parent, font, on=false){
  const boxProps = defaultPanelToggleBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  return toggleProperties(scene, boxProps, name, true, on, textProps);
}

/**
 * This function creates a toggle widget based on passed property set.
 * @param {object} widgetProps (widgetProperties) property set.
 * 
 * @returns {object} ToggleWidget class object.
 */
export class ToggleWidget extends BaseWidget {
  constructor(widgetProps) {

    super(widgetProps);
    this.is = 'TOGGLE_WIDGET';
    this.scene = widgetProps.scene;
    this.on = widgetProps.on;
    
    if(this.box.userData.hasSubObject){
      this.ValueText(this, widgetProps.boxProps, widgetProps, this.size.baseWidth, this.size.baseHeight)
    }
    this.setToggleUserData();

    if(widgetProps.horizontal){
      this.handle.userData.onPos = this.handleCtrl.RightCenterBoxPos();
    }else{
      this.handle.userData.onPos = this.handleCtrl.TopCenterBoxPos();
    }

    this.scene.toggles.push(this.handle);

    if(widgetProps.valueProps.defaultValue == widgetProps.valueProps.onValue){
      this.handle.position.copy(this.handle.userData.onPos);
      this.handle.userData.on = true;
    }

    if(this.box.userData.valueBox != undefined){
      this.box.userData.valueBox.dispatchEvent({type:'update'});
    }
    const self = this;
    this.handle.addEventListener('action', function(event) {
      self.scene.anims.toggleAnimation(this.userData.targetElem);
    });

    if(this.on){
      this.scene.anims.toggleAnimation(this);
    }

  }
  setToggleUserData(){
    let toggleProps = this.box.userData.properties;

    this.box.userData.type = 'TOGGLE';
    this.box.userData.size = {'width': toggleProps.boxProps.width, 'height': toggleProps.boxProps.height, 'depth': this.widgetSize.baseDepth};
    this.box.userData.handle = this.handle;
    this.box.userData.horizontal = toggleProps.horizontal;
    this.box.userData.valueProps = toggleProps.valueProps;
    this.box.userData.value = toggleProps.valueProps.defaultValue;
    this.updateBooleanValue();

    this.handle.userData.type = 'TOGGLE';
    this.handle.userData.size = {'width': this.widgetSize.handleWidth, 'height': this.widgetSize.handleHeight, 'depth': this.widgetSize.handleDepth};
    this.handle.userData.offPos = new THREE.Vector3().copy(this.handle.position);
    this.handle.userData.horizontal = toggleProps.horizontal;
    this.handle.userData.anim = false;
    this.handle.userData.on = false;
    this.handle.userData.targetElem = this;

  }
  updateBooleanValue(){
    let result = true;
    if(this.box.userData.value=='Off'){
      result = false;
    }
    this.box.userData.booleanValue = result;
  }
  handleToggleValueText(toggle){
    if(toggle.box.userData.valueBox != undefined){

      if(toggle.box.userData.value == toggle.base.userData.valueProps.onValue){
        toggle.box.userData.value = toggle.base.userData.valueProps.offValue;
      }else{
        toggle.box.userData.value = toggle.base.userData.valueProps.onValue;
      }

      toggle.box.userData.valueBox.dispatchEvent({type:'update'});
    }
  }
  static HandleHVYMToggle(toggle){
    let bool = toggle.box.userData.booleanValue;
    if(toggle.objectRef.isObject3D && toggle.objectRef!=undefined){
      toggle.objectRef.userData.hvymCtrl.SetMeshVis(toggle.objectRef, bool);
    } else if(toggle.objectRef.type == 'ANIM_REF'){
      toggle.objectRef.hvymCtrl.ToggleAnimation(toggle.objectRef.ref, bool);
    }

  }
  static DoToggle(toggle){
    toggle.handle.userData.on=!toggle.handle.userData.on;
    if(toggle.box.userData.valueBox != undefined){

      if(toggle.box.userData.value == toggle.box.userData.valueProps.onValue){
        toggle.box.userData.value = toggle.box.userData.valueProps.offValue;
      }else{
        toggle.box.userData.value = toggle.box.userData.valueProps.onValue;
      }

      toggle.updateBooleanValue();

      if(toggle.isHVYM){
        ToggleWidget.HandleHVYMToggle(toggle);
      }

      toggle.box.userData.valueBox.dispatchEvent({type:'update'});
    }
  }
};

/**
 * This function sets required scrolling userdata vars on passed mergedMesh
 */
function setMergedMeshUserData(boxSize, geomSize, padding, mergedMesh){
  let extraSpace = padding*0.5;
  mergedMesh.userData.initialPositionY = boxSize.height/2 - geomSize.height/2;
  mergedMesh.userData.maxScroll = geomSize.height/2 - boxSize.height/2 - (padding+extraSpace);
  mergedMesh.userData.minScroll = mergedMesh.userData.initialPositionY+mergedMesh.userData.maxScroll+(padding-extraSpace);
  mergedMesh.userData.padding = padding;
}

/**
 * This function sets required mouse-over userdata vars on passed element
 */
function mouseOverUserData(elem){
  elem.userData.defaultScale =  new THREE.Vector3().copy(elem.scale);
  elem.userData.mouseOver =  false;
  elem.userData.mouseOverActive = false;
  elem.userData.hoverAnim = undefined;
}

/**
 * This function creates a slider portal(inset inside of parent, 
 * rendered using stencil ref)widget based on passed property set.
 * @param {object} sliderProps (sliderProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
function adjustBoxScaleRatio(box, parent){
  let ratio = parent.userData.ratio;
  let scaleX = parent.scale.x;
  let scaleY = parent.scale.y;
  let newX = box.scale.x;
  let newY = box.scale.y;
  if(scaleX > scaleY){
    newX = newX*(ratio);
  }else if(scaleY > scaleX){
    newY = newY*(ratio);
  }

  box.scale.set(newX, newY, box.scale.z);
  box.userData.defaultScale = new THREE.Vector3().copy(box.scale);
}

/**
 * This function creates a property set for list selector widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} text the text that will be rendered.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {object} [animProps=undefined] (animationProperties) animation properties for text.
 * @param {object} [listConfig=undefined] (listItemConfig) if a list config is used, model will be attached to a list element.
 * @param {bool} [scrollable=false] if true, text is scrollable.
 * @param {bool} [MultiLetterMeshes=false] if true, text created with an individual mesh for each letter.
 * 
 * @returns {object} Data object for list selector elements.
 */
export function textBoxProperties( scene, boxProps, text, textProps, animProps=undefined, listConfig=undefined, scrollable=false, MultiLetterMeshes=false){
  return {
    'type': 'TEXT_BOX',
    'scene': scene,
    'boxProps': boxProps,
    'text': text,
    'textProps': textProps,
    'animProps': animProps,
    'listConfig': listConfig,
    'scrollable': scrollable,
    'MultiLetterMeshes': MultiLetterMeshes
  }
};


/**
 * This function creates a slider portal(inset inside of parent, 
 * rendered using stencil ref)widget based on passed property set.
 * @param {object} sliderProps (sliderProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
export function createSliderPortal(sliderProps) {
  sliderProps.boxProps.isPortal = true;
  createSliderBox(sliderProps);
};

/**
 * This function creates a toggle widget based on passed property set.
 * @param {object} toggleProps (toggleProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
export function createToggleBox(toggleProps) {
  if(typeof toggleProps.textProps.font === 'string'){
    // Load the font
    loader.load(toggleProps.textProps.font, (font) => {
      toggleProps.textProps.font = font;
      let toggle = new ToggleWidget(toggleProps);
      toggle.scene.toggles.push(toggle.handle);

    });
  }else if(toggleProps.textProps.font.isFont){
    let toggle = new ToggleWidget(toggleProps);
    toggle.scene.toggles.push(toggle.handle);
  }
};

/**
 * This function creates a toggle portal(inset inside of parent, 
 * rendered using stencil ref)widget based on passed property set.
 * @param {object} toggleProps (toggleProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
function TogglePortal(toggleProps) {
  const parentSize = getGeometrySize(toggleProps.boxProps.parent.geometry);
  let stencilRef = getStencilRef();
  let toggle = new ToggleWidget(toggleProps);
  setupStencilMaterial(toggle.box.material, stencilRef);
  setupStencilChildMaterial(toggle.handle.material, stencilRef);
  toggle.box.material.depthWrite = false;
  toggle.handle.material.depthWrite = false;
  toggleProps.boxProps.parent.add(toggle.box);
  toggle.box.position.set(toggle.box.position.x, toggle.box.position.y, toggle.box.position.z+parentSize.depth/2);
  toggle.scene.toggles.push(toggle.handle);

}

/**
 * This function creates a toggle portal(inset inside of parent, 
 * rendered using stencil ref)widget based on passed property set.
 * @param {object} toggleProps (toggleProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
export function createTogglePortal(toggleProps) {
  if(typeof toggleProps.textProps.font === 'string'){
    // Load the font
    loader.load(toggleProps.textProps.font, (font) => {
      toggleProps.textProps.font = font;
      TogglePortal(toggleProps);
    });
  }else if(toggleProps.textProps.font.isFont){
    TogglePortal(toggleProps);
  }
};

/**
 * This function creates a input text box widget based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {object} TextBoxWidget class object.
 */
export class TextBoxWidget extends BaseWidget {
  constructor(textBoxProps) {
    const textProps = textBoxProps.textProps;
    let widgetProps = widgetProperties(textBoxProps.scene, textBoxProps.boxProps, "", true, true, textProps, false, undefined, textBoxProps.listConfig, 0);
    super(widgetProps);
    this.is = 'TEXT_BOX_WIDGET';
    this.scene = textBoxProps.scene;
    this.textMeshMaterial = getMaterial(textProps.matProps);
    this.textProps = textProps;
    this.textMesh = this.BaseText.NewTextMesh('textMesh', textBoxProps.text);
    if(!textBoxProps.MultiLetterMeshes){
      if(textBoxProps.animProps!=undefined){
        this.textMesh.material.transparent=true;
        this.textMesh.material.opacity=0;
      }

      if(textBoxProps.boxProps.name==''){
        textBoxProps.boxProps.name='text-'+this.box.id;
      }
      this.box.name = textBoxProps.boxProps.name;
      this.BaseText.SetMergedTextUserData('textMesh');
      this.textMesh.userData.draggable=textBoxProps.textProps.draggable;
      this.textMesh.userData.horizontal=false;
    }
    this.textMeshSize = getGeometrySize(this.textMesh.geometry);
    this.box.add(this.textMesh);

    this.HandleListConfig(textBoxProps.listConfig);

    if(textProps.draggable){
      this.scene.draggable.push(this.textMesh);
    }
    if(textBoxProps.animProps!=undefined){
      //anim, action, duration, ease, delay, onComplete
      this.scene.anims.multiAnimation(this.box, this.textMesh.children, textBoxProps.animProps.anim, textBoxProps.animProps.action, textBoxProps.animProps.duration, textBoxProps.animProps.ease, textBoxProps.animProps.delay, textBoxProps.animProps.callback);
    }
    if(textBoxProps.onCreated!=undefined){
      textBoxProps.onCreated(this.box);
    }
    if(textBoxProps.isPortal){
      setupStencilMaterial(this.box.material, this.box.material.stencilRef);
      setupStencilChildMaterial(this.textMeshMaterial, this.box.material.stencilRef);
    }
  }
  NewTextMeshStencilMaterial(stencilRef){
    const material = getMaterial(this.textProps.matProps, stencilRef);
    if(this.BaseText.multiTextArray.length>0){
      this.BaseText.multiTextArray.forEach((text, index) =>{
        text.material = material;
      });

    }else{
      this.textMesh.material = material;
    }
  }
  SetTextMeshMaterialStencilRef(stencilRef){
    this.textMesh.material.stencilRef = stencilRef;
  }
  ConvertTextMeshMaterialToPortalChildMaterial(){
    this.textMesh.material.depthWrite = false;
    this.textMesh.material.stencilWrite = true;
    this.textMesh.material.stencilFunc = THREE.EqualStencilFunc;
    //this.textMesh.material.stencilZPass = undefined;
  }
  static SetupPortalProps(textBoxProps){
    textBoxProps.boxProps.isPortal = true;
    textBoxProps.boxProps.matProps.useCase = 'STENCIL';
    textBoxProps.textProps.matProps.useCase = 'STENCIL_CHILD';

    return textBoxProps
  }

};

/**
 * This function creates a multi-line text widget based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createStaticTextBox(textBoxProps) {
  textBoxProps.MultiLetterMeshes = false;
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      ListItemBox.SetListConfigFont(textBoxProps.listConfig, font);
      new TextBoxWidget(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    ListItemBox.SetListConfigFont(textBoxProps.listConfig, font);
    new TextBoxWidget(textBoxProps);
  }  
};

/**
 * This function creates a multi-line text widget portal based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createStaticTextPortal(textBoxProps) {
  textBoxProps = TextBoxWidget.SetupPortalProps(textBoxProps);
  createStaticTextBox(textBoxProps);
}

/**
 * This function creates a scrollable multi-line text widget portal based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createStaticScrollableTextBox(textBoxProps) {
  textBoxProps.textProps.draggable = true;
  createStaticTextBox(textBoxProps); 
}

/**
 * This function creates a multi-line text widget portal based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createStaticScrollableTextPortal(textBoxProps) {
  textBoxProps.textProps.draggable = true;
  createStaticTextPortal(textBoxProps);
}

/**
 * This function creates a multi-line text widget based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createMultiTextBox(textBoxProps) {
  textBoxProps.MultiLetterMeshes = true;
  textBoxProps.textProps.MultiLetterMeshes = true;
  if(typeof textBoxProps.textProps.font === 'string'){
    // Load the font
    loader.load(textBoxProps.textProps.font, (font) => {
      textBoxProps.textProps.font = font;
      ListItemBox.SetListConfigFont(textBoxProps.listConfig, font);
      new TextBoxWidget(textBoxProps);
    });
  }else if(textBoxProps.textProps.font.isFont){
    ListItemBox.SetListConfigFont(textBoxProps.listConfig, font);
    new TextBoxWidget(textBoxProps);
  }
};

/**
 * This function creates a multi-line text widget portal based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createMultiTextPortal(textBoxProps) {
  textBoxProps = TextBoxWidget.SetupPortalProps(textBoxProps);
  createMultiTextBox(textBoxProps);
};

/**
 * This function creates a scrollable text widget based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createMultiScrollableTextBox(textBoxProps) {
  textBoxProps.textProps.draggable = true;
  createMultiTextBox(textBoxProps);
};

/**
 * This function creates a scrollable text widget portal based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) property set.
 * 
 * @returns {null} no return.
 */
export function createMultiScrollableTextPortal(textBoxProps) {
  textBoxProps = TextBoxWidget.SetupPortalProps(textBoxProps);
  createMultiScrollableTextBox(textBoxProps);
};

/**
 * This function creates a catch all property set for text based elements.
 * @param {object} cBox object for an widget that has a box mesh.
 * @param {string} text string of text to be rendered.
 * @param {object} textMesh Object3D mesh for text.
 * @param {object} font the loaded font asset object.
 * @param {number} size text size.
 * @param {number} height text height.
 * @param {number} zOffset position of text in z.
 * @param {number} letterSpacing space between letters.
 * @param {number} lineSpacing space between text lines.
 * @param {number} wordSpacing space between words.
 * @param {number} text padding.
 * @param {number} draggable draggability of text.
 * @param {number} meshProps text mesh properties.
 * @param {bool} [wrap=true] if true, text wraps.
 * @param {bool} [hasButton=false] if true, text element has button.
 * 
 * @returns {object} Data object text elements.
 */
export function editTextProperties(cBox, text, textMesh, font, size, height, zOffset, letterSpacing, lineSpacing, wordSpacing, padding, draggable, meshProps, wrap=true, hasButton=false){
  return {
    'type': 'EDIT_TEXT_PROPS',
    'cBox': cBox,
    'text': text,
    'textMesh': textMesh,
    'font': font,
    'size': size,
    'height': height,
    'zOffset': zOffset,
    'letterSpacing': letterSpacing,
    'lineSpacing': lineSpacing,
    'wordSpacing': wordSpacing,
    'padding': padding,
    'draggable': draggable,
    'meshProps': meshProps,
    'wrap': wrap,
    'hasButton': hasButton
  }
};

/**
 * This function creates a input text widget based on passed property set.
 * @param {object} inputTextProps (editTextProperties) property set.
 * 
 * @returns {object} InputTextWidget class object.
 */
export class InputTextWidget extends BaseWidget {
  constructor(textInputProps) {
    const props = InputTextWidget.CalculateBoxProps(textInputProps);
    let inputBoxProps = props.inputBoxProps;
    let btnBoxProps = undefined;

    if(textInputProps.buttonProps != undefined){
      btnBoxProps = props.btnBoxProps;
      textInputProps.buttonProps.boxProps = btnBoxProps;
    }
    const textProps = textInputProps.textProps;
    let widgetProps = widgetProperties(textInputProps.scene, inputBoxProps, textInputProps.name, true, true, textProps, false, undefined, textInputProps.listConfig, 0)
    super(widgetProps);
    this.is = 'INPUT_TEXT_WIDGET';
    this.scene = textInputProps.scene;
    this.defaultText = 'Enter Text';
    if(textInputProps.name.length>0){
      this.defaultText = textInputProps.name;
    }
    
    this.BaseText.SetParent(this);
    this.inputText = this.BaseText.NewTextMesh('inputText', this.defaultText);
    setupStencilChildMaterial(this.inputText.material, this.box.material.stencilRef);
    this.BaseText.SetMergedTextUserData('inputText');
    this.inputTextSize = this.inputText.userData.size;
    this.box.userData.properties = textInputProps;
    this.inputBoxProps = inputBoxProps;
    if(btnBoxProps!=undefined){
      textInputProps.buttonProps.boxProps.parent = this.box;
      this.btnBoxProps = btnBoxProps;
      this.buttonProps = textInputProps.buttonProps;
    }
    
    this.scene.mouseOverable.push(this.inputText);

    if(this.buttonProps != undefined){
      this.button = this.AttachButton();
    }

    this.HandleTextInputSetup();
  }
  HandleTextInputSetup(){
    this.scene.inputPrompts.push(this.inputText);
    let textProps = this.box.userData.properties.textProps;
    let draggable = this.box.userData.properties.draggable;
    const editProps = editTextProperties(this, '', this.inputText, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, draggable, textProps.meshProps);
    this.inputText.userData.textProps = editProps;
    this.box.userData.mouseOverParent = true;
    this.box.userData.currentText = '';
    this.scene.mouseOverable.push(this.box);
    mouseOverUserData(this.inputText);
    if(this.box.userData.properties.isPortal){
      setupStencilMaterial(this.box.material, this.box.material.stencilRef);
      setupStencilChildMaterial(this.inputText.material, this.box.material.stencilRef);
    }
  }
  AttachButton(){
    let btn = undefined;
    if(!this.box.userData.properties.isPortal){
      btn = ButtonElement(this.buttonProps);
    }else{
      btn = PortalButtonElement(this.buttonProps);
    }
    this.Recenter(this.btnBoxProps.width);

    if(this.box.userData.properties.buttonProps.attach == 'RIGHT'){
      btn.AlignOutsideRight();
    }else if(widgetProps.buttonProps.attach == 'BOTTOM'){
      btn.AlignOutsideRight();
    }

    return btn
  }
  static CalculateBoxProps(inputTextProps){
    let inputBoxProps = {...inputTextProps.boxProps};
    let btnBoxProps = {...inputTextProps.boxProps};
    let hasButton = (inputTextProps.buttonProps != undefined);
    let horizontal = true;
    if(hasButton && inputTextProps.buttonProps.attach == 'BOTTOM'){
      horizontal = false;
    }
    let size = BaseWidget.CalculateWidgetSize(inputTextProps.boxProps, horizontal, hasButton, 2);

    inputBoxProps.width = size.baseWidth;
    inputBoxProps.height = size.baseHeight;
    inputBoxProps.depth = size.baseDepth;

    btnBoxProps.width = size.subWidth;
    btnBoxProps.height = size.subHeight;
    btnBoxProps.depth = size.subDepth;

    return { inputBoxProps, btnBoxProps }
  }
  static SetupPortalProps(textInputProps){
    textInputProps.boxProps.isPortal = true;
    textInputProps.boxProps.matProps.useCase = 'STENCIL';
    textInputProps.textProps.matProps.useCase = 'STENCIL_CHILD';
    if(textInputProps.buttonProps!=undefined){
      textInputProps.buttonProps.boxProps.isPortal = true;
      textInputProps.buttonProps.boxProps.matProps.useCase = 'STENCIL';
      textInputProps.buttonProps.textProps.matProps.useCase = 'STENCIL_CHILD';
    }
    return textInputProps
  }
};

/**
 * This function creates a default property set for input text box properties.
 * @param {object} parent Object3D that the widget should be parented to.
 * 
 * @returns {object} boxProperties for input text elements.
 */
function TextInputBoxProperties(parent, portal=false){
  let matProps = phongMatProperties('black');
  if(portal){
    matProps = phongStencilMatProperties('black');
  }
  return boxProperties('input-box-properties', parent, 'black', 4, 2, 0.2, 10, 0.4, 0.25, true, matProps);
}

/**
 * This function creates a default property set for input text box properties.
 * @param {object} parent Object3D that the widget should be parented to.
 * 
 * @returns {object} boxProperties for input text elements.
 */
export function defaultTextInputBoxProps(parent=undefined){
  return TextInputBoxProperties(parent);
};

/**
 * This function creates a default property set for input text box portal properties.
 * @param {object} parent Object3D that the widget should be parented to.
 * 
 * @returns {object} boxProperties for input text elements.
 */
export function defaultTextInputPortalBoxProps(parent){
  return TextInputBoxProperties(parent, true);
};

/**
 * This function creates a property set for input text widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {object} [buttonProps=undefined] (buttonProperties) if input needs a button, pass button properties.
 * @param {bool} [draggables=false] if true, text will be draggable.
 * 
 * @returns {object} Data object for list selector elements.
 */
export function textInputProperties( scene, boxProps, name='', textProps=undefined, buttonProps=undefined, draggable=false){
  return {
    'type': 'INPUT_TEXT',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'textProps': textProps,
    'buttonProps': buttonProps,
    'draggable': draggable
  }
};

/**
 * This function creates a default property set for edit text widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for edit text elements.
 */
export function defaultPanelEditTextProps(scene, name, parent, font){
  const boxProps = defaultPanelEditTextBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  textProps.editText = true;
  return textInputProperties(scene, boxProps, name, textProps);
}

/**
 * This function creates a default property set for edit text widgets in panels.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for edit text elements in panels.
 */
export function defaultPanelInputTextProps(scene, name, parent, font){
  const boxProps = defaultPanelEditTextBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  const btnBoxProps = defaultEditTextButtonBoxProps(name, parent);
  const btnProps = buttonProperties(btnBoxProps, name, '', textProps)
  return textInputProperties(scene, boxProps, name, textProps, btnProps);
}

/**
 * This function creates a text input widget.
 * @param {object} textInputProps (textInputProperties) Properties used for text input widget.
 * 
 * @returns {null} no return value.
 */
export function createTextInput(textInputProps) {
  textInputProps.textProps.editText = true;
  if(typeof textInputProps.textProps.font === 'string'){
    // Load the font
    loader.load(textInputProps.textProps.font, (font) => {
      textInputProps.textProps.font = font;
      new InputTextWidget(textInputProps);
    });
  }else if(textInputProps.textProps.font.isFont){
    new InputTextWidget(textInputProps);
  }
};

/**
 * This function creates a text input widget.
 * @param {object} textInputProps (textInputProperties) Properties used for text input widget.
 * 
 * @returns {null} no return value.
 */
export function createScrollableTextInput(textInputProps) {
  textInputProps.draggable = true;
  createTextInput(textInputProps);
};

/**
 * This function creates a text input widget portal(inset inside of parent, 
 * rendered using stencil ref) widget based on passed property set.
 * @param {object} textInputProps (textInputProperties) Properties used for text input widget.
 * 
 * @returns {null} no return value.
 */
export function createTextInputPortal(textInputProps) {
  textInputProps = InputTextWidget.SetupPortalProps(textInputProps);
  createTextInput(textInputProps);
};

/**
 * This function creates a text input widget.
 * @param {object} textInputProps (textInputProperties) Properties used for text input portal(inset inside of parent, rendered using stencil ref) widget based on passed property set.
 * 
 * @returns {null} no return value.
 */
export function createScrollableTextInputPortal(textInputProps) {
  textInputProps = InputTextWidget.SetupPortalProps(textInputProps);
  textInputProps.draggable = true;
  createTextInput(textInputProps);
};

/**
 * This function creates a selector set property set.
 * @param {object} set dictionary of objects for selector.
 * 
 * @returns {object} Selector set property.
 */
export function selectorSet(set){
  return {
    'type': 'SELECTOR_SET',
    'set': set
  }
};

/**
 * This function creates a property set for list selector widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} [textProps=undefined] (textProperties) Properties of text.
 * @param {object} [listConfig=undefined] (listItemConfig) if a list config is used, model will be attached to a list element.
 * @param {object} [objectControlProps=undefined] slot for object that will be updated by widget.
 * 
 * @returns {object} Data object for list selector elements.
 */
export function listSelectorProperties( scene, boxProps=defaultTextInputBoxProps(), name='', textProps=undefined, listConfig=undefined, objectControlProps=undefined){
  return {
    'type': 'LIST_SELECTOR',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'textProps': textProps,
    'listConfig': listConfig,
    'objectControlProps': objectControlProps
  }
};

/**
 * This function creates a default property set for list selector widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for list selector elements.
 */
export function defaultPanelListSelectorProps(scene, name, parent, font){
  const boxProps = defaultPanelListSelectorBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  const listSelectorProps = listSelectorProperties(scene, boxProps, name, textProps)

  return listSelectorProps
};

/**
 * This function creates a default property set for material list selector widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * 
 * @returns {object} Data object for list selector elements.
 */
export function defaultPanelMaterialSetSelectorProps(name, parent, font){
  const boxProps = defaultPanelListSelectorBoxProps(name, parent);
  const textProps = defaultWidgetTextProperties(font);
  const listSelectorProps = listSelectorProperties(boxProps, name, textProps)

  return listSelectorProps
};

/**
 * This function creates a selector widget based on passed property set.
 * @param {object} listSelectorProps (listSelectorProperties) property set.
 * 
 * @returns {object} SelectorWidget class object.
 */
export class SelectorWidget extends BaseWidget {
  constructor(listSelectorProps) {
    const isPortal = listSelectorProps.isPortal;
    const textProps = listSelectorProps.textProps;
    let btnBoxProps = {...listSelectorProps.boxProps};
    let btnMatProps = {...listSelectorProps.boxProps.matProps};
    let btnTextProps = {...listSelectorProps.textProps};
    btnBoxProps.matProps = btnMatProps;
    if(isPortal){
      btnBoxProps.isPortal = isPortal;
      btnBoxProps.matProps.useCase = 'STENCIL_CHILD';
      btnTextProps.matProps.useCase = 'STENCIL_CHILD';
      btnMatProps.useCase = 'STENCIL';
      listSelectorProps.boxProps.matProps.useCase = 'STENCIL_CHILD';
      listSelectorProps.textProps.matProps.useCase = 'STENCIL_CHILD';
    }
    let widgetProps = widgetProperties(listSelectorProps.scene, btnBoxProps, listSelectorProps.name, true, true, btnTextProps, false, undefined, listSelectorProps.listConfig, 0)
    super(widgetProps);
    this.is = 'SELCTOR_WIDGET';
    this.scene = listSelectorProps.scene;
    this.isHVYM = false;
    this.isPortal = isPortal;
    this.box.userData.properties = listSelectorProps;
    this.box.userData.selectors = [];
    this.box.userData.defaultZPos = this.box.position.z;
    this.box.userData.hoverZPos = this.box.position.z;
    this.btnBoxProps = btnBoxProps;
    this.btnMatProps = btnMatProps;
    this.btnTextProps = btnTextProps;
    this.boxProps = btnBoxProps;
    this.selectors = {};
    this.meshSet = undefined;

  }
  AssignSelectionSet(selectors){
    this.selectors = selectors.set;
    if(selectors.type == 'SELECTOR_SET'){
      
    }else if(selectors.type == 'HVYM_MAT_SET'){
      this.isHVYM = true;
      this.collectionID = selectors.collection_id;
      this.matSet = selectors.set;
      this.meshSet = selectors.mesh_set.set;
    }else if(selectors.type == 'HVYM_MESH_SET'){
      this.isHVYM = true;
      this.collectionID = selectors.collection_id;
      this.meshSet = selectors.set;
    }
    this.CreateSelectors();
  }
  CreateSelectors(){
    let idx = 0;

    for (const [key, val] of Object.entries(this.selectors)) {
      let props = this.box.userData.properties;
      let btnProps = buttonProperties(this.scene, {...this.btnBoxProps}, key, val, props.textProps);
      if(val.type == 'HVYM_MAT_SET_REF'){
        val.mat_ref.userData.mat_ref_props = materialRefPropertiesFromMaterial(val.mat_ref, 'color', true);
        val.mat_ref.userData.mat_ref_props.isHVYM = this.isHVYM;
        btnProps.objectControlProps = val.mat_ref.userData.mat_ref_props;
      }
      let btn = new BaseTextBox(btnProps);
      btn.box.userData.properties = props;
      btn.box.userData.ctrl = this;

      const editProps = editTextProperties(btn, '', this.btnTextProps.textMesh, this.btnTextProps.font, this.btnTextProps.size, this.btnTextProps.height, this.btnTextProps.zOffset, this.btnTextProps.letterSpacing, this.btnTextProps.lineSpacing, this.btnTextProps.wordSpacing, this.btnTextProps.padding, true, this.btnTextProps.meshProps);
      btn.textMesh.userData.textProps = editProps;
      this.scene.inputPrompts.push(btn.textMesh);
      this.scene.mouseOverable.push(btn.textMesh);
      this.scene.clickable.push(btn.textMesh);
      btn.box.name = key;
      
      this.SetUserData(btn, key, val, idx);
      mouseOverUserData(btn.textMesh);

      this.box.userData.selectors.push(btn.box);
      this.scene.selectorElems.push(btn.box);
      this.box.add(btn.box);
        
      btn.textMesh.addEventListener('action', function(event) {
        SelectorWidget.TextSelected(btn.textMesh)
      });

      if(idx==0){
        btn.textMesh.userData.selected = true;
        btn.box.position.copy(btn.box.userData.selectedPos);

      }else{
        btn.box.position.copy(btn.box.userData.unselectedPos);
        btn.box.scale.set(btn.box.unselectedScale, btn.box.unselectedScale, btn.box.unselectedScale);
      }

      if(this.isPortal){
        setupStencilChildMaterial(btn.box.material, this.box.material.stencilRef);
        setupStencilChildMaterial(btn.textMesh.material, this.box.material.stencilRef);
        btn.box.material.stencilRef = this.box.material.stencilRef;
        btn.textMesh.material.stencilRef = this.box.material.stencilRef;
        btn.textMesh.material.depthWrite = true;
        btn.box.renderOrder = 2;
        btn.textMesh.renderOrder = 2;
        btn.box.position.set(btn.box.position.x, btn.box.position.y, -btn.depth);
      }

      btn.box.material.depthWrite = true;

      idx+=1;
    }
    if(this.isPortal){
      this.CreateHeightExpandedMorph(Object.keys(this.selectors).length);
    }

    if(Object.keys(this.selectors).length>0){
      SelectorWidget.HandleHVYMSelection(this.selectors[Object.keys(this.selectors)[0]]);
    }
    
  }
  SetUserData(btn, key, value, index){
    const textSize = getGeometrySize(btn.textMesh.geometry);
    let selectedZ = btn.depth+(btn.depth+textSize.depth);
    let unselectedZ = btn.depth;
    if(btn.box.userData.properties.isPortal){
      selectedZ = -btn.depth;
      unselectedZ = -(btn.depth+(btn.depth+textSize.depth)*2);
    }
    btn.textMesh.userData.draggable = false;
    btn.textMesh.userData.key = key;
    btn.textMesh.userData.value = value;
    btn.textMesh.userData.index = index;
    btn.textMesh.userData.selected = false;
    btn.box.userData.selectedScale = 1;
    btn.box.userData.unselectedScale = 0.9;
    btn.box.userData.selectedPos = new THREE.Vector3(btn.box.position.x, btn.box.position.y, selectedZ);
    btn.box.userData.unselectedPos = new THREE.Vector3(btn.box.position.x, btn.box.position.y, unselectedZ);
    btn.box.userData.mouseOverParent = true;
    btn.box.userData.currentText = key;
  }
  static HandleHVYMSelection(value){
    if(!value.hasOwnProperty('type'))
      return;

    if(value.type == 'HVYM_MAT_SET_REF'){
      value.ctrl.UpdateMatSet(value);
    } else if(value.type == 'HVYM_MESH_SET_REF'){
      value.ctrl.UpdateMeshSet(value.collection_id, value.set_name, value.mesh_ref.name);
    }

  }
  static TextSelected(selection){
    console.log(selection)
    const scene = selection.userData.controller.parentCtrl.scene;
    let base = selection.parent.parent;
    base.userData.selection = selection;

    base.userData.selectors.forEach((c, idx) => {
      if(c.children[0].userData.selected){
        base.userData.lastSelected = c;
      }
      c.children[0].userData.selected = false;
    });

    selection.userData.selected = true;
    let first = selection.parent;
    base.userData.selectors.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });
    scene.anims.selectorAnimation(selection.parent.parent, 'SELECT');
    SelectorWidget.HandleHVYMSelection(selection.userData.value);

  }
};

/**
 * This function creates a list selector widget.
 * @param {object} listSelectorProps (listSelectorProperties) Properties used for list selector widget.
 * @param {object} selectors (selectorSetProperties) Properties used for list selector set dictionary.
 * 
 * @returns {null} no return value.
 */
export function createListSelector(listSelectorProps, selectors) {

  if(typeof listSelectorProps.textProps.font === 'string'){
    // Load the font
    loader.load(listSelectorProps.textProps.font, (font) => {
      listSelectorProps.textProps.font = font;
      let widget = new SelectorWidget(listSelectorProps);
      widget.AssignSelectionSet(selectors);
    });
  }else if(listSelectorProps.textProps.font.isFont){
    let widget = new SelectorWidget(listSelectorProps);
      widget.AssignSelectionSet(selectors);
  }

};

/**
 * This function creates a list selector portal(inset inside of parent, 
 * rendered using stencil ref) widget based on passed property set.
 * @param {object} listSelectorProps (listSelectorProperties) Properties used for list selector widget.
 * @param {object} selectors (selectorSetProperties) Properties used for list selector set dictionary.
 * 
 * @returns {null} no return value.
 */
export function createListSelectorPortal(listSelectorProps, selectors) {
  listSelectorProps.isPortal = true;
  createListSelector(listSelectorProps, selectors);
};

/**
 * This function creates a button element based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
function ButtonElement(buttonProps){
  let btn = new BaseTextBox(buttonProps);
  let textProps = buttonProps.textProps;
  const tProps = editTextProperties(btn, '', btn.textMesh, textProps.font, textProps.size, textProps.height, textProps.zOffset, textProps.letterSpacing, textProps.lineSpacing, textProps.wordSpacing, textProps.padding, true, textProps.meshProps);
  btn.box.userData.textProps = tProps;
  btn.box.userData.draggable = false;
  btn.textMesh.userData.mouseOverParent = true;

  mouseOverUserData(btn.box);
  btn.scene.clickable.push(btn.box);
  if(mouseOver){
    btn.scene.mouseOverable.push(btn.box);
  }

  btn.box.userData.properties = buttonProps;

  return btn
}

/**
 * This function creates a button portal(inset inside of parent, 
 * rendered using stencil ref) widget based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
function PortalButtonElement(buttonProps){
  const portal = new BaseBox(buttonProps.boxProps);
  const stencilRef = portal.box.material.stencilRef;
  setupStencilMaterial(portal.box.material, stencilRef);
  let btn = ButtonElement(buttonProps);
  const textSize = getGeometrySize(btn.textMesh.geometry);

  btn.box.material.opacity = 0;
  btn.box.material.transparent = true;
  setupStencilChildMaterial(btn.box.material, stencilRef);
  setupStencilChildMaterial(btn.textMesh.material, stencilRef);
  portal.box.add(btn.box);
  btn.box.position.set(btn.box.position.x, btn.box.position.y, -btn.depth/2);
  btn.textMesh.position.set(btn.textMesh.position.x, btn.textMesh.position.y, -textSize.depth/2);
  buttonProps.boxProps.parent.add(portal.box);
  portal.box.userData.properties = buttonProps;

  return portal
}

/**
 * This function creates a button element based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
function Button(buttonProps) {
  if(typeof buttonProps.textProps.font === 'string'){
    // Load the font
    loader.load(buttonProps.textProps.font, (font) => {
      buttonProps.textProps.font = font;
      ButtonElement(buttonProps);
    });
  }else if(buttonProps.textProps.font.isFont){
    ButtonElement(buttonProps);
  }
}

/**
 * This function creates a button portal(inset inside of parent, 
 * rendered using stencil ref) widget based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
function portalButton(buttonProps) {
  if(typeof buttonProps.textProps.font === 'string'){
    // Load the font
    loader.load(buttonProps.textProps.font, (font) => {
      buttonProps.textProps.font = font;
      PortalButtonElement(buttonProps);
    });
  }else if(buttonProps.textProps.font.isFont){
    PortalButtonElement(buttonProps);
  }
}

/**
 * This function creates a button element based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
export function createButton(buttonProps){
  Button(buttonProps);
};

/**
 * This function creates a button portal(inset inside of parent, 
 * rendered using stencil ref) widget based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
export function createPortalButton(buttonProps){
  buttonProps.isPortal = true;
  buttonProps.boxProps.isPortal = true;
  portalButton(buttonProps);
};

/**
 * This function creates a mouseoverable button element based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
export function createMouseOverButton(buttonProps){
  buttonProps.mouseOver = true;
  Button(buttonProps);
};

/**
 * This function creates a  mouseoverable button portal(inset inside of parent, 
 * rendered using stencil ref) widget based on passed property set.
 * @param {object} buttonProps (buttonProperties) Properties used for button element.
 * 
 * @returns {object} BaseTextBox class object.
 */
export function createMouseOverPortalButton(buttonProps){
  buttonProps.mouseOver = true;
  createPortalButton(buttonProps);
};

/**
 * This function creates a slider widget based on passed property set.
 * @param {object} sliderProps (sliderProperties) Properties used for toggle widget.
 * 
 * @returns {null} no return value.
 */
export function createSliderBox(sliderProps) {
  if(typeof sliderProps.textProps.font === 'string'){
    // Load the font
    loader.load(sliderProps.textProps.font, (font) => {
      sliderProps.textProps.font = font;
      new SliderWidget(sliderProps);

    });
  }else if(sliderProps.textProps.font.isFont){
    new SliderWidget(sliderProps);
  }
};

/**
 * This function creates a property set for loading image widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} imgUrl a url to the image
 * @param {number} [padding=0.01] paddnig for image element.
 * @param {object} [listConfig=undefined] (listItemConfig) if a list config is used, model will be attached to a list element.
 * @param {number} [zoffset=0] Amount to offset model in z.
 * 
 * @returns {object} Data object for gltf model elements.
 */
export function imageProperties( scene, boxProps, name='', imgUrl, padding=0.01, listConfig=undefined, zOffset=0){
  return {
    'type': 'IMAGE',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'imgUrl': imgUrl,
    'padding': padding,
    'listConfig': listConfig,
    'zOffset': zOffset
  }
};

/**
 * This function creates an image widget based on passed property set.
 * @param {object} imageProps (imageProperties) property set.
 * 
 * @returns {object} ImageWidget class object.
 */
export class ImageWidget extends BaseWidget {
  constructor(imageProps) {
    let textProps = {...DEFAULT_TEXT_PROPS};
    imageProps.boxProps.isPortal = true;
    let widgetProps = widgetProperties(imageProps.scene, imageProps.boxProps, imageProps.name, true, true, textProps, false, undefined, imageProps.listConfig, 0);
    super(widgetProps);
    this.is = 'IMAGE_WIDGET';
    this.map = new THREE.TextureLoader().load( imageProps.imgUrl );
    this.imageMaterial = new THREE.MeshBasicMaterial( { color: 'white', map: this.map } );
    this.box.material = this.imageMaterial;

    this.HandleListConfig(imageProps.listConfig);

  }
  NewImageBoxStencilMaterial(stencilRef){
    this.imageMaterial = new THREE.MeshBasicMaterial( { color: 'white', map: this.map } );
    this.box.material = this.imageMaterial;
    setupStencilChildMaterial(this.box.material, stencilRef);
  }
  ConvertToPortalChild(stencilRef){
    setupStencilChildMaterial(this.box.material, stencilRef);
    this.MakeModelPortalChild(stencilRef);
  }
  static SetupPortalProps(imageProps){
    imageProps.isPortal = true;
    imageProps.boxProps.isPortal = true;
    imageProps.matProps.useCase = 'STENCIL';
    imageProps.boxProps.matProps.useCase = 'STENCIL';

    return imageProps
  }

};

/**
 * This function creates an image widget based on passed property set.
 * @param {object} imageProps (imageProperties) Properties used for image widget.
 * 
 * @returns {null} no return value.
 */
export function createImageBox(imageProps){

  if(typeof DEFAULT_TEXT_PROPS.font === 'string'){
    // Load the font
    loader.load(DEFAULT_TEXT_PROPS.font, (font) => {
      DEFAULT_TEXT_PROPS.font = font;
      ListItemBox.SetListConfigFont(imageProps.listConfig, font);
      new ImageWidget(imageProps);
    });
  }else if(DEFAULT_TEXT_PROPS.font.isFont){
    ListItemBox.SetListConfigFont(imageProps.listConfig, DEFAULT_TEXT_PROPS.font);
    new ImageWidget(imageProps);
  }
};

/**
 * Checks whether or not heavymeta data is used for widget creation.
 * @param {object} data heavymeta data object.
 * 
 * @returns {bool}
 */
export function dataIsHVYMWidget(data){
  let result = false;

  if(data.hasOwnProperty('widget')){
    result = data.widget
  }

  return result
}

/**
 * This function creates heavymeta data object based on loaded gltf file.
 * @param {object} gltf loaded gltf object.
 * 
 * @returns {object} Heavymeta data class object.
 */
export class HVYM_Data {
  constructor(gltf) {
    this.is = 'EMPTY';
    const extensions = gltf.userData.gltfExtensions;
    if(extensions != undefined && extensions.hasOwnProperty('HVYM_nft_data' )){
      this.is = 'HVYM_DATA';
      this.scene = gltf.scene;
      this.contractProps = extensions.HVYM_nft_data.contract;
      this.collections = {};
      for (const [key, obj] of Object.entries(extensions.HVYM_nft_data)) {

        if(key=='contract'){

        }else{
          this.collections[key] = this.hvymCollection(key, obj.collectionName);
          this.collections[key].models = this.getCollectionModelRefs(gltf.scene, obj.nodes);
          this.collections[key].menuData = {...extensions.HVYM_nft_data[key].menuData};
          this.collections[key].menuTransform = this.getCollectionMenuTransform(this.collections[key]);
          this.collections[key].materials = this.getGltfSceneMaterials(gltf.scene);
          this.collections[key].hasAnimation = false;

          if(extensions.HVYM_nft_data[key].hasOwnProperty('animProps')){
            this.mixer = new THREE.AnimationMixer( this.scene );
            this.collections[key].hasAnimation = true;
            this.collections[key].animations = this.getGltfAnimations(extensions.HVYM_nft_data[key].animProps, gltf);
          }

          if(obj.hasOwnProperty('propLabelData')){
            this.collections[key].meshSetsLabel = obj.propLabelData.mesh_set_label;
            this.collections[key].materialSetsLabel = obj.propLabelData.mat_set_label;
            this.collections[key].morphSetsLabel = obj.propLabelData.morph_set_label;
            this.collections[key].materialPropsLabel = obj.propLabelData.mat_prop_label;
            this.collections[key].animPropsLabel = obj.propLabelData.anim_prop_label;
            this.collections[key].valuePropsLabel = obj.propLabelData.value_prop_label;
            this.collections[key].meshPropsLabel = obj.propLabelData.mesh_prop_label;
          }

          this.HandleHVYMProps(key, obj)
          
        }

      }
    }
  }
  HandleHVYMProps(colID, data){
    for (const [key, obj] of Object.entries(data)) {
      switch (key) {
        case 'valProps':
          this.HandleValueProps(colID, obj);
          break;
        case 'materialSets':
          this.HandleMaterialSets(colID, obj);
          break;
        case 'meshSets':
          this.HandleMeshSets(colID, obj);
          break;
        case 'meshProps':
          this.HandleMeshProps(colID, obj);
          break;
        case 'matProps':
          this.HandleMaterialProps(colID, obj);
          break;
        case 'morphSets':
          this.HandleMorphSetProps(colID, obj);
          break;
        case 'animProps':
          this.HandleAnimProps(colID, obj);
          break;
        default:
          console.log('X');
      }
    }
  }
  HandleValueProps(colID, valProps){
    for (const [valPropName, valProp] of Object.entries(valProps)) {
      let name = valPropName;
      let default_val = valProp.default;
      let min = valProp.min;
      let max = valProp.max;
      let action_type = valProp.prop_action_type;
      let slider_type = valProp.prop_slider_type;
      let widget_type = valProp.widget_type;
      let widget = valProp.widget;
      this.collections[colID].valProps[valPropName] = this.hvymValPropRef(name, default_val, min, max, action_type, slider_type, widget_type, widget);
    }
  }
  HandleMaterialProps(colID, matProps){
    for (const [matPropName, matProp] of Object.entries(matProps)) {
      let mat_ref = this.collections[colID].materials[matProp.name];
      let mat_name = matProp.name;
      let emissive = matProp.emissive;
      let irridescent = matProp.irridescent;
      let sheen = matProp.sheen;
      let widget_type = matProp.widget_type;
      let widget = matProp.widget;
      this.collections[colID].matProps[matPropName] = this.hvymMatProps(colID, mat_name, emissive, irridescent, sheen, mat_ref, widget_type, widget);
    }
  }
  HandleMorphSetProps(colID, morphSets){
    for (const [morphSetName, morphSet] of Object.entries(morphSets)) {
      let mesh_ref = this.collections[colID].models[morphSet.model_ref.name];
      let morph_set = {};

      morphSet.set.forEach((m_prop, index) =>{
        morph_set[m_prop.name] = this.hvymMorphSetRef(m_prop.name, morphSetName, colID, mesh_ref, m_prop.default, m_prop.min, m_prop.max);
      });

      this.collections[colID].morphSets[morphSetName] = this.hvymMorphSet(colID, morph_set, mesh_ref, morphSet.widget_type, morphSet.widget);
    }
  }
  HandleMeshProps(colID, meshProps){
    for (const [meshPropName, meshProp] of Object.entries(meshProps)) {
      let mesh = this.collections[colID].models[meshProp.name];
      this.collections[colID].meshProps[meshPropName] = this.hvymMeshPropRef(meshProp.name, meshProp.visible, mesh, meshProp.widget_type, meshProp.widget);
    }
  }
  HandleAnimProps(colID, animProps){
    for (const [animPropName, animProp] of Object.entries(animProps)) {
      if(!this.collections[colID].hasAnimation)
        return

      let anim = this.collections[colID].animations[animProp.name];
      anim.weight = animProp.weight;
      this.collections[colID].animProps[animPropName] = this.hvymAnimProp(colID, animProp.name, animProp.start, animProp.end, animProp.loop, animProp.blending, anim, animProp.widget_type, animProp.widget);
      if(animProp.widget_type == 'slider'){
        let val_props = numberValueProperties(animProp.weight, 0, 1, 3, 0.001, true);
        this.collections[colID].animProps[animPropName].val_props = animRefProperties(animProp.start, animProp.end, animProp.loop, anim, val_props, 'animation', false, true, this);;
        anim.play();
      }
    }
  }
  HandleMaterialSets(colID, materialSet){
    for (const [k, v] of Object.entries(materialSet)) {
        
        let mesh_set = this.collections[colID].meshSets[v.mesh_set];
        let mat_id = v.material_id;
        let widget_type = v.widget_type;
        let widget = v.widget;
        if(mesh_set == undefined)
          return;

        let mat_set = {};

        v.set.forEach((m_ref, index) =>{
          let mat = this.collections[colID].materials[m_ref.name];
          let m_name = mat.name;
          mat_set[m_name] = this.hvymMaterialSetRef(k, colID, mat);
        });

        this.collections[colID].materialSets[k] = this.hvymMaterialSet(colID, mat_id, mat_set, mesh_set, widget_type, widget);

        //assign material ref to material userData
        for (const [matName, mat_set_ref] of Object.entries(mat_set)) {
          mat_set_ref.mat_ref.userData.mat_set = this.collections[colID].materialSets[k];
        }

    }
  }
  HandleMeshSets(colID, meshSets){
    for (const [k, v] of Object.entries(meshSets)) {
      let set = {};
      v.set.forEach((m_ref, index) =>{
        let mesh_ref = this.collections[colID].models[m_ref.name]
        let ref = this.hvymMeshSetRef(k, colID, mesh_ref, m_ref.visible);
        set[m_ref.name] = ref
      });

      this.collections[colID].meshSets[k] = this.hvymMeshSet(colID, set, v.widget_type, v.widget);
    }
  }
  CollectionHasProperty(key, prop){

    if(!this.collections.hasOwnProperty(key))
      return false;

    if(!this.collections[key].hasOwnProperty(prop))
      return false;

    return true

  }
  SetAnimWeight(clip, weight){
    clip.weight = weight;
  }
  ToggleAnimation(clip, on){
    if(on){
      clip.play();
    }else{
      clip.stop();
    }
  }
  SetMeshVis(mesh, visible){
    if(mesh.isGroup){
      mesh.children.forEach((c, idx) => {
        c.visible = visible;
      });
    }else{
      mesh.visible = visible;
    }
  }
  SetMeshRefVis(ref, visible){
    this.SetMeshVis(ref.mesh_ref, visible)
  }
  SetMeshMorph(mesh, name, value){
    if(!mesh.hasOwnProperty('morphTargetDictionary') || !mesh.morphTargetDictionary.hasOwnProperty(name))
      return;

    let idx = mesh.morphTargetDictionary[name];
    mesh.morphTargetInfluences[idx] = value;
  }
  UpdateMorph(object_cntrl_props, value){
    if(object_cntrl_props.isGroup){
      object_cntrl_props.ref.children.forEach((m, idx) => {
        this.SetMeshMorph(m, object_cntrl_props.targetMorph, value);
      });
    }else{
      this.SetMeshMorph(m, object_cntrl_props.targetMorph, value);
    }
  }
  UpdateMatSet(mat_set_ref){
    const material = mat_set_ref.mat_ref;
    const mat_set = material.userData.mat_set;
    const mat_id = mat_set.material_id;
    for (const [meshName, mesh] of Object.entries(mat_set.mesh_set.set)) {

      if(mesh.mesh_ref.isGroup){
        mesh.mesh_ref.children[mat_id].material = material;
      }else{
        mesh.mesh_ref.material = material;
      }

    }
  }
  UpdateMeshSet(collection_id, set_name, mesh_name){
    if(!this.CollectionHasProperty(collection_id, 'meshSets'))
      return;

    for (const [k, ref] of Object.entries(this.collections[collection_id].meshSets[set_name].set)) {
      if(k!=mesh_name){
        ref.visible == false;
        this.SetMeshRefVis(ref, false);
      }else{
        ref.visible == true;
        this.SetMeshRefVis(ref, true);
      }
    }
  }
  hvymDataWidgetMap(){
    return {
      'valProps': 'meter',
      'materialSets': 'selector',
      'meshSets': 'selector'
    }
  }
  hvymDataLabelMap(){
    return {
      'valProps': 'valuePropsLabel',
      'materialSets': 'materialSetsLabel',
      'meshSets': 'meshSetsLabel',
      'meshProps': 'meshPropsLabel',
      'morphSets': 'morphSetsLabel',
      'animProps': 'animPropsLabel'
    }
  }
  hvymAnimLoopMap(){
    return{
      'NONE': THREE.LoopOnce,
      'LoopOnce': THREE.LoopOnce,
      'LoopForever': THREE.LoopRepeat,
      'PingPong': THREE.LoopPingPong,
      'Clamp': THREE.LoopOnce,
      'ClampToggle': THREE.LoopOnce,
      'Seek': THREE.LoopOnce
    }
  }
  createHVYMCollectionWidgetData(collection){
    let mainData = {};
    const collectionKeys = ['valProps', 'materialSets', 'meshSets', 'meshProps', 'matProps', 'morphSets', 'animProps'];
    const widgetMap = this.hvymDataWidgetMap();
    const labelMap = this.hvymDataLabelMap();

    collectionKeys.forEach((key, idx) => { 
      let label = collection[labelMap[key]];
      if(Object.keys(collection[key]).length==0)
        return;
      let widgetData = {};
      if(key=='matProps'){
          let matProps = collection[key];
          for (const [name, obj] of Object.entries(matProps)) {
            if(obj.widget_type == 'none')
            return;

            let data = panelMaterialSectionPropertySet(obj.mat_ref, obj.emissive, obj.reflective, obj.iridescent, obj.sheen);
            mainData[data.name] = data;
          }
      }else if(key=='morphSets'){
        let morphSets = collection[key];
        let widgetData = {};

        for (const [name, obj] of Object.entries(morphSets)) {
          if(obj.widget_type == 'none')
            return;
          for (const [morphName, morphObj] of Object.entries(obj.set)) {
            let data = panelSectionProperties(morphName, 'slider', morphObj);
            widgetData[data.name] = data;
          }

          mainData[name] = panelSectionProperties(name, 'controls', widgetData);
        }

      }else{

        for (const [name, obj] of Object.entries(collection[key])) {
          if(obj.widget_type == 'none')
            return;

          let widget = widgetMap[key];
          if(obj.type.includes('HVYM')){
            widget = obj.widget_type;
          }

          let data = panelSectionProperties(name, widget, obj);
          widgetData[data.name] = data;
        }

        mainData[label] = panelSectionProperties(label, 'controls', widgetData);
      }
        
    });

    return panelSectionProperties('sections', 'container', mainData);
  }
  basicPanelHVYMCollectionPropertyList(scene, parent, textProps){
    let panelBoxProps = defaultPanelWidgetBoxProps('panel-box', parent);
    let colPanels = [];

    for (const [colId, collection] of Object.entries(this.collections)) {

      if(collection.menuTransform==undefined){
        let topSectionData = this.createHVYMCollectionWidgetData(collection);
        let colPanel = panelProperties( scene, panelBoxProps, collection.collectionName, textProps, 'LEFT', topSectionData);
        colPanels.push(colPanel);
      }
    }

    return colPanels
  }
  uniquePanelHVYMCollectionPropertyList(scene, parent, textProps){
    let colPanels = {};

    for (const [colId, collection] of Object.entries(this.collections)) {

      if(collection.menuTransform!=undefined){
        let panelBoxProps = defaultPanelWidgetBoxProps('panel-box', collection.menuTransform);
        panelBoxProps.matProps.color = collection.menuData.primary_color;
        textProps.matProps.color = collection.menuData.text_color;
        let topSectionData = this.createHVYMCollectionWidgetData(collection);
        let colPanel = panelProperties( scene, panelBoxProps, collection.collectionName, textProps, collection.menuData.alignment, topSectionData);
        colPanels[collection.menuTransform.name] = colPanel;
      }
    }

    return colPanels
  }
  hvymCollection(id, collectionName){
    return {
      'type': 'HVYM_COLLECTION',
      'id': id,
      'collectionName': collectionName,
      'valProps': {},
      'morphSets': {},
      'animProps': {},
      'matProps': {},
      'meshSets': {},
      'meshProps': {},
      'materialSets': {},
      'models': {},
      'materials': {},
      'menuTransform': undefined,
      'menuData': undefined
    }
  }
  hvymMeshSet(collection_id, set, widget_type, widget){
    return {
      'type': 'HVYM_MESH_SET',
      'collection_id': collection_id,
      'set': set,
      'widget_type': widget_type,
      'widget': widget
    }
  }
  hvymMeshSetRef(set_name, collection_id, mesh_ref, visible){
    return {
      'type': 'HVYM_MESH_SET_REF',
      'set_name': set_name,
      'collection_id': collection_id,
      'mesh_ref': mesh_ref,
      'visible': visible,
      'ctrl': this
    }
  }
  hvymMaterialSet(collection_id, material_id, set, mesh_set, widget_type, widget){
    return {
      'type': 'HVYM_MAT_SET',
      'collection_id': collection_id,
      'material_id': material_id,
      'set': set,
      'mesh_set': mesh_set,
      'widget_type': widget_type,
      'widget': widget
    }
  }
  hvymMaterialSetRef(set_name, collection_id, mat_ref){
    return {
      'type': 'HVYM_MAT_SET_REF',
      'set_name': set_name,
      'collection_id': collection_id,
      'mat_ref': mat_ref,
      'ctrl': this
    }
  }
  hvymMorphSet(collection_id, set, mesh_ref, widget_type, widget){
    return {
      'type': 'HVYM_MORPH_SET',
      'collection_id': collection_id,
      'set': set,
      'mesh_ref': mesh_ref,
      'widget_type': widget_type,
      'widget': widget
    }
  }
  hvymMorphSetRef(morph_name, set_name, collection_id, mesh_ref, default_val, min, max){
    return {
      'type': 'HVYM_MORPH_SET_REF',
      'morph_name': morph_name,
      'set_name': set_name,
      'collection_id': collection_id,
      'val_props': numberValueProperties(default_val, min, max, 3, 0.001, true),
      'mesh_ref': mesh_ref,
      'ctrl': this
    }
  }
  hvymMatProps(collection_id, mat_name, emissive, irridescent, sheen, mat_ref, widget_type, widget){
    return {
      'type': 'HVYM_MAT_PROPS',
      'collection_id': collection_id,
      'mat_name': mat_name,
      'emissive': emissive,
      'irridescent': irridescent,
      'sheen': sheen,
      'mat_ref': mat_ref,
      'widget_type': widget_type,
      'widget': widget,
      'ctrl': this
    }
  }
  hvymAnimProp(collection_id, name, start, end, loop, blend, anim_ref, widget_type, widget){
    return {
      'type': 'HVYM_ANIM_PROP',
      'collection_id': collection_id,
      'name': name,
      'val_props': animRefProperties(start, end, loop, anim_ref, stringValueProperties(), 'animation', false, true, this),
      'blend': blend,
      'widget_type': widget_type,
      'widget': widget,
      'mixer': undefined,
      'ctrl': this
    }
  }
  hvymValPropRef(name, default_val, min, max, action_type, slider_type, widget_type, widget){
    let editable = true;
    if(action_type == 'Immutable'){
      editable = false;
    }
    return {
      'type': 'HVYM_VAL_PROP_REF',
      'name': name,
      'val_props': numberValueProperties(default_val, min, max, 0, 0.001, editable),
      'action_type': action_type,
      'slider_type': slider_type,
      'widget': widget,
      'widget_type': widget_type,
      'ctrl': this
    }
  }
  hvymMeshPropRef(name, visible, mesh, widget_type, widget){
    return {
      'type': 'HVYM_MESH_PROP_REF',
      'name': name,
      'visible': visible,
      'val_props': meshRefProperties(mesh.isGroup, mesh, stringValueProperties(), 'visbility', false, undefined, true, this),
      'widget_type': widget_type,
      'widget': widget,
      'ctrl': this
    }
  }
  getGltfSceneModel(scene, name){
    let result = undefined;

    scene.traverse( function( child ) {
      if(child.name == name && child.isObject3D){
        result = child;
      } 
    });

    return result
  }
  getGltfSceneMaterials(scene){
    let result = {};

    scene.traverse( function( child ) {
      if(child.isObject3D && child.hasOwnProperty('material')){
        result[child.material.name] = child.material;
        child.material.userData.hvymCtrl = this;
      } 
    });

    return result
  }
  getGltfAnimations(animProps, gltf){
    let result = {};
    if(!gltf.hasOwnProperty('animations'))
      return
    const loopMap = this.hvymAnimLoopMap();

    for (const [animPropName, animProp] of Object.entries(animProps)) {
      gltf.animations.forEach((anim, index) =>{
        if(anim.name==animPropName){
          let clip = this.mixer.clipAction( anim )
          if(animProp.blend=='ADD'){
            THREE.AnimationUtils.makeClipAdditive( clip );
          }
          clip.setLoop(loopMap[animProp.loop]);
          if(animProp.loop == 'Clamp' || animProp.loop == 'ClampToggle'){
            clip.clampWhenFinished = true;
          }
          result[animPropName] = clip;
        }
      });
    }

    return result
  }
  getCollectionModelRefs(scene, nodes){
    let result = {};
    nodes.forEach((node, index) =>{
      let ref = this.getGltfSceneModel(scene, node.name);
      let k = node.name;
      if(ref!=undefined){
        result[k] = ref;
        ref.userData.hvymCtrl = this;
      }
    });

    return result
  }
  getCollectionMenuTransform(collection){
    let result = undefined;
    const menuName = 'menu_'+collection.id;
    if(collection.models.hasOwnProperty(menuName)){
      result = collection.models[menuName];
      result.userData.alignment = collection.menuData.alignment
      result.userData.primary_color = collection.menuData.primary_color;
      result.userData.secondary_color = collection.menuData.secondary_color;
      result.userData.text_color = collection.menuData.text_color;
    }
    
    return result
  }
};

/**
 * This function creates a value property set used for panel section creation.
 * @param {string} path string url for loading the model file.
 * @param {bool} useLabel if true, label is shown based on model name.
 * @param {object} widgetValueProp value property used for widget creation.
 * 
 * @returns {object} Data object for model value properties.
 */
export function modelValueProperties(path=0, useLabel=true, widgetValueProp=undefined){
  return {
    'type': 'MODEL_VALUE_PROPS',
    'path': path,
    'useLabel': useLabel,
    'widgetValueProp': widgetValueProp
  }
};

/**
 * This function creates a property set for loading gltf model widgets.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {string} name for the element.
 * @param {object} gltf a url to the model, or the loaded model Object3D
 * @param {object} [listConfig=undefined] (listItemConfig) if a list config is used, model will be attached to a list element.
 * @param {number} [zoffset=0] Amount to offset model in z.
 * @param {number} [childInset=0.9] Amount content is inset.
 * @param {number} [index=0] Index of the list element.
 * 
 * @returns {object} Data object for gltf model elements.
 */
export function gltfProperties( scene, boxProps, name='', gltf, listConfig=undefined, zOffset=0){
  return {
    'type': 'GLTF',
    'scene': scene,
    'boxProps': boxProps,
    'name': name,
    'gltf': gltf,
    'listConfig': listConfig,
    'zOffset': zOffset,
    'hvymData': undefined
  }
};

/**
 * This function creates a default property set for loading gltf model widgets.
 * @param {string} name for the element.
 * @param {object} parent Object3D that the model widget should be parented to.
 * @param {string} font path to the font json file.
 * @param {string} modelPath path to the model file.
 * 
 * @returns {object} Data object for gltf model elements.
 */
export function defaultPanelGltfModelProps(scene, name, parent, font, modelPath){
  const boxProps = defaultPanelGltfModelBoxProps(name, parent);
  boxProps.isPortal = true;
  boxProps.matProps.useCase = 'STENCIL';
  const textProps = defaultWidgetTextProperties(font);
  return gltfProperties(scene, boxProps, name, modelPath)
}

/**
 * This function creates a gltf model widget based on passed property set.
 * @param {object} gltfProps (gltfProperties) Properties used for model widget.
 * 
 * @returns {null} no return value.
 */
export class GLTFModelWidget extends BaseWidget {
  constructor(gltfProps) {
    let textProps = {...DEFAULT_TEXT_PROPS};
    let widgetProps = widgetProperties(gltfProps.scene, gltfProps.boxProps, gltfProps.name, true, true, textProps, false, undefined, gltfProps.listConfig, 0);
    super(widgetProps);
    this.is = 'GLTF_MODEL_WIDGET';
    this.scene = gltfProps.scene;
    this.hvymData = gltfProps.hvymData;
    this.box.properties = gltfProps;
    const boxSize = getGeometrySize(this.box.geometry);
    const parentSize = getGeometrySize(gltfProps.boxProps.parent.geometry);

    this.gltf = gltfProps.gltf;
    this.sceneBox = new THREE.Box3().setFromObject( this.gltf.scene );
    this.sceneSize = this.sceneBox.getSize(new THREE.Vector3());
    this.hvymPanels = [];

    let axis = 'y';
    let prop = 'height';
    if(this.sceneSize.x > this.sceneSize.y){
      axis = 'x';
      prop = 'width';
    }

    this.ratio = boxSize[prop]/this.sceneSize[axis];

    if(boxSize[prop]>this.sceneSize[axis]){
      this.ratio = this.sceneSize[axis]/boxSize[prop];
    }
    if(this.isPortal){
      let stencilRef = this.box.material.stencilRef;
      this.MakeModelPortalChild(stencilRef);
      this.gltf.scene.scale.set(this.gltf.scene.scale.x*this.ratio, this.gltf.scene.scale.y*this.ratio, this.gltf.scene.scale.z*this.ratio);
      this.gltf.scene.position.set(this.gltf.scene.position.x, this.gltf.scene.position.y, this.gltf.scene.position.z-this.depth-(this.sceneSize.z*this.ratio));
      this.gltf.scene.renderOrder = 2;

    }else{
      this.box.material.opacity = 0;
      this.box.material.transparent = true;
      this.gltf.scene.scale.set(this.gltf.scene.scale.x*this.ratio, this.gltf.scene.scale.y*this.ratio, this.gltf.scene.scale.z*this.ratio);
      this.gltf.scene.position.set(this.gltf.scene.position.x, this.gltf.scene.position.y, this.gltf.scene.position.z+this.depth+(this.sceneSize.z/2*this.ratio));
    }
    
    this.box.add( this.gltf.scene );
    this.HandleListConfig(gltfProps.listConfig);

    if(this.hvymData != undefined && this.hvymData.is == 'HVYM_DATA'){
      let panelTextProps = defaultWidgetTextProperties(DEFAULT_FONT);

      if(typeof panelTextProps.font === 'string'){
        // Load the font
        loader.load(panelTextProps.font, (font) => {
          panelTextProps.font = font;
          const basicPanelPropList = this.hvymData.basicPanelHVYMCollectionPropertyList(this.scene, this.box, panelTextProps, this.isPortal);
          this.CreateBasicHVYMPanel(basicPanelPropList);
          const uniquePanelPropList = this.hvymData.uniquePanelHVYMCollectionPropertyList(this.scene, this.box, panelTextProps, this.isPortal);
          this.CreateUniqueHVYMPanel(uniquePanelPropList);
          this.isHVYM = true;
        });
      }
    }
  }
  UpdateAnimation(delta){
    if(this.hvymData != undefined && this.hvymData.mixer != undefined){
      this.hvymData.mixer.update(delta);
    }
  }
  CreateBasicHVYMPanel(panelPropList){
    panelPropList.forEach((panelProps, index) =>{
      let panel = undefined;
      if(index == 0){
        panel = new BasePanel(panelProps);
      }else{
        let lastPanel = this.hvymPanels[index-1];
        panelPropList[index].boxProps.parent = lastPanel.bottom.box;
        panel = new BasePanel(panelPropList[index]);
        panel.AlignAsBottomSibling();
      }

      if(panel != undefined){
        this.hvymPanels.push(panel);
      }
    });

    if(this.isPortal && this.hvymPanels.length>0){
      this.hvymPanels[0].MakePortalChild(this.stencilRef);
    }
    
  }
  CreateUniqueHVYMPanel(panelPropList){
    for (const [menuTransform, panelProps] of Object.entries(panelPropList)) {
      let panel = new BasePanel(panelProps);
      if(panelProps.attach == 'LEFT'){
        panel.AlignLeftOfTransform();
      }else if(panelProps.attach == 'RIGHT'){
        panel.AlignRightOfTransform();
      }else{
        panel.box.set(0,0,0);
      }
      
      if(panel != undefined){
        this.hvymPanels.push(panel);
      }
      if(this.isPortal && this.hvymPanels.length>0){
        panel.MakePortalChild(this.stencilRef);
      }
    }
  }
  MakeModelPortalChild(stencilRef){
    this.stencilRef = stencilRef;
    this.MakeChidrenStencilChild(this.gltf.scene, stencilRef);
  }
  ConvertToPortalChild(stencilRef){
    setupStencilChildMaterial(this.box.material, stencilRef);
    this.MakeModelPortalChild(stencilRef);
  }
  static SetupPortalProps(gltfProps){
    gltfProps.boxProps.isPortal = true;
    gltfProps.boxProps.matProps.useCase = 'STENCIL';

    return gltfProps
  }

};

/**
 * This function creates a gltf model widget based on passed property set. Handles font loading
 * in the case that font isnt loaded.
 * @param {object} gltfProps (gltfProperties) Properties used for model widget.
 * 
 * @returns {null} no return value.
 */
function GLTFModelWidgetLoader(gltfProps){
  if(typeof DEFAULT_TEXT_PROPS.font === 'string'){
    // Load the font
    loader.load(DEFAULT_TEXT_PROPS.font, (font) => {
      DEFAULT_TEXT_PROPS.font = font;
      ListItemBox.SetListConfigFont(gltfProps.listConfig, font);
      let model = new GLTFModelWidget(gltfProps);
      model.scene.gltfModels.push(model);
    });
  }else if(DEFAULT_TEXT_PROPS.font.isFont){
    ListItemBox.SetListConfigFont(gltfProps.listConfig, DEFAULT_TEXT_PROPS.font);
    let model = new GLTFModelWidget(gltfProps);
    model.scene.gltfModels.push(model);
  }
}

/**
 * This function creates a gltf model widget based on passed property set.
 * @param {object} gltfProps (gltfProperties) Properties used for model widget.
 * 
 * @returns {null} no return value.
 */
export function createGLTFModel(gltfProps){
    gltfProps.boxProps.isPortal = false;
    console.log(gltfProps)
  if(typeof gltfProps.gltf === 'string'){
    // Instantiate a loader
    gltfLoader.load( gltfProps.gltf,function ( gltf ) {
        console.log('gltf!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
        console.log(gltf)
        gltfProps.hvymData = new HVYM_Data(gltf);
        gltfProps.gltf = gltf;
        GLTFModelWidgetLoader(gltfProps);
        console.log('hvymData&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&')
        console.log(gltfProps.hvymData)
      },
      // called while loading is progressing
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( error );
      }
    );
  }else if(gltfProps.gltf.scene != undefined){
    gltfProps.hvymData = new HVYM_Data(gltf);
    GLTFModelWidgetLoader(gltfProps);
  }

};

/**
 * This function creates a gltf model widget portal(inset inside of parent, 
 * rendered using stencil ref) based on passed property set.
 * @param {object} gltfProps (gltfProperties) Properties used for model widget.
 * 
 * @returns {null} no return value.
 */
export function createGLTFModelPortal(gltfProps){
  gltfProps = GLTFModelWidget.SetupPortalProps(gltfProps);
  if(typeof gltfProps.gltf === 'string'){
    // Instantiate a loader
    gltfLoader.load( gltfProps.gltf,function ( gltf ) {
        console.log(gltf)
        gltfProps.hvymData = new HVYM_Data(gltf);
        gltfProps.gltf = gltf;
        GLTFModelWidgetLoader(gltfProps);
      },
      // called while loading is progressing
      function ( xhr ) {
        console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      // called when loading has errors
      function ( error ) {
        console.log( error );
      }
    );
  }else if(gltfProps.gltf.scene != undefined){
    GLTFModelWidgetLoader(gltfProps);
  }
}

/**
 * Enable model drag and drop upload for page.
 *
 * @param {object} parent Object3D.
 */
export function GLTFDragAndDrop(parent) {
  document.addEventListener('dragover', (e) => {
      e.preventDefault()
  });
  document.addEventListener('drop', (e) => {
      e.preventDefault()

      const file = e.dataTransfer.files[0];
      const filename = file.name;
      const extension = filename.split( '.' ).pop().toLowerCase();


      if(extension == 'glb'){
        const reader = new FileReader();
        reader.addEventListener( 'progress', function ( event ) {

          const progress = Math.floor( ( event.loaded / event.total ) * 100 ) + '%';

          console.log( 'Loading', filename, progress );

        } );

        reader.addEventListener( 'load', async function ( event ) {

          const contents = event.target.result;
          const dracoLoader = new DRACOLoader();
          dracoLoader.setDecoderPath( '../examples/js/libs/draco/gltf/' );
          const loader = new GLTFLoader();
          loader.setDRACOLoader( dracoLoader );

          loader.parse( contents, '', function ( gltf ) {
            const size = getGeometrySize(parent.geometry);
            const boxProps = boxProperties(gltf.scene.name, parent, size.width, size.height, size.depth, 3, 0.02);
            const gltfProps = gltfProperties(boxProps, gltf.scene.name, gltf);
            gltfProps.hvymData = new HVYM_Data(gltf);
            GLTFModelWidgetLoader(gltfProps);
          } );

        }, false );
        reader.readAsArrayBuffer( file );
      }else{
        alert('Only .glb model supported currently.')
      }

  });
};

/**
 * This function creates a list item config.
 * @param {object} boxProps (boxProperties) Dimensions of element box mesh.
 * @param {object} textProps (textProperties) Properties of text.
 * @param {object} animProps (animationProperties) 
 * @param {object} infoProps (infoProperties) Information displayed
 * @param {bool} [useTimeStamp=true]
 * @param {number} [spacing=0] Spacing between list elements.
 * @param {number} [childInset=0.9] Amount content is inset.
 * @param {number} [index=0] Index of the list element.
 * 
 * @returns {object} Data object for configuring List Items.
 */
export function listItemConfig( scene, boxProps, textProps,  animProps, infoProps, useTimeStamp=true, spacing=0, childInset=0.9, index=0){
  return {
    'type': 'LIST_CONFIG',
    'scene': scene,
    'boxProps': boxProps,
    'textProps': textProps,
    'animProps': animProps,
    'infoProps': infoProps,
    'useTimeStamp': useTimeStamp,
    'spacing': spacing,
    'childInset': childInset,
    'index': index
  }
}

/**
 * Creates a list item box container for the object that has a list item config.
 *
 * @param {object} ListItemConfig.
 */
export class ListItemBox extends BaseBox {
  constructor(listConfig) {

    super(listConfig.boxProps);
    this.is = 'LIST_ITEM_BOX';
    this.box.userData.properties = listConfig;
    this.textProps = listConfig.textProps;
    this.listTextMaterial = getMaterial(listConfig.textProps.matProps);
    this.childInset = listConfig.childInset;
    this.spacing = listConfig.spacing;
    this.index = listConfig.index;
    this.BaseText = new BaseText(this.textProps);
    this.BaseText.SetParent(this);
    this.BaseText.SetMaterial(this.listTextMaterial);

    let textMeshOffset = 1;
    this.textZPos = (this.depth*2)+this.textProps.size*2;


    if(this.isPortal){
      this.SetStencilRef(getStencilRef());
      this.ConvertBoxMaterialToPortalMaterial();
      setupStencilChildMaterial(this.listTextMaterial, this.box.material.stencilRef);

      textMeshOffset = -1;
    }  

    let infoProps = listConfig.infoProps;
    let date = this.NewDate();

    if(infoProps.title.length>0){
      this.titleText = this.BaseText.NewSingleTextMesh('titleText', infoProps.title);
      this.BaseText.CenterTopTextPos('titleText');
      this.box.userData.title = this.titleText;
    }

    if(infoProps.author.length>0){
      this.authorText = this.BaseText.NewSingleTextMesh('authorText', infoProps.author);
      this.BaseText.LeftBottomCornerTextPos('authorText');
      this.box.userData.author = this.authorText;
    }

    this.dateText = this.BaseText.NewSingleTextMesh('dateText', date, 0.5);
    this.BaseText.LeftBottomCornerTextPos('dateText');
    this.box.userData.date = this.dateText;

    if( this.authorText != undefined){
      this.authorText.translateY(this.dateText.userData.size.height+this.BaseText.padding);
    }

    this.box.translateY(-(this.size.height+this.padding)*this.index);

  }
  SetContent(content){
    this.listTextMaterial.depthWrite = true;
    if(this.titleText!=undefined && content.widgetText!=undefined){
      content.box.parent.remove(content.widgetText);
    }
    this.box.add(content.box);
    
    if(content.box.userData.properties.boxProps.isPortal && !this.isPortal){
      this.box.material.stencilWrite = false;
      this.box.material.depthWrite = false;
    }
    if(this.isPortal){
      if(content.gltf!=undefined){
        this.box.add(content.gltf.scene)
        if(content.isPortal){
          content.MakeModelPortalChild(this.box.material.stencilRef);
          content.MakeBoxMaterialInvisible();
          content.box.material.depthWrite = false;
          // if(content.hasOwnProperty('hvymPanels') && content.hvymPanels.length>0){
          //   content.hvymPanels[0].MakePortalChild(this.box.material.stencilRef)
          // }
        }
        
      }
      if(content.textMesh!=undefined){
        let zPos = content.textMeshSize.depth*2;
        this.box.material.depthWrite = false;
        this.box.add(content.textMesh);
        content.NewTextMeshStencilMaterial(this.box.material.stencilRef);
        content.textMesh.translateZ(zPos);
        content.textMesh.material.depthWrite = true;
        content.MakeBoxMaterialInvisible();
      }
      if(content.imageMaterial!=undefined){
        content.NewImageBoxStencilMaterial(this.box.material.stencilRef);
      }
      content.AlignCenter();
      content.box.scale.set(content.box.scale.x*this.childInset, content.box.scale.y*this.childInset, content.box.scale.z*this.childInset);
      
      this.box.material.stencilWrite = true;
      this.box.material.depthWrite = false;
      this.box.material.stencilFunc = THREE.AlwaysStencilFunc;
      this.box.material.stencilZPass = THREE.ReplaceStencilOp;
    }
  }
  CreateListTextGeometry(text, sizeMult=1){
    return BaseText.CreateTextGeometry(text, this.textProps.font, this.textProps.size*sizeMult, this.textProps.height, this.textProps.meshProps.curveSegments, this.textProps.meshProps.bevelEnabled, this.textProps.meshProps.bevelThickness, this.textProps.meshProps.bevelSize, this.textProps.meshProps.bevelOffset, this.textProps.meshProps.bevelSegments);
  }
  NewTextMeshStencilMaterial(stencilRef){
    this.listTextMaterial = getMaterial(this.box.userData.properties.textProps.matProps, stencilRef);
  }
  ListText(text, sizeMult=1){
    const geometry = this.CreateListTextGeometry(text, sizeMult);
    geometry.center();
    let mesh = new THREE.Mesh(geometry, this.listTextMaterial);
    mesh.userData.size = getGeometrySize(geometry);
    return  mesh
  }
  UpdateTitleText(text){
    this.titleText.geometry.dispose();
    this.titleText.geometry = this.CreateListTextGeometry(text);
  }
  UpdateAuthorText(text){
    this.authorText.geometry.dispose();
    this.authorText.geometry = this.CreateListTextGeometry(text);
  }
  UpdateDateText(){
    this.titleText.geometry.dispose();
    this.titleText.geometry = this.CreateListTextGeometry(this.NewDate());
  }
  NewDate(){
    let timestamp = Number(new Date());
    return new Date(timestamp).toString();
  }
  static SetListConfigFont(listConfig, font){
    if(listConfig!=undefined){
      listConfig.textProps.font = font;
    }
  }

};

/**
 * This function creates a list of text elements.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createStaticTextList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticTextBox(props);
  });

};

/**
 *  This function creates a list of text element portals(inset inside of parent, 
 * rendered using stencil ref) based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createStaticTextPortalList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticTextPortal(props);
  });

};

/**
 * This function creates a scrollable list of text elements.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createStaticScrollableTextList( textBoxProps, contentArr ) {
  if(listConfig.boxProps.parent.isScene)
    return;
  let listConfig = textBoxProps.listConfig;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticScrollableTextBox(props);
  });

};

/**
 *  This function creates a scrollable list of text element portals(inset inside of parent, 
 * rendered using stencil ref) based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createStaticScrollableTextPortalList( textBoxProps, contentArr ) {
  let listConfig = textBoxProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createStaticScrollableTextPortal(props);
  });

};

/**
 * This function creates a list of multi-mesh text elements.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createMultiTextList( textBoxProps, contentArr  ) {
  if(listConfig.boxProps.parent.isScene)
    return;
  let listConfig = textBoxProps.listConfig;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiTextBox(props);
  });

};


/**
 *  This function creates a list of multi-mesh text element portals(inset inside of parent, 
 * rendered using stencil ref) based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createMultiTextPortalList( textBoxProps, contentArr  ) {
  let listConfig = textBoxProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiTextPortal(props);
  });

};

/**
 * This function creates a scrollable list of multi-mesh text elements.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createMultiScrollableTextList( textBoxProps, contentArr ) {
  if(listConfig.boxProps.parent.isScene)
    return;
  let listConfig = textBoxProps.listConfig;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiScrollableTextBox(props);
  });

};

/**
 *  This function creates a scrollable list of multi-mesh text element portals(inset inside of parent, 
 * rendered using stencil ref) based on passed property set.
 * @param {object} textBoxProps (textBoxProperties) Properties used for text list.
 * @param {object} contentArr array of text blocks to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createMultiScrollableTextPortalList(textBoxProps, contentArr) {
  let listConfig = textBoxProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((text, index) =>{
    let props = {...textBoxProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.text = text;
    props.listConfig = lConfig;
    createMultiScrollableTextPortal(props);
  });

};

/**
 * This function creates a list of image elements.
 * @param {object} imageProps (imageProperties) Properties used for image list.
 * @param {object} contentArr array of images to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createImageContentList( imageProps, contentArr ) {
  if(listConfig.boxProps.parent.isScene)
    return;
  let listConfig = imageProps.listConfig;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((imgUrl, index) =>{
    let props = {...imageProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createImageBox(props);
  });

};

/**
 * This function creates a list of gltf model elements.
 * @param {object} gltfProps (gltfProperties) Properties used for model list.
 * @param {object} contentArr array of models to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createGLTFContentList(gltfProps, contentArr) {
  let listConfig = gltfProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];
  gltfProps.listConfig.boxProps.isPortal = false;
  gltfProps.boxProps.isPortal = false;

  contentArr.forEach((gltfUrl, index) =>{
    let props = {...gltfProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createGLTFModel(props);
  });

};

/**
 * This function creates a list of gltf model portal elements.
 * @param {object} gltfProps (gltfProperties) Properties used for model list.
 * @param {object} contentArr array of models to be rendered.
 * 
 * @returns {null} no return value.
 */
export function createGLTFContentPortalList(gltfProps, contentArr) {
  let listConfig = gltfProps.listConfig;
  if(listConfig.boxProps.parent.isScene)
    return;
  listConfig.boxProps.parent.userData.listElements = [];

  contentArr.forEach((gltfUrl, index) =>{
    let props = {...gltfProps};
    let lConfig = listItemConfig(listConfig.boxProps, listConfig.textProps, listConfig.animProps, listConfig.infoProps, listConfig.useTimeStamp, listConfig.spacing, listConfig.childInset, index);
    props.listConfig = lConfig;
    createGLTFModelPortal(props);
  });

};

/**
 * This function creates a translation controller to passed element.
 * @param {object} elem target Object3D, that gizmo will be attached to.
 * @param {object} camera camera currently used in scene.
 * @param {object} renderer used in scene.
 * 
 * @returns {null} no return value.
 */
export function addTranslationControl(elem, camera, renderer){
  control = new TransformControls( camera, renderer.domElement );
  control.addEventListener( 'change', render );
  control.attach( elem );
};
