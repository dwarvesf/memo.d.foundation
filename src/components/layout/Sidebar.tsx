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

  // Close sidebar when clicking outside on mobile
  const handleClickOutside = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };
  
  return (
    <>
      {/* Sidebar overlay - only shown on mobile when sidebar is open */}
      {isOpen && (
        <div 
          className="sidebar-overlay fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`sidebar fixed top-0 left-0 z-40 h-full flex flex-col md:translate-x-0 ${
          isOpen ? 'mobile-visible' : ''
        }`}
        onClick={(e) => e.target === e.currentTarget && handleClickOutside(e)}
      >
        {/* Logo and title */}
        <Link href="/" className="sidebar-logo">
          <svg className="no-zoom" width="24" height="24" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.41664 20C1.08113 20 0 18.8812 0 17.4991V2.50091C0 1.11883 1.08113 0 2.41664 0L8.46529 0.00731261C13.8427 0.00731261 18.1954 4.55576 18.1248 10.1353C18.0541 15.6271 13.6307 20 8.32397 20H2.41664Z" fill="var(--primary-color)"/>
            <path d="M3.63209 15.6271H3.32118C3.15159 15.6271 3.01733 15.4881 3.01733 15.3126V12.8044C3.01733 12.6289 3.15159 12.49 3.32118 12.49H5.74488C5.91447 12.49 6.04873 12.6289 6.04873 12.8044V13.1262C6.04873 14.5082 4.9676 15.6271 3.63209 15.6271Z" fill="white"/>
            <path d="M3.32119 8.11701H10.8749C12.2105 8.11701 13.2916 6.99818 13.2916 5.6161V5.31628C13.2916 5.13347 13.1503 4.98721 12.9736 4.98721H5.44105C4.10554 4.98721 3.02441 6.10604 3.02441 7.48813V7.80257C3.02441 7.97807 3.15867 8.11701 3.32119 8.11701Z" fill="white"/>
            <path d="M3.32118 11.8684H7.24998C8.58549 11.8684 9.66661 10.7496 9.66661 9.36747V9.05303C9.66661 8.87753 9.53236 8.73859 9.36277 8.73859H3.32118C3.15159 8.73859 3.01733 8.87753 3.01733 9.05303V11.5539C3.0244 11.7294 3.15866 11.8684 3.32118 11.8684Z" fill="white"/>
          </svg>
          <span>Dwarves<br/>Memo</span>
        </Link>
        
        {/* Navigation items */}
        <nav className="sidebar-nav">
          {navLinks.map((item, index) => (
            <div className="nav-item-container" key={index}>
              <Link 
                href={item.url}
                className={`sidebar-item ${isActiveUrl(item.url) ? 'active' : ''}`}
                id={`sidebar-item-${index}`}
              >
                <div 
                  className="sidebar-item-icon"
                  style={{ 
                    '--src': `url('${item.icon}')` 
                  } as React.CSSProperties}
                ></div>
                <span>{item.title}</span>
              </Link>
            </div>
          ))}
        </nav>

        {/* Footer with social links - similar to Hugo implementation */}
        <footer className="footer">
          <div className="socials">
            <a href="https://github.com/dwarvesf" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 1.5C8.01509 1.5 7.03982 1.69399 6.12987 2.0709C5.21993 2.44781 4.39314 3.00026 3.6967 3.6967C2.29018 5.10322 1.5 7.01088 1.5 9C1.5 12.315 3.6525 15.1275 6.63 16.125C7.005 16.185 7.125 15.9525 7.125 15.75V14.4825C5.0475 14.9325 4.605 13.4775 4.605 13.4775C4.26 12.6075 3.7725 12.375 3.7725 12.375C3.09 11.91 3.825 11.925 3.825 11.925C4.575 11.9775 4.9725 12.6975 4.9725 12.6975C5.625 13.8375 6.7275 13.5 7.155 13.32C7.2225 12.8325 7.4175 12.5025 7.6275 12.315C5.9625 12.1275 4.215 11.4825 4.215 8.625C4.215 7.7925 4.5 7.125 4.9875 6.5925C4.9125 6.405 4.65 5.625 5.0625 4.6125C5.0625 4.6125 5.6925 4.41 7.125 5.3775C7.7175 5.2125 8.3625 5.13 9 5.13C9.6375 5.13 10.2825 5.2125 10.875 5.3775C12.3075 4.41 12.9375 4.6125 12.9375 4.6125C13.35 5.625 13.0875 6.405 13.0125 6.5925C13.5 7.125 13.785 7.7925 13.785 8.625C13.785 11.49 12.03 12.12 10.3575 12.3075C10.6275 12.54 10.875 12.9975 10.875 13.695V15.75C10.875 15.9525 10.995 16.1925 11.3775 16.125C14.355 15.12 16.5 12.315 16.5 9C16.5 8.01509 16.306 7.03982 15.9291 6.12987C15.5522 5.21993 14.9997 4.39314 14.3033 3.6967C13.6069 3.00026 12.7801 2.44781 11.8701 2.0709C10.9602 1.69399 9.98491 1.5 9 1.5Z"
                fill="var(--secondary-foreground)" />
              </svg>
            </a>
            <a href="https://discord.gg/dwarvesv" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.1919 3.95003C13.2419 3.50716 12.2133 3.18572 11.1418 3C11.1324 2.9997 11.1231 3.00146 11.1144 3.00517C11.1058 3.00887 11.0981 3.01442 11.0918 3.02143C10.9632 3.25715 10.8132 3.5643 10.7132 3.80002C9.57677 3.62859 8.42102 3.62859 7.28456 3.80002C7.18456 3.55716 7.03455 3.25715 6.89884 3.02143C6.89169 3.00715 6.87026 3 6.84883 3C5.77738 3.18572 4.75592 3.50716 3.79875 3.95003C3.79161 3.95003 3.78447 3.95717 3.77732 3.96431C1.83441 6.87154 1.29868 9.70019 1.56298 12.5003C1.56298 12.5145 1.57012 12.5288 1.58441 12.536C2.87015 13.4789 4.1059 14.0503 5.32737 14.4289C5.34879 14.436 5.37022 14.4289 5.37737 14.4146C5.66309 14.0217 5.92024 13.6074 6.14167 13.1717C6.15596 13.1431 6.14167 13.1146 6.1131 13.1074C5.70595 12.9503 5.32022 12.7646 4.94164 12.5503C4.91307 12.536 4.91307 12.4931 4.9345 12.4717C5.01307 12.4145 5.09164 12.3503 5.17022 12.2931C5.1845 12.2788 5.20593 12.2788 5.22022 12.286C7.67743 13.4074 10.3275 13.4074 12.7561 12.286C12.7704 12.2788 12.7919 12.2788 12.8061 12.2931C12.8847 12.3574 12.9633 12.4145 13.0419 12.4788C13.0704 12.5003 13.0704 12.5431 13.0347 12.5574C12.6633 12.7788 12.2704 12.9574 11.8633 13.1146C11.8347 13.1217 11.8275 13.1574 11.8347 13.1789C12.0633 13.6146 12.3204 14.0289 12.599 14.4217C12.6204 14.4289 12.6419 14.436 12.6633 14.4289C13.8919 14.0503 15.1276 13.4789 16.4134 12.536C16.4277 12.5288 16.4348 12.5145 16.4348 12.5003C16.7491 9.26446 15.9134 6.45724 14.2205 3.96431C14.2133 3.95717 14.2062 3.95003 14.1919 3.95003Z"
                fill="var(--secondary-foreground)" />
              </svg>
            </a>
            <a href="https://www.facebook.com/dwarvesf" target="_blank" rel="noopener noreferrer">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                <path fill="var(--secondary-foreground)"
                  d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95" />
              </svg>
            </a>
            <a href="https://dwarves.foundation/" target="_blank" rel="noopener noreferrer">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                <path fill="var(--secondary-foreground)"
                  d="M17.9 17.39c-.26-.8-1.01-1.39-1.9-1.39h-1v-3a1 1 0 0 0-1-1H8v-2h2a1 1 0 0 0 1-1V7h2a2 2 0 0 0 2-2v-.41a7.984 7.984 0 0 1 2.9 12.8M11 19.93c-3.95-.49-7-3.85-7-7.93c0-.62.08-1.22.21-1.79L9 15v1a2 2 0 0 0 2 2m1-16A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2" />
              </svg>
            </a>
            <a href="mailto:team@dwarves.foundation" target="_blank" rel="noopener noreferrer">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 36 36">
                <path fill="var(--secondary-foreground)" d="M32.33 6a2 2 0 0 0-.41 0h-28a2 2 0 0 0-.53.08l14.45 14.39Z"
                  className="clr-i-solid clr-i-solid-path-1" />
                <path fill="var(--secondary-foreground)"
                  d="m33.81 7.39l-14.56 14.5a2 2 0 0 1-2.82 0L2 7.5a2 2 0 0 0-.07.5v20a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V8a2 2 0 0 0-.12-.61M5.3 28H3.91v-1.43l7.27-7.21l1.41 1.41Zm26.61 0h-1.4l-7.29-7.23l1.41-1.41l7.27 7.21Z"
                  className="clr-i-solid clr-i-solid-path-2" />
                <path fill="none" d="M0 0h36v36H0z" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
      
      {/* Tooltips container (outside the sidebar to avoid overflow issues) */}
      <div className="tooltips-container">
        {navLinks.map((item, index) => (
          <div key={index} id={`tooltip-${index}`} className="sidebar-tooltip" role="tooltip">
            <span>{item.title}</span>
            <div className="arrow" data-popper-arrow></div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Sidebar;