const PriorityQueue = require('./priorityQueue');

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
    const matchesForward = edge.from === from && edge.to === to;
    const matchesReverse = edge.to === from && edge.from === to;
    return matchesForward || matchesReverse;
  });
}

function calculateRoute(graph, source, destination, optimization = 'distance') {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Invalid graph structure');
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(source) || !nodeIds.has(destination)) {
    throw new Error('Invalid node identifiers');
  }

  const sourceNode = graph.nodes.find((node) => node.id === source);
  const destinationNode = graph.nodes.find((node) => node.id === destination);

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

  const adjacency = buildNeighbors(graph);
  const queue = new PriorityQueue();
  const distanceMap = new Map([[source, 0]]);
  const previous = new Map();

  queue.enqueue(source, 0);

  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    const currentDistance = distanceMap.get(current) ?? Number.MAX_SAFE_INTEGER;

    for (const neighbor of adjacency.get(current) ?? []) {
      const nextNode = neighbor.node;
      const edgeWeight = getEdgeWeight(neighbor.edge, optimization);
      const tentativeDistance = currentDistance + edgeWeight;

      if (tentativeDistance < (distanceMap.get(nextNode) ?? Number.MAX_SAFE_INTEGER)) {
        distanceMap.set(nextNode, tentativeDistance);
        previous.set(nextNode, current);
        queue.enqueue(nextNode, tentativeDistance);
      }
    }
  }

  if (!distanceMap.has(destination)) {
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

  const pathNodes = path.map((nodeId) => graph.nodes.find((node) => node.id === nodeId)).filter(Boolean);

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

module.exports = { calculateRoute };
