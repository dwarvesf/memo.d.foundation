import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';

// Define navigation links
const navLinks = [
  { title: 'Home', url: '/', icon: '/img/home.svg' },
  { title: 'Consulting', url: '/consulting', icon: '/img/consulting.svg' },
  { title: 'Earn', url: '/earn', icon: '/img/earn.svg' },
  { title: 'Hiring', url: '/careers/hiring', icon: '/img/hiring.svg' },
  { title: 'Digest', url: '/updates/digest', icon: '/img/digest.svg' },
  { title: 'OGIFs', url: '/updates/ogif', icon: '/img/ogifs.svg' },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const router = useRouter();
  
  // Close sidebar when changing routes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpen(false);
    };
    
    router.events.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router, setIsOpen]);
  
  // Check if current path matches link
  const isActiveUrl = (url: string) => {
    const linkUrlRoot = url.split('/')[1];
    const currentUrlRoot = router.asPath.split('/')[1];
    return linkUrlRoot === currentUrlRoot;
  };
  
  return (
    <>
      {/* Sidebar overlay - only shown on mobile when sidebar is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`fixed md:sticky top-0 left-0 z-30 h-screen w-64 border-r transition-transform duration-300 bg-card text-card-foreground md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo and title */}
        <Link href="/" className="flex items-center py-6 px-4 border-b">
          <svg className="w-6 h-6 mr-2 text-primary" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.41664 20C1.08113 20 0 18.8812 0 17.4991V2.50091C0 1.11883 1.08113 0 2.41664 0L8.46529 0.00731261C13.8427 0.00731261 18.1954 4.55576 18.1248 10.1353C18.0541 15.6271 13.6307 20 8.32397 20H2.41664Z" fill="currentColor"/>
            <path d="M3.63209 15.6271H3.32118C3.15159 15.6271 3.01733 15.4881 3.01733 15.3126V12.8044C3.01733 12.6289 3.15159 12.49 3.32118 12.49H5.74488C5.91447 12.49 6.04873 12.6289 6.04873 12.8044V13.1262C6.04873 14.5082 4.9676 15.6271 3.63209 15.6271Z" fill="white"/>
            <path d="M3.32119 8.11701H10.8749C12.2105 8.11701 13.2916 6.99818 13.2916 5.6161V5.31628C13.2916 5.13347 13.1503 4.98721 12.9736 4.98721H5.44105C4.10554 4.98721 3.02441 6.10604 3.02441 7.48813V7.80257C3.02441 7.97807 3.15867 8.11701 3.32119 8.11701Z" fill="white"/>
            <path d="M3.32118 11.8684H7.24998C8.58549 11.8684 9.66661 10.7496 9.66661 9.36747V9.05303C9.66661 8.87753 9.53236 8.73859 9.36277 8.73859H3.32118C3.15159 8.73859 3.01733 8.87753 3.01733 9.05303V11.5539C3.0244 11.7294 3.15866 11.8684 3.32118 11.8684Z" fill="white"/>
          </svg>
          <span className="font-medium">Dwarves Memo</span>
        </Link>
        
        {/* Navigation items */}
        <nav className="py-4">
          {navLinks.map((item, index) => (
            <Link 
              key={index}
              href={item.url}
              className={`flex items-center py-3 px-4 text-sm transition-colors ${
                isActiveUrl(item.url) ? 'text-primary font-medium' : ''
              }`}
              style={{ color: isActiveUrl(item.url) ? '' : 'var(--foreground)' }}
            >
              <div className="flex items-center justify-center w-6 h-6 mr-3">
                <Image 
                  src={item.icon} 
                  alt="" 
                  width={24} 
                  height={24}
                  className="w-5 h-5" 
                />
              </div>
              <span>{item.title}</span>
            </Link>
          ))}
        </nav>
      </aside>
      
      {/* Mobile toggle button - rendered in parent component */}
    </>
  );
};

export default Sidebar;