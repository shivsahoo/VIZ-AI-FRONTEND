import { useEffect, useRef } from 'react';


export function useIframeHeightBroadcaster() {
  const lastBroadcastHeight = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const sendHeight = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const currentHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );


        if (currentHeight === lastBroadcastHeight.current) {
          return;
        }

        lastBroadcastHeight.current = currentHeight;

    
        window.parent.postMessage(
          { 
            type: 'embed_ready', 
            height: currentHeight 
          }, 
          '*' //  replace '*' with the specific parent origin if known
        );
      });
    };

    sendHeight();
    const resizeObserver = new ResizeObserver(() => {
      sendHeight();
    });
    
    if (document.body) resizeObserver.observe(document.body);
    if (document.documentElement) resizeObserver.observe(document.documentElement);
    const mutationObserver = new MutationObserver(() => {
      sendHeight();
    });
    
    const chartsGrid = document.getElementById('charts-grid');
    if (chartsGrid) {
      mutationObserver.observe(chartsGrid, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);
}
