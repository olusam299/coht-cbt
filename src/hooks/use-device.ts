import { useEffect, useState } from "react";

export type DeviceClass = "phone" | "tablet" | "desktop";
export type Orientation = "portrait" | "landscape";

export interface DeviceInfo {
  device: DeviceClass;
  orientation: Orientation;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  hydrated: boolean;
}

const DEFAULT: DeviceInfo = {
  device: "desktop",
  orientation: "landscape",
  isPhone: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  hydrated: false,
};

function read(): DeviceInfo {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const device: DeviceClass = w < 768 ? "phone" : w < 1280 ? "tablet" : "desktop";
  return {
    device,
    orientation: h >= w ? "portrait" : "landscape",
    isPhone: device === "phone",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    isTouch: window.matchMedia("(pointer: coarse)").matches,
    hydrated: true,
  };
}

/** Device class + orientation, read after hydration to avoid SSR mismatches. */
export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(DEFAULT);

  useEffect(() => {
    const update = () => setInfo(read());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return info;
}