const PriorityQueue = require('./priorityQueue');

function haversineKm(start, end) {
  if (!start || !end) return 0;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const latDiff = toRad(end.lat - start.lat);
  const lonDiff = toRad(end.lng - start.lng);
  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(lonDiff / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function getEdgeWeight(edge, optimization) {
  if (optimization === 'time') return Number(edge.estimatedMinutes ?? edge.time ?? edge.travelTime ?? 0);
  return Number(edge.distanceKm ?? edge.distance ?? 0);
}

function buildNeighbors(graph) {
  const adjacency = new Map();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from).push({ node: edge.to, edge });
    adjacency.get(edge.to).push({ node: edge.from, edge });
  }
  return adjacency;
}

function findEdge(graph, from, to) {
  return graph.edges.find((edge) => {
    return (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from);
  });
}

function calculateAStar(graph, source, destination, optimization = 'distance') {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Invalid graph structure');
  }

  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodeMap.has(source) || !nodeMap.has(destination)) {
    throw new Error('Invalid node identifiers');
  }

  const sourceNode = nodeMap.get(source);
  const destinationNode = nodeMap.get(destination);

  if (source === destination) {
    return {
      path: [source],
      distanceKm: 0,
      estimatedMinutes: 0,
      totalCost: 0,
      pathNodes: [sourceNode],
      sourceNode,
      destinationNode,
      congestion: 'low',
    };
  }

  const openSet = new PriorityQueue();
  const closedSet = new Set();
  const gScore = new Map([[source, 0]]);
  const previous = new Map();
  const adjacency = buildNeighbors(graph);

  const heuristic = (nodeId) => {
    const currentNode = nodeMap.get(nodeId);
    const goalCoords = destinationNode?.coords ?? { lat: 0, lng: 0 };
    const nodeCoords = currentNode?.coords ?? { lat: 0, lng: 0 };
    if (optimization === 'time') {
      const distance = haversineKm(nodeCoords, goalCoords);
      return distance / 60; // lower bound in minutes if speed approximated at 60 km/h
    }
    return haversineKm(nodeCoords, goalCoords);
  };

  openSet.enqueue(source, heuristic(source));

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue();
    if (closedSet.has(current)) continue;
    if (current === destination) break;

    closedSet.add(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const nextNode = neighbor.node;
      if (closedSet.has(nextNode)) continue;

      const tentativeG = (gScore.get(current) ?? Number.MAX_SAFE_INTEGER) + getEdgeWeight(neighbor.edge, optimization);
      if (tentativeG < (gScore.get(nextNode) ?? Number.MAX_SAFE_INTEGER)) {
        previous.set(nextNode, current);
        gScore.set(nextNode, tentativeG);
        const nextPriority = tentativeG + heuristic(nextNode);
        openSet.enqueue(nextNode, nextPriority);
      }
    }
  }

  if (!gScore.has(destination)) {
    return {
      path: [],
      distanceKm: Infinity,
      estimatedMinutes: Infinity,
      totalCost: Infinity,
      pathNodes: [],
      sourceNode,
      destinationNode,
      congestion: 'heavy',
    };
  }

  const path = [];
  let current = destination;
  while (current) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }

  const totalDistance = path.slice(1).reduce((sum, nodeId, index) => {
    const prevNodeId = path[index];
    const edge = findEdge(graph, prevNodeId, nodeId);
    return sum + Number(edge?.distanceKm ?? edge?.distance ?? 0);
  }, 0);

  const totalMinutes = path.slice(1).reduce((sum, nodeId, index) => {
    const prevNodeId = path[index];
    const edge = findEdge(graph, prevNodeId, nodeId);
    return sum + Number(edge?.estimatedMinutes ?? edge?.time ?? 0);
  }, 0);

  const pathNodes = path.map((nodeId) => nodeMap.get(nodeId)).filter(Boolean);

  return {
    path,
    distanceKm: totalDistance,
    estimatedMinutes: totalMinutes,
    totalCost: totalDistance + totalMinutes * 0.4,
    pathNodes,
    sourceNode,
    destinationNode,
    congestion: totalMinutes > 25 ? 'heavy' : totalMinutes > 15 ? 'moderate' : 'low',
  };
}

module.exports = { calculateAStar };
