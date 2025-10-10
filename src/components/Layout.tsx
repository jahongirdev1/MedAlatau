
import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { storage } from '@/utils/storage';
import GlobalTitleLock from '@/components/GlobalTitleLock';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Package,
  Users,
  FileText,
  UserCheck,
  Building2,
  ArrowLeftRight,
  LogOut,
  Menu,
  X,
  Truck,
  User,
  Clock,
  ClipboardList,
  Wallet,
  Receipt,
  BarChart3,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

type MenuItem = {
  path: string;
  icon: LucideIcon;
  label: string;
};

type MenuGroup = {
  type: 'group';
  label: string;
  items: MenuItem[];
};

type MenuEntry = MenuItem | MenuGroup;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = storage.getCurrentUser();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [sessionTimeLeft, setSessionTimeLeft] = React.useState<number>(0);

  // Check session validity and refresh session
  useEffect(() => {
    const checkAndRefreshSession = () => {
      if (currentUser) {
        if (!storage.isSessionValid()) {
          console.log('Session expired, logging out');
          storage.logout();
          navigate('/', { replace: true });
        } else {
          // Refresh session to extend time
          storage.refreshSession();
          // Update session time left
          setSessionTimeLeft(storage.getSessionTimeLeft());
        }
      }
    };

    checkAndRefreshSession();
    // Update every 30 seconds for more accurate countdown
    const interval = setInterval(checkAndRefreshSession, 30000);

    return () => clearInterval(interval);
  }, [currentUser, navigate]);

  const handleLogout = () => {
    console.log('Logging out user');
    storage.logout();
    navigate('/', { replace: true });
  };

  const formatTimeLeft = (timeInMs: number): string => {
    const hours = Math.floor(timeInMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeInMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeInMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    } else if (minutes > 0) {
      return `${minutes}м ${seconds}с`;
    } else {
      return `${seconds}с`;
    }
  };

  const adminMenuItems: MenuEntry[] = [
    { path: '/admin', icon: Home, label: 'Главная' },
    { path: '/admin/branches', icon: Building2, label: 'Филиалы' },
    { path: '/admin/medicine-categories', icon: FileText, label: 'Категории лекарств' },
    { path: '/admin/medical-devices-categories', icon: FileText, label: 'Категории ИМН' },
    { path: '/admin/medicines', icon: Package, label: 'Лекарства' },
    { path: '/admin/medical-devices', icon: Package, label: 'ИМН' },
    { path: '/admin/arrivals', icon: Truck, label: 'Поступления' },
    { path: '/admin/shipments', icon: ArrowLeftRight, label: 'Отправки' },
    { path: '/admin/requisitions', icon: ClipboardList, label: 'Заявки' },
    {
      type: 'group',
      label: 'Отслеживание',
      items: [
        { path: '/admin/tracking/payroll', icon: Wallet, label: 'Зарплата' },
        { path: '/admin/tracking/expenses', icon: Receipt, label: 'Расходы' },
        { path: '/admin/tracking/report', icon: BarChart3, label: 'Отчёт' },
      ],
    },
    { path: '/admin/employees', icon: Users, label: 'Сотрудники' },
    { path: '/admin/patients', icon: UserCheck, label: 'Пациенты' },
    { path: '/admin/reports/warehouse', icon: FileText, label: 'Отчёты склада' },
    { path: '/admin/reports/branches', icon: FileText, label: 'Отчёты филиалов' },
    { path: '/admin/analytics', icon: FileText, label: 'Аналитика' },
    { path: '/admin/calendar', icon: Clock, label: 'Календарь' },
    { path: '/admin/profile', icon: User, label: 'Личный кабинет' },
  ];

  const branchMenuItems: MenuItem[] = [
    { path: '/branch', icon: Home, label: 'Главная' },
    { path: '/branch/arrivals', icon: ArrowLeftRight, label: 'Поступления' },
    { path: '/branch/medical-devices', icon: Package, label: 'ИМН' },
    { path: '/branch/medicines', icon: Package, label: 'Лекарства' },
    { path: '/branch/dispensing', icon: Package, label: 'Выдачи' },
    { path: '/branch/requisitions', icon: ClipboardList, label: 'Заявки' },
    { path: '/branch/patients', icon: UserCheck, label: 'Пациенты' },
    { path: '/branch/employees', icon: Users, label: 'Сотрудники' },
    { path: '/branch/calendar', icon: Clock, label: 'Календарь' },
    { path: '/branch/reports', icon: FileText, label: 'Отчеты' },
  ];

  const menuItems: MenuEntry[] = currentUser?.role === 'admin'
    ? adminMenuItems
    : branchMenuItems;

  const renderLink = (item: MenuItem, isSub = false, groupKey?: string) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const baseClass = 'flex items-center py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors';
    const padding = sidebarOpen ? (isSub ? 'pl-8 pr-4' : 'px-4') : 'px-4';
    const activeClass = isActive ? 'bg-blue-100 text-blue-600 border-r-2 border-blue-600' : '';

    return (
      <Link
        key={`${groupKey ?? 'item'}-${item.path}`}
        to={item.path}
        className={`${baseClass} ${padding} ${activeClass}`}
      >
        <Icon className="h-5 w-5" />
        {sidebarOpen && <span className="ml-3">{item.label}</span>}
      </Link>
    );
  };

  if (!currentUser) {
    return (
      <div>
        <GlobalTitleLock />
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <GlobalTitleLock />
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {currentUser.role === 'admin' ? 'Главный склад' : currentUser.branchName}
                </h2>
                <p className="text-sm text-gray-600">
                  {currentUser.role === 'admin' ? 'Администратор' : 'Филиал'}
                </p>
              </div>
            )}
          </div>
        </div>

        <nav className="mt-6">
          {menuItems.map((item) => {
            if ('items' in item) {
              return (
                <div key={`group-${item.label}`} className="mt-4">
                  {sidebarOpen && (
                    <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {item.label}
                    </p>
                  )}
                  <div className="space-y-1">
                    {item.items.map((subItem) => renderLink(subItem, true, item.label))}
                  </div>
                </div>
              );
            }

            return renderLink(item);
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {currentUser.login}
              </div>
              <div className="text-xs text-gray-600">
                {currentUser.role === 'admin' ? 'Администратор' : `Филиал: ${currentUser.branchName}`}
              </div>
            </div>
            {sessionTimeLeft > 0 && (
              <div className="flex items-center bg-blue-50 px-3 py-1 rounded-lg">
                <Clock className="h-4 w-4 mr-2 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  {formatTimeLeft(sessionTimeLeft)}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
