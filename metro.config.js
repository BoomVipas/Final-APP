const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')
const os = require('os')

const config = getDefaultConfig(__dirname)

const { transformer, resolver } = config

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
}
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
}

// Persistent disk cache — dramatically speeds up subsequent cold starts
const { FileStore } = require('metro-cache')
config.cacheStores = [
  new FileStore({ root: path.join(os.tmpdir(), 'pillo-metro-cache') }),
]

module.exports = withNativeWind(config, { input: './global.css' })
