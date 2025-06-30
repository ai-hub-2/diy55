import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs'; // Added existsSync
import { join, resolve as pathResolve } from 'path'; // Added resolve and named it pathResolve to avoid conflict
import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';


dotenv.config();

// Get detailed git info with fallbacks
const getGitInfo = () => {
  try {
    return {
      commitHash: execSync('git rev-parse --short HEAD').toString().trim(),
      branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
      commitTime: execSync('git log -1 --format=%cd').toString().trim(),
      author: execSync('git log -1 --format=%an').toString().trim(),
      email: execSync('git log -1 --format=%ae').toString().trim(),
      remoteUrl: execSync('git config --get remote.origin.url').toString().trim(),
      repoName: execSync('git config --get remote.origin.url')
        .toString()
        .trim()
        .replace(/^.*github.com[:/]/, '')
        .replace(/\.git$/, ''),
    };
  } catch {
    return {
      commitHash: 'no-git-info',
      branch: 'unknown',
      commitTime: 'unknown',
      author: 'unknown',
      email: 'unknown',
      remoteUrl: 'unknown',
      repoName: 'unknown',
    };
  }
};

// Read package.json with detailed dependency info
const getPackageJson = () => {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    return {
      name: pkg.name,
      description: pkg.description,
      license: pkg.license,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      optionalDependencies: pkg.optionalDependencies || {},
    };
  } catch {
    return {
      name: 'bolt.diy',
      description: 'A DIY LLM interface',
      license: 'MIT',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    };
  }
};

const pkg = getPackageJson();
const gitInfo = getGitInfo();

export default defineConfig((config) => {
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH: JSON.stringify(gitInfo.branch),
      __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
      __GIT_AUTHOR: JSON.stringify(gitInfo.author),
      __GIT_EMAIL: JSON.stringify(gitInfo.email),
      __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
      __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      __PKG_NAME: JSON.stringify(pkg.name),
      __PKG_DESCRIPTION: JSON.stringify(pkg.description),
      __PKG_LICENSE: JSON.stringify(pkg.license),
      __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies),
      __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies),
      __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies),
      __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs', 'path'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }

          return null;
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      monacoEditorPlugin(), // Add MonacoWebpackPlugin here
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}

// Helper function to correctly configure Monaco Editor Webpack Plugin for Vite
function monacoEditorPlugin() {
  return {
    name: 'monaco-editor-vite-bridge',
    config(config: any, { command }: any) {
      if (command === 'build' || command === 'serve') {
        if (!config.plugins) config.plugins = [];
        // Check if the plugin is already added to prevent duplicates if this config hook runs multiple times
        if (!config.plugins.some((p: any) => p && p.constructor && p.constructor.name === 'MonacoEditorWebpackPlugin')) {
          config.plugins.push(
            new MonacoEditorWebpackPlugin({
              languages: ['typescript', 'javascript', 'css', 'html', 'json', 'python', 'markdown'],
              // Consider adding features like 'bracketMatching', 'wordHighlighter' if needed
              features: ['!gotoSymbol'], // Example: disable a feature if not needed
            })
          );
        }

        if (!config.build) config.build = {};
        if (!config.build.rollupOptions) config.build.rollupOptions = {};
        if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {};

        const ensureOutputOptions = (outputOptions: any) => {
          if (!outputOptions.entryFileNames) outputOptions.entryFileNames = 'assets/[name]-[hash].js';
          if (!outputOptions.chunkFileNames) outputOptions.chunkFileNames = 'assets/[name]-[hash].js';
          if (!outputOptions.assetFileNames) outputOptions.assetFileNames = 'assets/[name]-[hash].[ext]';
        };

        if (Array.isArray(config.build.rollupOptions.output)) {
          config.build.rollupOptions.output.forEach(ensureOutputOptions);
        } else {
          ensureOutputOptions(config.build.rollupOptions.output);
        }

        // Manual chunks for Monaco (optional, but can help with bundle splitting)
        const existingManualChunks = config.build.rollupOptions.output.manualChunks;
        config.build.rollupOptions.output.manualChunks = (id: string, { getModuleInfo }: any) => {
          if (typeof existingManualChunks === 'function') {
            const existingResult = existingManualChunks(id, { getModuleInfo });
            if (existingResult) return existingResult;
          } else if (typeof existingManualChunks === 'object' && existingManualChunks !== null) {
             for (const chunkName in existingManualChunks) {
                 if (existingManualChunks[chunkName].includes(id)) return chunkName;
             }
          }

          if (id.includes('node_modules/monaco-editor')) {
            return 'monaco-editor';
          }
          // You might want to add more specific chunking for monaco workers if needed
          // e.g., if (id.includes('monaco-editor') && id.includes('worker')) return 'monaco-worker';
        };


        if (command === 'serve') {
          if (!config.server) config.server = {};
          if (!config.server.fs) config.server.fs = {};
          if (!config.server.fs.allow) config.server.fs.allow = [];

          // Allow serving from monaco-editor's distribution folders
          const monacoPath = pathResolve(__dirname, 'node_modules/monaco-editor');
          if (existsSync(monacoPath)) {
            config.server.fs.allow.push(monacoPath);
            // Specifically allow worker paths if they are in a subdirectory like 'esm/vs/editor/editor.worker'
            const workerBasePath = pathResolve(monacoPath, 'esm/vs/editor');
             if (existsSync(workerBasePath)) {
                config.server.fs.allow.push(workerBasePath);
            }
          }
        }
         // OptimizeDeps for Monaco Editor (important for dev server startup speed)
        if (!config.optimizeDeps) config.optimizeDeps = {};
        if (!config.optimizeDeps.include) config.optimizeDeps.include = [];
        // Add Monaco Editor specific paths that Vite should pre-bundle
        // This list might need adjustment based on the features and languages you use
        const monacoDeps = [
          'monaco-editor/esm/vs/editor/editor.api',
          'monaco-editor/esm/vs/editor/editor.all',
          'monaco-editor/esm/vs/language/typescript/ts.worker',
          'monaco-editor/esm/vs/language/json/json.worker',
          'monaco-editor/esm/vs/language/css/css.worker',
          'monaco-editor/esm/vs/language/html/html.worker',
          'monaco-editor/esm/vs/basic-languages/python/python',
          'monaco-editor/esm/vs/basic-languages/markdown/markdown',
          // Add other languages or specific editor parts if needed
        ];
        for (const dep of monacoDeps) {
            if (!config.optimizeDeps.include.includes(dep)) {
                config.optimizeDeps.include.push(dep);
            }
        }
      }
      return config;
    },
  };
}