import type { ChronicleStore, ChronicleEntity, ChronicleRelation } from "./store.js";

export interface GraphNode {
  entity: ChronicleEntity;
  relations: Array<{
    relation: ChronicleRelation;
    target: ChronicleEntity;
    direction: "outgoing" | "incoming";
  }>;
}

export interface GraphTraversalResult {
  root: ChronicleEntity;
  nodes: GraphNode[];
  depth: number;
}

export class KnowledgeGraph {
  private store: ChronicleStore;

  constructor(store: ChronicleStore) {
    this.store = store;
  }

  getNode(entityId: string): GraphNode | null {
    const entity = this.store.getEntity(entityId);
    if (!entity) return null;

    const rels = this.store.getRelations(entityId);
    const relations = rels.map((r) => ({
      relation: {
        id: r.id, from_id: r.from_id, to_id: r.to_id,
        type: r.type, metadata: r.metadata, created_at: r.created_at,
      },
      target: r.entity,
      direction: (r.from_id === entityId ? "outgoing" : "incoming") as "outgoing" | "incoming",
    }));

    return { entity, relations };
  }

  findNode(name: string, type?: string): GraphNode | null {
    const entity = this.store.findEntity(name, type);
    if (!entity) return null;
    return this.getNode(entity.id);
  }

  traverse(entityId: string, maxDepth = 2): GraphTraversalResult {
    const root = this.store.getEntity(entityId);
    if (!root) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const visited = new Set<string>();
    const nodes: GraphNode[] = [];

    this.traverseRecursive(entityId, 0, maxDepth, visited, nodes);

    return { root, nodes, depth: maxDepth };
  }

  private traverseRecursive(
    entityId: string,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    nodes: GraphNode[],
  ): void {
    if (visited.has(entityId) || currentDepth > maxDepth) return;
    visited.add(entityId);

    const node = this.getNode(entityId);
    if (!node) return;

    nodes.push(node);

    if (currentDepth < maxDepth) {
      for (const rel of node.relations) {
        this.traverseRecursive(rel.target.id, currentDepth + 1, maxDepth, visited, nodes);
      }
    }
  }

  addEntityWithRelations(
    name: string,
    type: ChronicleEntity["type"],
    properties: Record<string, unknown>,
    relations: Array<{ targetName: string; targetType: ChronicleEntity["type"]; relationType: ChronicleRelation["type"]; direction: "outgoing" | "incoming" }>,
  ): ChronicleEntity {
    const entity = this.store.addEntity(name, type, properties);

    for (const rel of relations) {
      const target = this.store.addEntity(rel.targetName, rel.targetType);
      if (rel.direction === "outgoing") {
        this.store.addRelation(entity.id, target.id, rel.relationType);
      } else {
        this.store.addRelation(target.id, entity.id, rel.relationType);
      }
    }

    return entity;
  }

  formatGraphText(result: GraphTraversalResult): string {
    const lines: string[] = [];
    lines.push(`Graph for: ${result.root.name} (${result.root.type})`);
    lines.push(`Depth: ${result.depth}, Nodes: ${result.nodes.length}`);
    lines.push("");

    for (const node of result.nodes) {
      lines.push(`[${node.entity.type}] ${node.entity.name}`);
      for (const rel of node.relations) {
        const arrow = rel.direction === "outgoing" ? "-->" : "<--";
        lines.push(`  ${arrow} (${rel.relation.type}) ${rel.target.name} [${rel.target.type}]`);
      }
    }

    return lines.join("\n");
  }
}
