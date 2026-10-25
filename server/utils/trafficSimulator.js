const trafficLevels = ['low', 'moderate', 'heavy'];

function simulateTraffic(graph, level = 'moderate') {
  if (!graph || !Array.isArray(graph.edges)) {
    throw new Error('Invalid graph for traffic simulation');
  }

  const normalizedLevel = trafficLevels.includes(level) ? level : 'moderate';
  const multiplier = {
    low: 1.0,
    moderate: 1.35,
    heavy: 1.8,
  };

  const updatedEdges = graph.edges.map((edge) => {
    const baseMinutes = edge.baseEstimatedMinutes ?? edge.estimatedMinutes ?? 10;
    const updatedMinutes = Math.round(baseMinutes * multiplier[normalizedLevel]);
    return {
      ...edge,
      baseCost: edge.baseCost ?? edge.cost ?? 10,
      baseEstimatedMinutes: baseMinutes,
      traffic: normalizedLevel,
      estimatedMinutes: updatedMinutes,
      cost: Number(((edge.baseCost ?? edge.cost ?? 10) * multiplier[normalizedLevel]).toFixed(2)),
    };
  });

  return {
    ...graph,
    edges: updatedEdges,
    trafficLevel: normalizedLevel,
    trafficMultiplier: multiplier[normalizedLevel],
    affectedEdges: updatedEdges.map((edge) => edge.id),
  };
}

module.exports = { simulateTraffic, trafficLevels };
