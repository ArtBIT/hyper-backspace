# hyper-backspace

[![npm version][npm-src]][npm-href]
[![Install size][packagephobia-src]][packagephobia-href]
[![License][license-src]][license-href]

Extension for [Hyper.is](https://hyper.is) that physically drops deleted characters in your terminal.

![hyper-backspace](https://user-images.githubusercontent.com/184220/55085247-a5ebd480-50a6-11e9-8590-5064eb58debf.gif)

## Installation

To install, execute:
```
hyper i hyper-pane
```

Or edit `~/.hyper.js` and add `hyper-backspace` to the list of plugins:
```
plugins: [
  "hyper-backspace",
],
```

## Configuration

Default configuration:
```
module.exports = {
  config: {
    // other configs...
    hyperBackspace: {
      debug: false,
      gravity: 0.01,
      horizontalMaxVelocity: 0.3,
      verticalMaxVelocity: 0.2,
      angularMaxVelocity: 0.02,
      particleTimeToLive: 1000,
      verticalDragCoefficient: 0.2,
      horizontalDragCoefficient: 0.8,
      bounceDragCoefficient: 0.6,
    }
  }
  //...
};
```

## Credits

Inspired by [hyper-letters](https://github.com/KeeTraxx/hyper-letters)

## License

MIT

[npm-src]: https://badgen.net/npm/v/hyper-backspace
[npm-href]: https://www.npmjs.com/package/hyper-backspace
[packagephobia-src]: https://badgen.net/packagephobia/install/hyper-backspace
[packagephobia-href]: https://packagephobia.now.sh/result?p=hyper-backspace
[license-src]: https://badgen.net/github/license/artbit/hyper-backspace
[license-href]: LICENSE.md
