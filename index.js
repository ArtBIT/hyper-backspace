const merge = require("lodash.merge");
const createDebug = require("debug");
const debugNamespace = "hyper-backspace";
const debug = createDebug(debugNamespace);
const isPrintable = char =>
  String(char).match(/^[\u0020-\u007e\u00a0-\u00ff]$/);

const defaultConfig = {
  debug: false,
  gravity: 0.01,
  horizontalMaxVelocity: 0.3,
  verticalMaxVelocity: 0.2,
  angularMaxVelocity: 0.02,
  particleTimeToLive: 1000,
  verticalDragCoefficient: 0.2,
  horizontalDragCoefficient: 0.8,
  bounceDragCoefficient: 0.6,
};

let config = defaultConfig;

exports.decorateConfig = mainConfig => {
  if (mainConfig && mainConfig.hyperBackspace) {
    config = merge(
      JSON.parse(JSON.stringify(defaultConfig)),
      mainConfig.hyperBackspace
    );
  }
  createDebug[config.debug ? 'enable' : 'disable'](debugNamespace);
  return mainConfig;
};

exports.decorateTerm = (Term, { React, notify }) => {
  return class extends React.Component {
    constructor(props, context) {
      super(props, context);

      // Set canvas size for bounces
      this._resizeCanvas = this._resizeCanvas.bind(this);

      // Set this._div and this._canvas
      this._onDecorated = this._onDecorated.bind(this);

      // Spawn letter when cursor moves
      this._onCursorMove = this._onCursorMove.bind(this);

      // Spy onData
      this._onData = this._onData.bind(this);

      // Set letter spawn location
      this._spawnLetter = this._spawnLetter.bind(this);
      this._renderLetter = this._renderLetter.bind(this);
      this._updateLetter = this._updateLetter.bind(this);
      this._isLetterAlive = this._isLetterAlive.bind(this);
      // Draw a frame, this is where physiscs is handled
      this._drawFrame = this._drawFrame.bind(this);

      this._div = null;
      this._canvas = null;
      this._line = "";
      this._cursor = {
        x: 0,
        y: 0,
        col: 0,
        row: 0
      };
      this._prevCursor = {
        row: this._cursor.row,
        col: this._cursor.col
      };

      // Hold array of letters to handle in _drawFrame
      this._letters = [];
      this._active = false;
    }

    _spawnLetter(letter, x, y, options) {
      if (!isPrintable(letter)) {
        return;
      }
      options = options || {};
      const option = (name, defaultValue) =>
        options.hasOwnProperty(name) ? options[name] : defaultValue;
      let origin = this._div.getBoundingClientRect();
      x = x + origin.left;
      y = y + origin.top;
      const length = this._letters.length;
      const ctx = this._canvasContext;
      const width = ctx.measureText(letter).width;
      const height = parseInt(ctx.font.match(/\d+/), 10);
      const {
        horizontalMaxVelocity,
        verticalMaxVelocity,
        angularMaxVelocity,
        particleTimeToLive
      } = config;

      // Initial values
      const letterObject = {
        // Character in question
        letter,
        // position
        x,
        y,
        width,
        height,
        anchorX: 0.5,
        anchorY: 0.5,
        // rotation
        rot: 0,
        // velocity
        vx: option("vx", Math.random() * -horizontalMaxVelocity),
        vy: option("vy", (Math.random() * 0.5 + 0.5) * -verticalMaxVelocity),
        // radial velocity
        vr: option("vr", Math.random() * -angularMaxVelocity),
        // time to live
        ttl: particleTimeToLive,
        bounces: 0,
        framesSinceTheLastBounce: 0
      };
      debug("Spawning letter", letterObject);
      this._letters.push(letterObject);

      if (!this._active) {
        this._start();
      }
    }

    _onDecorated(term) {
      if (this.props.onDecorated) this.props.onDecorated(term);
      if (term) {
        this._term = term.term;
        this._cellWidth = this._term._core.renderer.dimensions.actualCellWidth;
        this._cellHeight = this._term._core.renderer.dimensions.actualCellHeight;
        this._div = term.termRef;
        this._initCanvas();
      }
    }

    _initCanvas() {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.pointerEvents = "none";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      ctx.font = `${this.props.fontSize}pt ${this.props.fontFamily}`;
      ctx.textBaseline = "top";
      ctx.fillStyle = this.props.foregroundColor;

      this._canvas = canvas;
      this._canvasContext = ctx;

      window.addEventListener("resize", this._resizeCanvas);
    }

    _start() {
      debug("activating...");
      window.requestAnimationFrame(this._drawFrame);
      this._active = true;
    }

    _stop() {
      this._active = false;
      this._lastRender = false;
    }

    _drawFrame(time) {
      if (!this._lastRender) {
        this._lastRender = time;
        window.requestAnimationFrame(this._drawFrame);
        return;
      }
      this._dt = time - this._lastRender;
      this._lastRender = time;

      const ctx = this._canvasContext;
      ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      ctx.save();

      // handle each letter
      this._letters = this._letters
        .map(this._updateLetter)
        .filter(this._isLetterAlive)
        .map(this._renderLetter);

      ctx.restore();

      // request a new animation frame when there are still letters left
      if (this._letters.length > 0) {
        window.requestAnimationFrame(this._drawFrame);
      } else {
        debug("deactivating...");
        this._stop();
      }
    }

    _updateLetter(l) {
      // floor bounce
      if (l.framesSinceTheLastBounce > 10 && l.y > this._canvas.height) {
        l.y = this._canvas.height;

        // vertical speed
        l.vy *= -(Math.random() * config.bounceDragCoefficient);

        // horizontal speed
        l.vx *= config.horizontalDragCoefficient;

        // random rotation
        l.vr = (Math.random() - 0.5) * config.angularMaxVelocity;

        // bounces
        if (l.bounces++ > 10) {
          l.ttl = 0;
        }

        // reset frame counter
        l.framesSinceTheLastBounce = 0;
      }

      l.framesSinceTheLastBounce++;

      // vertical wall bounce
      if (l.x <= 0 || l.x > this._canvas.width) {
        l.vx = -l.vx;
      }

      // gravity
      l.vy += config.gravity;

      // position
      l.x += l.vx * this._dt;
      l.y += l.vy * this._dt;

      // rotation
      l.rot += l.vr * this._dt;
      l.ttl--;

      return l;
    }

    _renderLetter(l) {
      const ctx = this._canvasContext;
      ctx.save();

      // rotate around a point
      const xo = l.anchorX * l.width;
      const yo = l.anchorY * l.height;
      ctx.translate(l.x + xo, l.y + yo);
      ctx.rotate(l.rot);
      ctx.translate(-xo, -yo);

      // fill text
      ctx.fillText(l.letter, 0, 0);

      /*
      if (debug.enabled) {
        ctx.save();
        ctx.strokeStyle = "red";
        ctx.strokeRect(0, 0, l.width, l.height);
        ctx.restore();
      }
      */

      ctx.restore();
      return l;
    }

    _isLetterAlive(l) {
      return l.ttl > 0;
    }

    _resizeCanvas() {
      this._canvas.width = window.innerWidth;
      this._canvas.height = window.innerHeight;
    }

    _onCursorMove(cursorFrame) {
      debug("onCursorMove", cursorFrame);
      if (this.props.onCursorMove) {
        this.props.onCursorMove(cursorFrame);
      }

      // cursorFrame row and column seem to be swapped
      // https://github.com/zeit/hyper/blob/8733ecc84ac63c49f82bba868bbd8dcb6e27455b/lib/components/term.js#L177
      this._cursor.x = cursorFrame.x;
      this._cursor.y = cursorFrame.y;
      this._cursor.col = cursorFrame.row;
      this._cursor.row = cursorFrame.col;
      this._cellWidth = cursorFrame.width;
      this._cellHeight = cursorFrame.height;
    }

    _updateCurrentLine() {
      this._line = this._getCurrentLine();
      this._prevCursor.row = this._cursor.row;
      this._prevCursor.col = this._cursor.col;
    }

    _getCurrentLine() {
      this._term.selectLines(this._cursor.row, this._cursor.row);
      const line = this._term.getSelection();
      this._term.clearSelection();
      return line;
    }

    _processLineChange() {
      const line = this._getCurrentLine();
      let ii = 0;
      if (this._prevCursor.row === this._cursor.row) {
        for (var i = 0; i < this._line.length; i++) {
          if (this._line.charAt(i) == line.charAt(ii)) {
            ii++;
          } else {
            // this character is missing from the terminal line
            // it must have been deleted
            this._spawnLetter(
              this._line.charAt(i),
              i * this._cellWidth,
              this._cursor.y,
              {
                vx:
                  Math.random() * config.horizontalMaxVelocity * 
                  (this._prevCursor.col == this._cursor.col ? 1 : -1),
                vr: Math.random() * config.angularMaxVelocity
              }
            );
          }
        }
      }
      this._updateCurrentLine();
    }

    _onData(data) {
      if (this.props.onData) this.props.onData(data);
      debug("data", data);

      const isDelete = data === "\u001B[3~";
      const isBackspace = data === "\u007F";

      if (!isDelete && !isBackspace) {
        this._delayedCallback(() => this._updateCurrentLine(), 3);
        return;
      }

      // Some actions do not trigger onCursorMove, even though the data changed
      // so we need to trigger the _processLineChange manually
      // We delay its execution for 3 frames, to wait for the terminal line to update
      this._delayedCallback(() => this._processLineChange(), 3);
    }

    _delayedCallback(callback, framesToWait) {
      let frameCount = framesToWait || 0;
      window.requestAnimationFrame(() => {
        if (frameCount === 0) {
          callback();
        } else {
          this._delayedCallback(callback, frameCount - 1);
        }
      });
    }

    render() {
      return React.createElement(
        Term,
        Object.assign({}, this.props, {
          onDecorated: this._onDecorated,
          onCursorMove: this._onCursorMove,
          onData: this._onData
        })
      );
    }

    componentWillUnmount() {
      document.body.removeChild(this._canvas);
    }
  };
};
