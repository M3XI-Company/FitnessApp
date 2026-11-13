// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// three >= 0.18x ships a deprecated CommonJS entry (build/three.cjs) that calls
// Node's process.emitWarning(), which does not exist in React Native. Libraries
// that require('three') (e.g. @react-three/fiber/native) resolve to that file and
// crash. Point every bare `three` import at the ES module build instead — it is
// the same code the CJS entry re-exports, minus the Node-only warning.
const threeModule = path.resolve(__dirname, 'node_modules/three/build/three.module.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: threeModule };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
