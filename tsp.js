const canvas = document.getElementById('canvas');
const cx = canvas.getContext('2d');
const tiles = {
  FLOOR: 0,
  WALL: 1,
  CHIP: 2,
  PLAYER: 3,
  EXIT: 4
};
let map = [];
const SIZE_X = 32;
const SIZE_Y = 32;
const IMAGE_SIZE = 24;
let selection = tiles.WALL;
const image = new Image();
let playerCoords = new Coord(1, 1);
let exitCoords = new Coord(SIZE_X - 2, SIZE_Y - 2);
let stop = true;
let rectX = 0;
let rectY = 0;
let absoluteBestPath = [];
let absoluteBestChips = [];

function Coord(x, y) {
  this.x = x;
  this.y = y;
}

function QueueItem(coord, distance) {
  this.coord = coord;
  this.distance = distance;
}

canvas.addEventListener('mousemove', function(e) {
  const x = Math.floor(e.offsetX/IMAGE_SIZE);
  const y = Math.floor(e.offsetY/IMAGE_SIZE);
  rectX = x * IMAGE_SIZE;
  rectY = y * IMAGE_SIZE;
  draw();
});

canvas.addEventListener('click', function(e){
  const x = Math.floor(e.offsetX/IMAGE_SIZE);
  const y = Math.floor(e.offsetY/IMAGE_SIZE);
  
  if((x == playerCoords.x && y == playerCoords.y) ||
     (x == exitCoords.x && y == exitCoords.y)) {
    return;
  }
  
  if(selection == tiles.PLAYER) {
    map[playerCoords.y][playerCoords.x] = tiles.FLOOR;
	playerCoords.x = x;
	playerCoords.y = y;
  }
  
  else if(selection == tiles.EXIT) {
    map[exitCoords.y][exitCoords.x] = tiles.FLOOR;
	exitCoords.x = x;
	exitCoords.y = y;
  }
  
  absoluteBestPath = [];
  absoluteBestChips = [];
  
  map[y][x] = selection;
  draw();
});

document.getElementById('buttonAnneal').addEventListener('click', () => tsp());

document.getElementById('buttonStop').addEventListener('click', () => stop = true);

document.getElementById('levelClear').addEventListener('click', () => clear());

document.getElementById('levelBlobnet').addEventListener('click', () => blobnet());

document.getElementById("coolingSlider").addEventListener('input', () =>
  document.getElementById("coolingValue").innerHTML = document.getElementById("coolingSlider").value/1000
);

document.getElementById("iterSlider").addEventListener('input', () =>
  document.getElementById("iterValue").innerHTML = document.getElementById("iterSlider").value
);

document.getElementById("tempStartSlider").addEventListener('input', () =>
  document.getElementById("tempStartValue").innerHTML = document.getElementById("tempStartSlider").value
);

document.getElementById("tempMinSlider").addEventListener('input', () =>
  document.getElementById("tempMinValue").innerHTML = document.getElementById("tempMinSlider").value/100
);

function init() {
  for(let i = 0; i < SIZE_Y; i++) {
    map.push([]);
    for(let j = 0; j < SIZE_X; j++) {
	    if(i == 0 || i == SIZE_Y - 1 || j == 0 || j == SIZE_X - 1)
		  map[i].push(tiles.WALL);
		else 
		  map[i].push(tiles.FLOOR);
	  }
  }
  image.onload = draw;
  image.src = 'tilesMedium.png';
  map[playerCoords.y][playerCoords.x] = tiles.PLAYER;
  map[exitCoords.y][exitCoords.x] = tiles.EXIT;
  
  const sel = document.querySelectorAll('.tile');
  for(let i = 0; i < sel.length; i++) {
    sel[i].addEventListener('click', function(){
        sel[selection].classList.remove('selected');
        selection = i;
        sel[i].classList.add('selected');
    })
  }
}

function draw() {
  cx.clearRect(0, 0, canvas.width, canvas.height);
  for(let i = 0; i < SIZE_Y; i++)
    for(let j = 0; j < SIZE_X; j++)
	  cx.drawImage(image,
	  map[i][j] * IMAGE_SIZE, 0, IMAGE_SIZE, IMAGE_SIZE,
	  j * IMAGE_SIZE, i * IMAGE_SIZE, IMAGE_SIZE, IMAGE_SIZE);
  cx.strokeStyle = '#000000';
  cx.lineWidth = 1;
  cx.strokeRect(rectX, rectY, IMAGE_SIZE, IMAGE_SIZE);
  drawBestPath(absoluteBestPath, absoluteBestChips);
}

//TRAVELLING SALESMAN PROBLEM
function tsp() {
  stop = false;
  let graph = []; //Adjacency graph for graph
  let v = [new Coord(playerCoords.x, playerCoords.y)]; //Initialize the player as part of the graph
  let chips = 0;
  
  //Find all v and store their coordinates
  for(let i = 0; i < SIZE_Y; i++)
    for(let j = 0; j < SIZE_X; j++)
	  if(map[i][j] == tiles.CHIP) {
	    v.push(new Coord(j, i));
		chips++;
	  }
  if(chips < 2) {
    return;
  }
	  
  //Same for exit
  v.push(new Coord(exitCoords.x, exitCoords.y));
		
  //Initialize adjacency graph
  for(let i = 0; i < v.length; i++) {
    graph.push([]);
    for(let j = 0; j < v.length; j++)
	  graph[i].push(9999999); //Initial max value
  }
  
  //Use BFS for the player and each chip to find all the other v and exits
  for(let i = 0; i < chips + 1; i++)
	bfs(graph, v, i);
	
  //We now have the full graph. Time to solve the TSP with simulated annealing
  annealing(graph, chips, v);
}

function bfs(graph, v, i) {
  let visited = []; //Map of visited tiles
  for(let i = 0; i < SIZE_Y; i++) {
    visited.push([]);
    for(let j = 0; j < SIZE_X; j++)
	  visited[i].push(false);
  }
  let q = [new QueueItem(v[i], 0)]; //Queue for BFS starting at item i
  
  while(q.length > 0) { //While there are tiles to be visited
    const tile = q.shift(); //Take first item in queue
	
	if(visited[tile.coord.y][tile.coord.x] == false && map[tile.coord.y][tile.coord.x] != tiles.WALL) { //If not visited and not a wall
	  visited[tile.coord.y][tile.coord.x] = true;
	  if(tile.coord.y > 0) { //Up
	    let coord = new Coord(tile.coord.x, tile.coord.y - 1);
		q.push(new QueueItem(coord, tile.distance + 1));
	  }
	  if(tile.coord.y < SIZE_Y - 1) { //Down
	    let coord = new Coord(tile.coord.x, tile.coord.y + 1);
		q.push(new QueueItem(coord, tile.distance + 1));
	  }
	  if(tile.coord.x > 0) { //Left
	    let coord = new Coord(tile.coord.x - 1, tile.coord.y);
		q.push(new QueueItem(coord, tile.distance + 1));
	  }
	  if(tile.coord.x < SIZE_X - 1) { //Right
	    let coord = new Coord(tile.coord.x + 1, tile.coord.y);
		q.push(new QueueItem(coord, tile.distance + 1));
	  }
	  
	  if(map[tile.coord.y][tile.coord.x] == tiles.CHIP || map[tile.coord.y][tile.coord.x] == tiles.EXIT) //If chip or exit
	    graph[i][findCoord(v, tile.coord)] = tile.distance; //Set distance in graph matrix from i to the found tile
	}
  }
}

function randomPerm(n) {
  let perm = [];
  for(let i = 0; i < n; i++)
    perm.push(i);
  for(let i = 1; i < n - 2; i++) {
    let j = Math.floor(Math.random() * (n - i - 1)) + i;
	[perm[i], perm[j]] = [perm[j], perm[i]];
  }  
  return perm;
}

//Simulated annealing
function annealing(graph, chips, v) {
  const ITERATIONS = document.getElementById("iterSlider").value;
  const MIN_TEMP = document.getElementById("tempMinSlider").value/100;
  let temperature = document.getElementById("tempStartSlider").value;
  const cooling = document.getElementById("coolingSlider").value/1000;
  let bestPath = randomPerm(chips + 2); 
  let bestDistance = calculateDistance(graph, bestPath);
  absoluteBestPath = [...bestPath];
  let absoluteBestDistance = bestDistance;
  absoluteBestChips = [...v];
  anneal();
  
  function anneal() {
	  if(temperature > MIN_TEMP && !stop) {
	    window.requestAnimationFrame(anneal);
		temperature *= cooling;
		let startDistance = bestDistance;
		
		for(let i = 0; i < ITERATIONS; i++) {
		  let path = [...bestPath];
		  
		  let r = Math.random();
		  
		  if(r < 0.5) {
			let randomIndex1 = Math.floor(Math.random() * chips) + 1; //Select random index for swap between chips
			let randomIndex2;
			do {
		      randomIndex2 = Math.floor(Math.random() * chips) + 1; //Select another chip
			} while(randomIndex1 == randomIndex2);
			  
			[path[randomIndex1], path[randomIndex2]] = [path[randomIndex2], path[randomIndex1]]; //Swap
		  }
		  else if(r < 1) {
			let from = Math.floor(Math.random() * chips) + 1;
			let to;
			do {
			  to = Math.floor(Math.random() * chips) + 1;
			} while(from == to);
			path.splice(to, 0, path.splice(from, 1)[0]);
		  }
		  
		  let newDistance = calculateDistance(graph, path);
		  if(newDistance < bestDistance) { //If we found a better solution, accept it
			bestPath = [...path];
			bestDistance = newDistance;
		  }
		  else if(Math.exp((bestDistance - newDistance)/temperature) > Math.random()) { //If the solution is worse, maybe accept it
			bestPath = [...path];
			bestDistance = newDistance;
		  }
		  
		  if(newDistance < absoluteBestDistance) {
		    absoluteBestDistance = newDistance;
			absoluteBestPath = [...path];
		  }
		}
		
		let time = parseInt(document.getElementById('time').value);
		document.getElementById('besttime').innerHTML = "Finish time: " + (time + 1 - absoluteBestDistance/5);
		document.getElementById('timeLeft').innerHTML = "Temperature: " + temperature + " / " + MIN_TEMP;
		draw();
		
		if(bestDistance < startDistance) //Restart temperature when better solution is found
			temperature /= cooling;
	  }
  }
  let time = parseInt(document.getElementById('time').value);
  document.getElementById('besttime').innerHTML = "Finish time: " + (time + 1 - absoluteBestDistance/5);
  draw();
  return absoluteBestPath;
}

function calculateDistance(graph, path) {
  let distance = 0;
  for(let i = 1; i < path.length; i++)
	distance += graph[path[i - 1]][path[i]];
  return distance;
}

function drawBestPath(path, v) {
  if(path.length === 0 || v.length === 0) {
    return;
  }
  cx.strokeStyle = '#FF0000';
  cx.lineWidth = 3;

  cx.beginPath();
  cx.moveTo(v[path[0]].x * IMAGE_SIZE + IMAGE_SIZE / 2, v[path[0]].y * IMAGE_SIZE + IMAGE_SIZE / 2);
  for(let i = 1; i < path.length; i++)
    cx.lineTo(v[path[i]].x * IMAGE_SIZE + IMAGE_SIZE / 2, v[path[i]].y * IMAGE_SIZE + IMAGE_SIZE / 2);
  cx.stroke();
}

function findCoord(arr, coord) {
  for(let i = 0; i < arr.length; i++)
	if(arr[i].x == coord.x && arr[i].y == coord.y)
	  return i;
  return -1;
}

function blobnet() {
    map = [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,3,0,0,0,0,0,2,0,0,0,0,0,0,0,0,1],[1,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,2,0,0,2,0,0,2,0,0,0,2,0,0,2,0,0,2,0,0,2,0,0,0,2,0,0,2,0,0,2,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,1],[1,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,2,0,0,2,0,1,1,1,1,0,2,0,0,2,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,2,0,0,2,0,1,0,0,1,0,2,0,0,2,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,1],[1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,2,0,0,2,0,0,2,0,0,0,2,0,0,2,0,0,2,0,0,2,0,0,0,2,0,0,2,0,0,2,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,2,0,0,2,0,0,0,1],[1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]];
    playerCoords = new Coord(16, 1);
    exitCoords = new Coord(16, 15);
    absoluteBestPath = [];
    absoluteBestChips = [];
    draw();
}

function clear() {
    map = [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]];
    playerCoords = new Coord(1, 1);
    exitCoords = new Coord(SIZE_X - 2, SIZE_Y - 2);
    absoluteBestPath = [];
    absoluteBestChips = [];
    draw();
}

init();