const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so Metro sees packages in the pnpm store
config.watchFolders = [workspaceRoot];

// Allow resolution from both the app's and the workspace's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Follow pnpm symlinks so assets inside linked packages are reachable
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
