import html2canvas from 'html2canvas';

/**
 * Clean up CSS that uses unsupported color functions in the cloned document
 * This converts oklab/oklch colors to RGB equivalents
 */
function cleanUnsupportedColors(clonedDoc: Document, clonedElement: HTMLElement) {
  try {
    // Get all style elements and remove/modify ones with oklab/oklch
    const styleSheets = Array.from(clonedDoc.styleSheets);
    styleSheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach((rule) => {
          if (rule instanceof CSSStyleRule) {
            const style = rule.style;
            // Check and replace background-color, color, border-color
            ['backgroundColor', 'color', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'].forEach((prop) => {
              const value = style.getPropertyValue(prop);
              if (value && (value.includes('oklab') || value.includes('oklch'))) {
                // Remove the problematic property
                style.removeProperty(prop);
              }
            });
          }
        });
      } catch (e) {
        // Cross-origin stylesheets might throw errors, ignore them
      }
    });

    // Also walk through all elements and fix inline styles
    const allElements = clonedElement.querySelectorAll('*');
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const inlineStyle = htmlEl.getAttribute('style');
      if (inlineStyle && (inlineStyle.includes('oklab') || inlineStyle.includes('oklch'))) {
        // Remove problematic inline styles
        const cleanStyle = inlineStyle
          .split(';')
          .filter((decl) => !decl.includes('oklab') && !decl.includes('oklch'))
          .join(';');
        htmlEl.setAttribute('style', cleanStyle || '');
      }
    });
  } catch (error) {
    console.warn('Error cleaning unsupported colors:', error);
  }
}

/**
 * Convert SVG to canvas (alternative method for charts)
 */
function svgToCanvas(svg: SVGElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG'));
    };

    img.src = url;
  });
}

export async function exportChartAsImage(
  element: HTMLElement,
  chartName: string,
  options?: {
    backgroundColor?: string;
    scale?: number;
    quality?: number;
  }
): Promise<void> {
  try {
    // Default options
    const config = {
      backgroundColor: '#ffffff',
      scale: 2, // Higher scale for better quality
      quality: 1,
      ...options,
    };

    // ECharts (SVG renderer) and legacy charts: prefer the main plot `<svg>` inside the container.
    const svgElement =
      (element.querySelector('.echarts-for-react svg') as SVGElement | null) ??
      (element.querySelector('[data-zr-dom-id] svg') as SVGElement | null) ??
      (element.querySelector('svg') as SVGElement | null);
    
    if (svgElement) {
      // Use SVG export method for Recharts charts
      try {
        const svgRect = svgElement.getBoundingClientRect();
        const width = svgRect.width || element.offsetWidth;
        const height = svgRect.height || element.offsetHeight;
        
        const canvas = await svgToCanvas(svgElement, width * config.scale, height * config.scale);
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              throw new Error('Failed to create image blob');
            }

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Sanitize filename
            const sanitizedName = chartName
              .replace(/[^a-z0-9]/gi, '_')
              .toLowerCase()
              .substring(0, 50);
            link.download = `${sanitizedName}_chart.png`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 100);
          },
          'image/png',
          config.quality
        );
        
        return; // Success, exit early
      } catch (svgError) {
        console.warn('SVG export failed, falling back to html2canvas:', svgError);
        // Fall through to html2canvas method
      }
    }

    // Fallback to html2canvas method
    // Use html2canvas to capture the element
    // Use onclone to clean up unsupported CSS before capture
    const canvas = await html2canvas(element, {
      backgroundColor: config.backgroundColor,
      scale: config.scale,
      useCORS: true,
      logging: false,
      allowTaint: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      foreignObjectRendering: false, // Disable foreign object rendering which can cause issues
      onclone: (clonedDoc, clonedEl) => {
        // Clean up unsupported color functions in the cloned document
        cleanUnsupportedColors(clonedDoc, clonedEl as HTMLElement);
      },
    });

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          throw new Error('Failed to create image blob');
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Sanitize filename
        const sanitizedName = chartName
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()
          .substring(0, 50);
        link.download = `${sanitizedName}_chart.png`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
      },
      'image/png',
      config.quality
    );
  } catch (error: any) {
    console.error('Error exporting chart:', error);
    
    // Provide a more user-friendly error message
    if (error?.message?.includes('oklab') || error?.message?.includes('oklch')) {
      throw new Error('Chart export failed due to unsupported color format. Please try again or contact support.');
    }
    
    throw error;
  }
}

/**
 * Export chart from a React ref
 * @param ref - React ref to the chart container element
 * @param chartName - Name of the chart
 * @param options - Optional configuration
 */
export async function exportChartFromRef(
  ref: { current: HTMLElement | null },
  chartName: string,
  options?: {
    backgroundColor?: string;
    scale?: number;
    quality?: number;
  }
): Promise<void> {
  if (!ref.current) {
    throw new Error('Chart element not found');
  }
  return exportChartAsImage(ref.current, chartName, options);
}

/** Same behavior as `exportChartFromRef` (container ref + base filename for the PNG). */
export const exportChartToPng = exportChartFromRef;

