/**
 * Graph Highlight Module
 * Safe graph node/edge highlight helpers extracted from app.js.
 */

window.AdminGraphHighlightModule = (function () {
  'use strict';

  function resetGraphHighlight(deps = {}) {
    const {
      getNetworkGraph = () => null,
      highlightedNodes,
      highlightedEdges,
      setSelectedNodeId = () => {}
    } = deps;

    const networkGraph = getNetworkGraph();
    if (!networkGraph) return;

    const nodes = networkGraph.body.data.nodes;
    const edges = networkGraph.body.data.edges;

    const nodeUpdates = nodes.get().map((node) => ({
      id: node.id,
      color: node.baseColor || node.color,
      font: { ...(node.font || {}), color: "#fff" },
    }));

    const edgeUpdates = edges.get().map((edge) => ({
      id: edge.id,
      color: { color: edge.baseColor || (edge.color && edge.color.color) || edge.color },
      width: edge.baseWidth || edge.width,
      dashes: false,
    }));

    nodes.update(nodeUpdates);
    edges.update(edgeUpdates);

    if (highlightedNodes && typeof highlightedNodes.clear === "function") {
      highlightedNodes.clear();
    }

    if (highlightedEdges && typeof highlightedEdges.clear === "function") {
      highlightedEdges.clear();
    }

    setSelectedNodeId(null);
  }

  function applyGraphHighlight(nodeId, deps = {}) {
    const {
      getNetworkGraph = () => null,
      getSelectedNodeId = () => null,
      setSelectedNodeId = () => {},
      resetGraphHighlightFn = () => {}
    } = deps;

    const networkGraph = getNetworkGraph();
    if (!networkGraph) return;

    if (getSelectedNodeId() === nodeId) {
      resetGraphHighlightFn();
      return;
    }

    setSelectedNodeId(nodeId);

    const nodes = networkGraph.body.data.nodes;
    const edges = networkGraph.body.data.edges;

    const connectedNodes = new Set(networkGraph.getConnectedNodes(nodeId));
    const connectedEdges = new Set(networkGraph.getConnectedEdges(nodeId));
    connectedNodes.add(nodeId);

    const nodeUpdates = nodes.get().map((node) => {
      const isConnected = connectedNodes.has(node.id);
      return {
        id: node.id,
        color: isConnected ? (node.baseColor || node.color) : { background: "#1f2937", border: "#0f172a" },
        font: { ...(node.font || {}), color: isConnected ? "#fff" : "#6b7280" },
      };
    });

    const edgeUpdates = edges.get().map((edge) => {
      const isConnected = connectedEdges.has(edge.id);
      return {
        id: edge.id,
        color: { color: isConnected ? (edge.baseColor || (edge.color && edge.color.color) || edge.color) : "#1f2937" },
        width: isConnected ? (edge.baseWidth || edge.width) + 1 : 1,
        dashes: !isConnected,
      };
    });

    nodes.update(nodeUpdates);
    edges.update(edgeUpdates);
  }

  return {
    resetGraphHighlight,
    applyGraphHighlight,
  };
})();
