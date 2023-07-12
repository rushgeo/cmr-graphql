module.exports = {
  presets: [
    [
      '@babel/preset-env', {
        targets: {
          node: '18',
          esmodules: true
        }
      }
    ]
  ],
  sourceType: 'unambiguous'
}
