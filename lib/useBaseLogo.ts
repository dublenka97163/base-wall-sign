import { useEffect, useState } from "react";
import { BASE_LOGO_ASSET_PATH } from "./contract";

export const useBaseLogo = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = BASE_LOGO_ASSET_PATH;
    img.onload = () => setImage(img);
  }, []);

  return image;
};
