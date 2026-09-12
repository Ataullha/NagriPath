/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // fully static: drop the folder on Netlify, no server needed
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
