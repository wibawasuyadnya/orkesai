/** @type {import('next').NextConfig} */
const isElectron = process.env.BUILD_TARGET === "electron";

const nextConfig = {
  reactStrictMode: true,
  // Electron .dmg/.exe: static export (out/) served by the app itself.
  // Docker image (deploy/): self-contained server bundle.
  output: isElectron ? "export" : "standalone",
};

export default nextConfig;
