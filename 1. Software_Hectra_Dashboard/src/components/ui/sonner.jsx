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
        [data-sonner-toaster] [data-sonner-toast] {
          backdrop-filter: blur(20px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
          background: rgba(240, 240, 245, 0.72) !important;
          border: 1px solid rgba(255, 255, 255, 0.55) !important;
          border-radius: 20px !important;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.10),
            0 1px 0 rgba(255,255,255,0.6) inset !important;
          color: #111118 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif !important;
          font-size: 14px !important;
          padding: 14px 18px !important;
          min-width: 280px !important;
          max-width: 360px !important;
        }
        [data-sonner-toaster] [data-sonner-toast] [data-title] {
          font-weight: 600 !important;
          font-size: 14px !important;
          letter-spacing: -0.1px !important;
          color: #111118 !important;
        }
        [data-sonner-toaster] [data-sonner-toast] [data-description] {
          font-size: 12.5px !important;
          color: #62627A !important;
          margin-top: 2px !important;
        }
        [data-sonner-toaster] [data-sonner-toast] [data-icon] {
          margin-right: 10px !important;
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

