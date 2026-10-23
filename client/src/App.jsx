import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import RoleLayout from './components/layout/RoleLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { SkeletonList } from './components/ui';

const ManagerDashboard = lazy(() => import('./pages/manager/Dashboard'));
const Clients = lazy(() => import('./pages/manager/Clients'));
const ClientDetail = lazy(() => import('./pages/manager/ClientDetail'));
const ProjectDetail = lazy(() => import('./pages/manager/ProjectDetail'));
const ManagerVideo = lazy(() => import('./pages/manager/VideoDetail'));
const Editors = lazy(() => import('./pages/manager/Editors'));
const MyVideos = lazy(() => import('./pages/editor/MyVideos'));
const EditorVideo = lazy(() => import('./pages/editor/VideoDetail'));
const MyProjects = lazy(() => import('./pages/client/MyProjects'));
const ClientProject = lazy(() => import('./pages/client/ProjectView'));
const ClientVideo = lazy(() => import('./pages/client/VideoReview'));
const ChatPage = lazy(() => import('./pages/ChatPage'));

const guard = (role) => (
  <ProtectedRoute role={role}>
    <RoleLayout />
  </ProtectedRoute>
);

export default function App() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl p-8"><SkeletonList rows={5} /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login/:role" element={<Login />} />

        <Route path="/manager" element={guard('manager')}>
          <Route index element={<ManagerDashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="videos/:id" element={<ManagerVideo />} />
          <Route path="editors" element={<Editors />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>

        <Route path="/editor" element={guard('editor')}>
          <Route index element={<MyVideos />} />
          <Route path="videos/:id" element={<EditorVideo />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>

        <Route path="/client" element={guard('client')}>
          <Route index element={<MyProjects />} />
          <Route path="projects/:id" element={<ClientProject />} />
          <Route path="videos/:id" element={<ClientVideo />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
