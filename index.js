'use strict';

const pong = document.querySelector('.pong');
const controls = document.querySelector('.controls');
const allCircles = document.querySelectorAll('.pong circle');
const fixed = document.querySelectorAll('.fixed circle');
const mobileGroup = document.querySelector('.mobile');
const mobile = document.querySelectorAll('.mobile circle');
const player1 = document.querySelectorAll('.player1 circle');
const player2 = document.querySelectorAll('.player2 circle');

const players = {
  1: player1,
  2: player2,
};

const distanceScale = 10;//larger number slower particles
const chargeScale = 500;//larger number faster particles
const physicsLoopCount = 40;//larger number smoother physics, higher CPU usage, slower frame rate

const boardDimensions = {
  minX: 0,
  minY: 0,
  maxX: 1920,//pong.clientWidth,
  maxY: 1080,//pong.clientHeight,
  width: 1920,//pong.clientWidth,
  height: 1080,//pong.clientHeight,
  'center-x': 1920 / 2,// pong.clientWidth / 2,
  'center-y': 1080 / 2,//pong.clientHeight / 2,
};

// console.log(boardDimensions);

const eventHistory = [];

function handleTouch(ev) {
  if(ev.type === 'touchmove' && ev.touches.length === 1) {
    // console.log(ev);
    //set_position(players[JSON.parse(decodeURI(window.location.hash.slice(1))).player], property, ev.touches[0].pageY);
    set_position(players[1], 'y', ev.touches[0].pageY / pong.clientHeight * boardDimensions.maxY);
  }
  ev.preventDefault();
}

function startHandlingTouch() {
  document.documentElement.addEventListener("touchstart", handleTouch, {passive: false});
  document.documentElement.addEventListener("touchend", handleTouch, {passive: false});
  document.documentElement.addEventListener("touchcancel", handleTouch, {passive: false});
  document.documentElement.addEventListener("touchmove", handleTouch, {passive: false});
}

function stopHandlingTouch() {
  document.documentElement.removeEventListener("touchstart", handleTouch, {passive: false});
  document.documentElement.removeEventListener("touchend", handleTouch, {passive: false});
  document.documentElement.removeEventListener("touchcancel", handleTouch, {passive: false});
  document.documentElement.removeEventListener("touchmove", handleTouch, {passive: false});
}

async function start() {
  // console.log('start', mobileGroup);
  mobileLocations = new Map(initialMobileLocations.entries());
  mobileLocations.forEach(({x, y}, m)=> {
    mobileGroup.appendChild(m);
    // console.log('mobileGroup', m);
    set_particle_position(m, {x, y});
  });
  await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  await screen.orientation.lock("landscape");
  pong.classList.remove('hidden');
  controls.classList.add('hidden');
  renderLoop(multiPhysics.bind(null, physicsLoopCount));
  playerFunctions.player2_auto();
  startHandlingTouch();
}

document.querySelectorAll('.select-player').forEach((element)=> element.addEventListener('click', ({target: {dataset}})=> {
  location.hash=`#${JSON.stringify({player: JSON.parse(dataset.player)})}`;
}));

let localOnly = true;

function renderLoop(func) {
  function renderOnce() {
    if(func()) {
      requestAnimationFrame(renderOnce);
    }
  }
  requestAnimationFrame(renderOnce);
}

function differenceVector(a, b) {
  return {
    x: (b.x - a.x),
    y: (b.y - a.y),
  };
}

function magnitude(a, b) {
  const vec = differenceVector(a, b);
  return vec.x ** 2 + vec.y ** 2;
}

function distance(a, b) {
  return Math.sqrt(magnitude(a, b));
}

function forceVector(a, b) {
  const vec = differenceVector(a, b);
  const dist = distance(a, b);
  const normVec = {x: vec.x / dist, y: vec.y / dist};
  const scale = -1 / ((dist * distanceScale) ** 2) * chargeScale;
  return {
    x: normVec.x * scale,
    y: normVec.y * scale,
  };
}

const initialFixedLocations = new Map([...fixed].map(f=> ([f,{x: f.cx.baseVal.valueInSpecifiedUnits, y: f.cy.baseVal.valueInSpecifiedUnits}])));

const fixedLocations = new Map([...fixed].map(f=> ([f,{x: f.cx.baseVal.valueInSpecifiedUnits, y: f.cy.baseVal.valueInSpecifiedUnits}])));

const initialMobileLocations = new Map([...mobile].map(m=> ([m, {
  x: m.cx.baseVal.valueInSpecifiedUnits,
  y: m.cy.baseVal.valueInSpecifiedUnits,
  dx: parseFloat(m.dataset.dx),
  dy: parseFloat(m.dataset.dy),
}])));

let mobileLocations = new Map([...mobile].map(m=> ([m, {
  x: m.cx.baseVal.valueInSpecifiedUnits,
  y: -m.cy.baseVal.valueInSpecifiedUnits, /* set negative to force offscreen */
  dx: parseFloat(m.dataset.dx),
  dy: parseFloat(m.dataset.dy),
}])));

function set_particle_position(particle, pos) {
  particle.setAttribute('cx', pos.x);
  particle.setAttribute('cy', pos.y);
}

function physics() {
  const newMobileLocations = new Map();
  for(let [m, mp] of mobileLocations.entries()) {
    const fv = [...fixedLocations.values()].map((fp)=>forceVector(mp, fp)).reduce((p, c)=> ({x: p.x + c.x, y: p.y + c.y}), {x: 0, y: 0});
    const sv = [...mobileLocations.entries()].filter(([f, fp])=>f!==m).map(([f, fp])=>forceVector(mp, fp)).reduce((p, c)=> ({x: p.x + c.x, y: p.y + c.y}), fv);
    const dx = mp.dx + sv.x;
    const dy = mp.dy + sv.y;
    const x = mp.x + dx;
    const y = mp.y + dy;
    if(x < boardDimensions.minX || y < boardDimensions.minY || x > boardDimensions.maxX || y > boardDimensions.maxY) {
      m.parentNode.removeChild(m);
      /* count the score of a particle leaving */
      continue;
    }
    newMobileLocations.set(m, {x, y, dx, dy});
    set_particle_position(m, {x, y});
  }
  mobileLocations = newMobileLocations;
  if(mobileLocations.size === 0) {
    const exitPromise = document.exitFullscreen();
    exitPromise.then(()=> {
      stopHandlingTouch();
      pong.classList.add('hidden');
      controls.classList.remove('hidden');
    });
    return false;
  } else {
    return true;
  }
}

const multiPhysics = ((loopCount = 1)=> { let ret; for(let i = 0; i < loopCount; i++) { ret = physics(); if(!ret) break; }  return ret; })

function set_position(group, property, y) {
  for(let e of group) {
    fixedLocations.get(e)[property] = initialFixedLocations.get(e)[property] + y;
    e.cy.baseVal.valueInSpecifiedUnits = fixedLocations.get(e)[property];
  }
}

function sum_mobile_posistions() {
  return [...mobileLocations.values()].reduce((p, c)=> ({x: p.x + c.x, y: p.y + c.y}), {x: 0, y: 0});
}

function average_mobile_positions() {
  const sum_of_positions = sum_mobile_posistions();
  const count = Math.max(mobileLocations.size, 1); // avoid div by zero
  const avg = {
    x: sum_of_positions.x / count,
    y: sum_of_positions.y / count,
  };
  return avg;
}

function select_mobile_position(selectFunc) {
  return [...mobileLocations.values()].reduce((p, c)=> selectFunc(p, c));
}

const selectLargeX = (a, b)=> a.x > b.x?a:b
const selectSmallX = (a, b)=> a.x < b.x?a:b
const selectLargeY = (a, b)=> a.y > b.y?a:b
const selectSmallY = (a, b)=> a.y < b.y?a:b

function auto_player(group, selectFunc, selectedProp) {
  if(!mobileLocations.size) { return ; }
  let playerGroup;
  try {
    playerGroup = players[JSON.parse(decodeURI(window.location.hash.slice(1))).player];
  } catch(err) {

  }
  if(group !== playerGroup) {
    const closest = select_mobile_position(selectFunc);
    set_position(group, selectedProp, closest[selectedProp]);
  }
  return true;
}

function mouse_player(group, property) {
  try {
    document.body.addEventListener('mousemove', ({x, y})=> {
      try {
        set_position(players[JSON.parse(decodeURI(window.location.hash.slice(1))).player], property, y);
      } catch(err) {
        
      }
    });

    const player = JSON.parse(decodeURI(window.location.hash.slice(1))).player;
    set_position(players[player], property, boardDimensions[`center-${property}`]);
  } catch(err) {

  }
}

const playerFunctions = {
  player2_auto:  renderLoop.bind(null, auto_player.bind(null, player2, selectLargeX, 'y')),
  player2_mouse:  mouse_player.bind(null, player2, 'y'),
}

if(localOnly) {
  document.querySelector('.start').addEventListener('click', start);
  // console.log(document.querySelector('.start'));
}