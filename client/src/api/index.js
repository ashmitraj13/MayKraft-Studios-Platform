import http from './http';

const body = (r) => r.data; // { data, warning?, fromCache?, ... }

export const authApi = {
  login: (email, password, role) => http.post('/auth/login', { email, password, role }).then(body),
  me: () => http.get('/auth/me').then(body),
  register: (payload) => http.post('/auth/register', payload).then(body),
};

export const peopleApi = {
  clients: () => http.get('/clients').then(body),
  client: (id) => http.get(`/clients/${id}`).then(body),
  editors: (params) => http.get('/editors', { params }).then(body),
  managers: () => http.get('/managers').then(body),
  updateUser: (id, payload) => http.patch(`/users/${id}`, payload).then(body),
};

export const projectApi = {
  list: (params) => http.get('/projects', { params }).then(body),
  get: (id) => http.get(`/projects/${id}`).then(body),
  create: (payload) => http.post('/projects', payload).then(body),
  update: (id, payload) => http.patch(`/projects/${id}`, payload).then(body),
  remove: (id) => http.delete(`/projects/${id}`).then(body),
  addVideo: (id, payload) => http.post(`/projects/${id}/videos`, payload).then(body),
};

export const videoApi = {
  list: (params) => http.get('/videos', { params }).then(body),
  get: (id) => http.get(`/videos/${id}`).then(body),
  update: (id, payload) => http.patch(`/videos/${id}`, payload).then(body),
  remove: (id) => http.delete(`/videos/${id}`).then(body),
  assign: (id, editorId, editorDeadline) => http.patch(`/videos/${id}/assign`, { editorId, editorDeadline }).then(body),
  setStatus: (id, payload) => http.patch(`/videos/${id}/status`, payload).then(body),
  submitVersion: (id, payload) => http.post(`/videos/${id}/versions`, payload).then(body),
  feedback: (id) => http.get(`/videos/${id}/feedback`).then(body),
  addFeedback: (id, payload) => http.post(`/videos/${id}/feedback`, payload).then(body),
  resolveFeedback: (fid, resolved) => http.patch(`/feedback/${fid}/resolve`, { resolved }).then(body),
};

export const dashboardApi = {
  clients: (params) => http.get('/dashboard/clients', { params }).then(body),
};

export const chatApi = {
  list: () => http.get('/conversations').then(body),
  open: (participantId, projectId) => http.post('/conversations', { participantId, projectId }).then(body),
  messages: (id, params) => http.get(`/conversations/${id}/messages`, { params }).then(body),
  send: (id, payload) => http.post(`/conversations/${id}/messages`, payload).then(body),
  read: (id) => http.patch(`/conversations/${id}/read`).then(body),
};
