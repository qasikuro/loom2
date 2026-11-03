const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.resolver.assetExts.push("riv");

// Keep native workspace-linked packages on the app's single React instance.
// The shared API client is also consumed by web apps, so leave web/SSR React
// resolution alone and preserve React DOM's matching peer context there.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== "web" && (moduleName === "react" || moduleName.startsWith("react/"))) {
    const appReactModule = path.join(
      projectRoot,
      "node_modules",
      ...moduleName.split("/")
    );
    return context.resolveRequest(context, appReactModule, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Watch the monorepo so Metro sees packages in the pnpm store
config.watchFolders = [workspaceRoot];

// Allow resolution from both the app's and the workspace's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Block volatile agent/skills temp directories — Metro crashes when they
// disappear while being watched (ENOENT on deleted .tmp-* dirs).
// Also block test files and vitest config: they import vitest/vite which
// Metro/Hermes cannot transform (dynamic import() call in vite's module-runner).
// Also block expo-video-thumbnails_tmp_* directories created and deleted by
// that package's postinstall script — Metro watches them, they vanish, ENOENT.
const escRe = (p) => p.replace(/[/\\]/g, "[\\\\/\\\\\\\\]").replace(/\./g, "\\.");
config.resolver.blockList = new RegExp(
  [
    escRe(path.resolve(workspaceRoot, ".local")) + "[\\/\\\\].*",
    // Package runners create/remove temporary modules here during codegen.
    // They are not app dependencies and must not be watched by Metro.
    escRe(path.resolve(workspaceRoot, ".cache")) + "[\\/\\\\].*",
    escRe(path.resolve(projectRoot))             + "[\\/\\\\].*__tests__[\\/\\\\].*",
    escRe(path.resolve(projectRoot))             + "[\\/\\\\].*\\.test\\.[jt]sx?$",
    escRe(path.resolve(projectRoot))             + "[\\/\\\\].*\\.spec\\.[jt]sx?$",
    escRe(path.resolve(projectRoot, "vitest.config.ts")),
    escRe(path.resolve(projectRoot, "vitest.config.js")),
    // expo-video-thumbnails postinstall creates then deletes _tmp_NNNN dirs
    ".*expo-video-thumbnails_tmp_[0-9]+[\\/\\\\].*",
  ].map((r) => `(${r})`).join("|")
);

module.exports = config;
