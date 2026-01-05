const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://base-wall-sign.vercel.app";

export const miniAppConfig = {
  name: "Base Wall Sign",
  description: "Sign the Base wall onchain with the official Farcaster mini app.",
  iconUrl: `${appUrl}/assets/base-logo.svg`,
  splashImageUrl: `${appUrl}/assets/base-logo.svg`,
  splashBackgroundColor: "#ffffff",
  homeUrl: appUrl,
  startUrl: `${appUrl}/`,
};

export default miniAppConfig;
