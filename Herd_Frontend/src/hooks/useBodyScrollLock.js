import { useEffect } from 'react';

export default function useBodyScrollLock(isLocked) {
  useEffect(() => {
    const mainContainer = document.getElementById('main-scroll-container');
    
    if (isLocked) {
      document.body.style.overflow = 'hidden';
      if (mainContainer) mainContainer.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      if (mainContainer) mainContainer.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
      if (mainContainer) mainContainer.style.overflow = 'auto';
    };
  }, [isLocked]);
}
