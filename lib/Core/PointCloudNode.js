import * as THREE from 'three';
class PointCloudNode extends THREE.EventDispatcher {
  constructor() {
    let numPoints = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    let layer = arguments.length > 1 ? arguments[1] : undefined;
    super();
    this.numPoints = numPoints;
    this.layer = layer;
    this.children = [];
    this.bbox = new THREE.Box3();
    this.sse = -1;
  }
  add(node, indexChild) {
    this.children.push(node);
    node.parent = this;
    this.createChildAABB(node, indexChild);
  }
  load() {
    // Query octree/HRC if we don't have children potreeNode yet.
    if (!this.octreeIsLoaded) {
      this.loadOctree();
    }
    return this.layer.source.fetcher(this.url, this.layer.source.networkOptions).then(file => this.layer.source.parse(file, {
      out: this.layer,
      in: this.layer.source
    }));
  }
  findCommonAncestor(node) {
    if (node.depth == this.depth) {
      if (node.id == this.id) {
        return node;
      } else if (node.depth != 0) {
        return this.parent.findCommonAncestor(node.parent);
      }
    } else if (node.depth < this.depth) {
      return this.parent.findCommonAncestor(node);
    } else {
      return this.findCommonAncestor(node.parent);
    }
  }
}
export default PointCloudNode;