import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const isDev = process.env.NODE_ENV === "development";
const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  // Use the spread operator to conditionally add the server config
  ...(isDev && {
    server: {
      https: {
        key: fs.readFileSync(
          path.join(__dirname, "..", "shared_keys", "localhost+2-key.pem"),
        ),
        cert: fs.readFileSync(
          path.join(__dirname, "..", "shared_keys", "localhost+2.pem"),
        ),
      },
    },
  }),
};

export default nextConfig;
