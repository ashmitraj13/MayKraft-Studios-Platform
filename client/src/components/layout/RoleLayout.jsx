import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../context/AuthContext';

export default function RoleLayout() {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} open={menu} onClose={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenu(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
