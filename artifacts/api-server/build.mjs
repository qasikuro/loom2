import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const mediaToolPaths = {};
  for (const tool of ["ffmpeg", "ffprobe"]) {
    const lookup = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
    if (lookup.status !== 0 || !lookup.stdout.trim()) {
      throw new Error(`Cannot build API: ${tool} is missing. Install the ffmpeg system package before publishing.`);
    }
    const executable = realpathSync(lookup.stdout.trim());
    const check = spawnSync(executable, ["-version"], { encoding: "utf8", timeout: 15_000 });
    if (check.error || check.status !== 0) {
      throw new Error(`Cannot build API: ${tool} could not execute.`);
    }
    mediaToolPaths[tool] = executable;
    console.log(`[media-tools] ${check.stdout.split("\n")[0]}`);
  }
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    define: {
      __MEDIA_FFMPEG_PATH__: JSON.stringify(mediaToolPaths.ffmpeg),
      __MEDIA_FFPROBE_PATH__: JSON.stringify(mediaToolPaths.ffprobe),
    },
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  const landingBuildDir = await mkdtemp(
    path.join(tmpdir(), "storigam-root-index-"),
  );
  try {
    const landingBuild = spawnSync(
      "pnpm",
      [
        "--filter",
        "@workspace/storigam-landing",
        "exec",
        "vite",
        "build",
        "--config",
        "vite.config.ts",
        "--outDir",
        landingBuildDir,
      ],
      {
        cwd: path.resolve(artifactDir, "../.."),
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: "24248",
          BASE_PATH: "/storigam/",
        },
        stdio: "inherit",
      },
    );
    if (landingBuild.error) throw landingBuild.error;
    if (landingBuild.status !== 0) {
      throw new Error("Failed to build the Storigam root landing page.");
    }
    await copyFile(
      path.join(landingBuildDir, "index.html"),
      path.join(distDir, "storigam-landing-index.html"),
    );
  } finally {
    await rm(landingBuildDir, { recursive: true, force: true });
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
