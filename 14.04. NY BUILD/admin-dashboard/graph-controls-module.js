/**
 * Graph Controls Module
 * Handles zoom and reset interactions for correlation network graph.
 */

window.AdminGraphControlsModule = (function () {
  'use strict';

  function setupGraphControls(deps = {}) {
    const {
      documentRef = document,
      safeAttach = () => false,
      getNetworkGraph = () => null,
      resetGraphHighlightFn = () => {}
    } = deps;

    const graphZoomIn = documentRef.getElementById("graphZoomIn");
    safeAttach(graphZoomIn, "click", () => {
      const networkGraph = getNetworkGraph();
      if (!networkGraph) return;
      const scale = networkGraph.getScale();
      networkGraph.moveTo({ scale: scale * 1.2 });
    }, "graphZoomIn");

    const graphZoomOut = documentRef.getElementById("graphZoomOut");
    safeAttach(graphZoomOut, "click", () => {
      const networkGraph = getNetworkGraph();
      if (!networkGraph) return;
      const scale = networkGraph.getScale();
      networkGraph.moveTo({ scale: scale / 1.2 });
    }, "graphZoomOut");

    const graphReset = documentRef.getElementById("graphReset");
    safeAttach(graphReset, "click", () => {
      const networkGraph = getNetworkGraph();
      if (!networkGraph) return;
      resetGraphHighlightFn();
      networkGraph.fit({ animation: { duration: 500, easingFunction: "easeInOutQuad" } });
    }, "graphReset");
  }

  return {
    setupGraphControls,
  };
})();
