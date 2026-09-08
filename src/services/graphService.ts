import api from './api';
import type { GraphNode, GraphEdge, NodeType } from '../types';

export const graphService = {
  getNodes: (type?: NodeType) =>
    api.get<GraphNode[]>('/api/graph/nodes', { params: type ? { type } : {} }).then(r => r.data),
  getNode: (id: string) => api.get<GraphNode>(`/api/graph/nodes/${id}`).then(r => r.data),
  createNode: (data: Partial<GraphNode>) =>
    api.post<GraphNode>('/api/graph/nodes', data).then(r => r.data),
  updateNode: (id: string, data: Partial<GraphNode>) =>
    api.put<GraphNode>(`/api/graph/nodes/${id}`, data).then(r => r.data),
  deleteNode: (id: string) => api.delete(`/api/graph/nodes/${id}`),

  getEdges: () => api.get<GraphEdge[]>('/api/graph/edges').then(r => r.data),
  createEdge: (data: Partial<GraphEdge>) =>
    api.post<GraphEdge>('/api/graph/edges', data).then(r => r.data),
  deleteEdge: (id: string) => api.delete(`/api/graph/edges/${id}`),
};
