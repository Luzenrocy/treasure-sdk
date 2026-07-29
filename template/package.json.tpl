{
  "name": "{{PLUGIN_NAME}}",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "{{PLUGIN_DESCRIPTION}}",
  "author": "{{PLUGIN_AUTHOR}}",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:plugin": "node scripts/clean-build-output.mjs && npm run build && node scripts/build-plugin.mjs",
    "build:plugin:zip": "node scripts/clean-build-output.mjs && npm run build && node scripts/build-plugin.mjs --zip"
  },
  "dependencies": {
    "@treasure/sdk": "^1.0.0",
    "vue": "^3.5.13",
    "element-plus": "^2.11.9"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "~5.6.2",
    "vite": "^6.0.3"
  }
}
