import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <>
      {/* Inject global CSS for glass effect */}
      <style>{`

        [data-sonner-toaster] {
          top: max(env(safe-area-inset-top), 48px) !important;
          pointer-events: none; /* Let clicks pass through empty space */
        }
        
        [data-sonner-toaster] [data-sonner-toast] {
          pointer-events: auto; /* Re-enable clicks for toast */
          backdrop-filter: blur(40px) saturate(150%) !important;
          -webkit-backdrop-filter: blur(40px) saturate(150%) !important;
          background: rgba(255, 255, 255, 0.65) !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
          border-radius: 20px !important;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(255,255,255,0.6) inset,
            0 4px 12px rgba(255, 255, 255, 0.4) inset !important;
          color: #111118 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif !important;
          padding: 16px 20px !important;
          min-width: 320px !important;
          max-width: 90vw !important;
        }
        [data-sonner-toaster] [data-sonner-toast] [data-title] {
          font-weight: 700 !important;
          font-size: 15px !important;
          letter-spacing: -0.2px !important;
          color: #111118 !important;
          margin-bottom: 4px !important;
        }
        [data-sonner-toaster] [data-sonner-toast] [data-description] {
          font-size: 13.5px !important;
          color: #4A4A5C !important;
          line-height: 1.4 !important;
        }
        [data-sonner-toaster] [data-sonner-toast] [data-icon] {
          margin-right: 14px !important;
          background: rgba(255, 255, 255, 0.5) !important;
          padding: 8px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.6) !important;
        }
      `}</style>
      <Sonner
        theme="light"
        position="top-center"
        className="toaster group font-sans"
        offset={16}
        gap={8}
        icons={{
          success: <CircleCheck className="h-5 w-5 text-[#FF7B1C]" />,
          info: <Info className="h-5 w-5 text-blue-500" />,
          warning: <TriangleAlert className="h-5 w-5 text-amber-500" />,
          error: <OctagonX className="h-5 w-5 text-red-500" />,
          loading: <LoaderCircle className="h-5 w-5 animate-spin text-[#FF7B1C]" />,
        }}
        toastOptions={{
          duration: 4000,
          classNames: {
            toast: "group toast",
            title: "font-semibold",
            description: "text-[#62627A]",
            icon: "mr-2",
          },
        }}
        {...props}
      />
    </>
  );
};

export { Toaster };

