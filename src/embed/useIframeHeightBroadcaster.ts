import { useEffect, useRef } from 'react';

/**
 * A custom hook that monitors the document height and broadcasts it to the parent window
 * via postMessage. This allows the parent iframe to dynamically resize itself to fit
 * the dashboard's contents without scrollbars or cutoff.
 */
export function useIframeHeightBroadcaster() {
  const lastBroadcastHeight = useRef<number>(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Function to calculate and send the height
    const sendHeight = () => {
      // Cancel any pending animation frame to prevent loop limit errors
      // and coalesce rapid successive layout changes
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;

        // documentElement.scrollHeight is the most reliable cross-browser
        // measurement for total content height (handles grid/flex better than body.scrollHeight)
        const currentHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );

        // Deduplicate messages: only send if the height actually changed
        if (currentHeight === lastBroadcastHeight.current) {
          return;
        }

        lastBroadcastHeight.current = currentHeight;

        // Broadcast to parent app
        window.parent.postMessage(
          { 
            type: 'embed_ready', 
            height: currentHeight 
          }, 
          '*' // In production, replace '*' with the specific parent origin if known
        );
      });
    };

    // 1. Initial broadcast
    sendHeight();

    // 2. Monitor for layout changes using ResizeObserver on the body
    // This catches window resizes, content reflows, and many DOM mutations
    const resizeObserver = new ResizeObserver(() => {
      sendHeight();
    });
    
    if (document.body) resizeObserver.observe(document.body);
    if (document.documentElement) resizeObserver.observe(document.documentElement);

    // 3. Monitor for specific DOM insertions (e.g., new charts added)
    // Sometimes ResizeObserver misses children added to a grid if it doesn't change the body's immediate size.
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

    // Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);
}
