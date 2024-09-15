/*
MIT License

Copyright (c) 2017 Pavel Dobryakov

Modified by Secret Weapons and Angelos Angelopoulos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

"use strict";

const canvas = document.getElementsByTagName("canvas")[0];
resizeCanvas();

var iter_mod = 2;

let config = {
    SIM_SPEED: 1.0,
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 256,
    DENSITY_DISSIPATION: 0.0,
    VELOCITY_DISSIPATION: 0.0,
    PRESSURE: 0.6,
    PRESSURE_ITERATIONS: 20,
    CURL: 30,
    SPLAT_RADIUS: 0.25,
    SPLAT_FORCE: 6000,
    PAUSED: false,
    COLOR: "White",
    COLOR_INTENSITY: 100,
    VORTEX_STRENGTH: 0.0,
};
let gui;
let guiControllers = {};

function pointerPrototype() {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    this.color = [30, 0, 300];
}

let pointers = [];
let splatStack = [];
pointers.push(new pointerPrototype());

const { gl, ext } = getWebGLContext(canvas);

if (!ext.supportLinearFiltering) {
    config.DYE_RESOLUTION = 512;
}

startGUI();

function getWebGLContext(canvas) {
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };

    let gl = canvas.getContext("webgl2", params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
        gl.getExtension("EXT_color_buffer_float");
        supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
    } else {
        halfFloat = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const halfFloatTexType = gl.FLOAT;
    let formatRGBA;
    let formatRG;
    let formatR;

    if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    return {
        gl,
        ext: {
            formatRGBA,
            formatRG,
            formatR,
            halfFloatTexType,
            supportLinearFiltering,
        },
    };
}

function getSupportedFormat(gl, internalFormat, format, type) {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        switch (internalFormat) {
            case gl.R16F:
                return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F:
                return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default:
                return null;
        }
    }

    return {
        internalFormat,
        format,
    };
}

function supportRenderTextureFormat(gl, internalFormat, format, type) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status == gl.FRAMEBUFFER_COMPLETE;
}

function startGUI() {
    var gui = new dat.GUI({ width: 300 });
    guiControllers.SIM_SPEED = gui.add(config, "SIM_SPEED", 1.0, 5.0).name("sim speed").step(0.1);
    guiControllers.DYE_RESOLUTION = gui
        .add(config, "DYE_RESOLUTION", { high: 1024, medium: 512, low: 256, "very low": 128 })
        .name("quality")
        .onFinishChange(initFramebuffers);
    guiControllers.SIM_RESOLUTION = gui
        .add(config, "SIM_RESOLUTION", { 32: 32, 64: 64, 128: 128, 256: 256 })
        .name("sim resolution")
        .onFinishChange(initFramebuffers);
    guiControllers.COLOR = gui.add(config, "COLOR", ["Cyan", "Magenta", "Yellow", "Black"]).name("color");
    guiControllers.COLOR_INTENSITY = gui.add(config, "COLOR_INTENSITY", 0, 100).name("color intensity").step(0.1);
    guiControllers.VORTEX_STRENGTH = gui.add(config, "VORTEX_STRENGTH", 0, 200).name("vortex strength").step(1);
    guiControllers.DENSITY_DISSIPATION = gui.add(config, "DENSITY_DISSIPATION", 0, 4.0).name("density diffusion");
    guiControllers.VELOCITY_DISSIPATION = gui.add(config, "VELOCITY_DISSIPATION", 0, 4.0).name("velocity diffusion");
    guiControllers.PRESSURE = gui.add(config, "PRESSURE", 0.0, 1.0).name("pressure");
    guiControllers.CURL = gui.add(config, "CURL", 0, 50).name("vorticity").step(1);
    guiControllers.SPLAT_RADIUS = gui.add(config, "SPLAT_RADIUS", 0.0, 1.0).name("splat radius").step(0.001);
    guiControllers.PAUSED = gui.add(config, "PAUSED").name("paused").listen();

    gui.add(
        {
            fun: () => {
                splatStack.push(parseInt(Math.random() * 20) + 5);
            },
        },
        "fun"
    ).name("Random splats");
}

function captureScreenshot() {
    let res = getResolution(config.CAPTURE_RESOLUTION);
    let target = createFBO(
        res.width,
        res.height,
        ext.formatRGBA.internalFormat,
        ext.formatRGBA.format,
        ext.halfFloatTexType,
        gl.NEAREST
    );
    render(target);

    let texture = framebufferToTexture(target);
    texture = normalizeTexture(texture, target.width, target.height);

    let captureCanvas = textureToCanvas(texture, target.width, target.height);
    let datauri = captureCanvas.toDataURL();
    downloadURI("fluid.png", datauri);
    URL.revokeObjectURL(datauri);
}

function computeAverageColor() {
    let res = getResolution(config.CAPTURE_RESOLUTION);
    let target = createFBO(
        res.width,
        res.height,
        ext.formatRGBA.internalFormat,
        ext.formatRGBA.format,
        ext.halfFloatTexType,
        gl.NEAREST
    );
    render(target);

    let texture = framebufferToTexture(target);

    let totalR = 0,
        totalG = 0,
        totalB = 0;
    let pixelCount = texture.length / 4; // Divide by 4 because each pixel has RGBA values

    for (let i = 0; i < texture.length; i += 4) {
        totalR += texture[i];
        totalG += texture[i + 1];
        totalB += texture[i + 2];
    }

    let avgR = totalR / pixelCount;
    let avgG = totalG / pixelCount;
    let avgB = totalB / pixelCount;

    // Clean up
    gl.deleteFramebuffer(target.fbo);
    gl.deleteTexture(target.texture);

    return {
        r: Math.round(avgR * 255),
        g: Math.round(avgG * 255),
        b: Math.round(avgB * 255),
    };
}

function computeColorVariance() {
    let res = getResolution(config.CAPTURE_RESOLUTION);
    let target = createFBO(
        res.width,
        res.height,
        ext.formatRGBA.internalFormat,
        ext.formatRGBA.format,
        ext.halfFloatTexType,
        gl.NEAREST
    );
    render(target);

    let texture = framebufferToTexture(target);

    let sumR = 0, sumG = 0, sumB = 0;
    let sumR2 = 0, sumG2 = 0, sumB2 = 0;
    let pixelCount = texture.length / 4;

    for (let i = 0; i < texture.length; i += 4) {
        sumR += texture[i];
        sumG += texture[i + 1];
        sumB += texture[i + 2];
        sumR2 += texture[i] * texture[i];
        sumG2 += texture[i + 1] * texture[i + 1];
        sumB2 += texture[i + 2] * texture[i + 2];
    }

    let meanR = sumR / pixelCount;
    let meanG = sumG / pixelCount;
    let meanB = sumB / pixelCount;

    let varianceR = (sumR2 / pixelCount) - (meanR * meanR);
    let varianceG = (sumG2 / pixelCount) - (meanG * meanG);
    let varianceB = (sumB2 / pixelCount) - (meanB * meanB);

    // Clean up
    gl.deleteFramebuffer(target.fbo);
    gl.deleteTexture(target.texture);

    return {
        r: Math.round(varianceR * 255 * 255),
        g: Math.round(varianceG * 255 * 255),
        b: Math.round(varianceB * 255 * 255)
    };
}

function computeColorStandardDeviation() {
    let res = getResolution(config.CAPTURE_RESOLUTION);
    let target = createFBO(
        res.width,
        res.height,
        ext.formatRGBA.internalFormat,
        ext.formatRGBA.format,
        ext.halfFloatTexType,
        gl.NEAREST
    );
    render(target);

    let texture = framebufferToTexture(target);

    let sumR = 0, sumG = 0, sumB = 0;
    let sumR2 = 0, sumG2 = 0, sumB2 = 0;
    let pixelCount = texture.length / 4;

    for (let i = 0; i < texture.length; i += 4) {
        sumR += texture[i];
        sumG += texture[i + 1];
        sumB += texture[i + 2];
        sumR2 += texture[i] * texture[i];
        sumG2 += texture[i + 1] * texture[i + 1];
        sumB2 += texture[i + 2] * texture[i + 2];
    }

    let meanR = sumR / pixelCount;
    let meanG = sumG / pixelCount;
    let meanB = sumB / pixelCount;

    let varianceR = (sumR2 / pixelCount) - (meanR * meanR);
    let varianceG = (sumG2 / pixelCount) - (meanG * meanG);
    let varianceB = (sumB2 / pixelCount) - (meanB * meanB);

    // Calculate standard deviation
    let stdDevR = Math.sqrt(varianceR);
    let stdDevG = Math.sqrt(varianceG);
    let stdDevB = Math.sqrt(varianceB);

    // Clean up
    gl.deleteFramebuffer(target.fbo);
    gl.deleteTexture(target.texture);

    return {
        r: Math.round(stdDevR * 255),
        g: Math.round(stdDevG * 255),
        b: Math.round(stdDevB * 255)
    };
}

function framebufferToTexture(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    let length = target.width * target.height * 4;
    let texture = new Float32Array(length);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, texture);
    return texture;
}

function normalizeTexture(texture, width, height) {
    let result = new Uint8Array(texture.length);
    let id = 0;
    for (let i = height - 1; i >= 0; i--) {
        for (let j = 0; j < width; j++) {
            let nid = i * width * 4 + j * 4;
            result[nid + 0] = clamp01(texture[id + 0]) * 255;
            result[nid + 1] = clamp01(texture[id + 1]) * 255;
            result[nid + 2] = clamp01(texture[id + 2]) * 255;
            result[nid + 3] = clamp01(texture[id + 3]) * 255;
            id += 4;
        }
    }
    return result;
}

function clamp01(input) {
    return Math.min(Math.max(input, 0), 1);
}

function textureToCanvas(texture, width, height) {
    let captureCanvas = document.createElement("canvas");
    let ctx = captureCanvas.getContext("2d");
    captureCanvas.width = width;
    captureCanvas.height = height;

    let imageData = ctx.createImageData(width, height);
    imageData.data.set(texture);
    ctx.putImageData(imageData, 0, 0);

    return captureCanvas;
}

function downloadURI(filename, uri) {
    let link = document.createElement("a");
    link.download = filename;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

class Material {
    constructor(vertexShader, fragmentShaderSource) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = [];
        this.activeProgram = null;
        this.uniforms = [];
    }

    setKeywords(keywords) {
        let hash = 0;
        for (let i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);

        let program = this.programs[hash];
        if (program == null) {
            let fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
            program = createProgram(this.vertexShader, fragmentShader);
            this.programs[hash] = program;
        }

        if (program == this.activeProgram) return;

        this.uniforms = getUniforms(program);
        this.activeProgram = program;
    }

    bind() {
        gl.useProgram(this.activeProgram);
    }
}

class Program {
    constructor(vertexShader, fragmentShader) {
        this.uniforms = {};
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
    }

    bind() {
        gl.useProgram(this.program);
    }
}

function createProgram(vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.trace(gl.getProgramInfoLog(program));

    return program;
}

function getUniforms(program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
}

function compileShader(type, source, keywords) {
    source = addKeywords(source, keywords);

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.trace(gl.getShaderInfoLog(shader));

    return shader;
}

function addKeywords(source, keywords) {
    if (keywords == null) return source;
    let keywordsString = "";
    keywords.forEach((keyword) => {
        keywordsString += "#define " + keyword + "\n";
    });
    return keywordsString + source;
}

const vortexShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform float uStrength;
uniform vec2 uCenter;
uniform vec2 texelSize;

void main() {
    vec2 coord = vUv - uCenter;
    float distance = length(coord);
    
    // Create inward swirl
    vec2 vortexVelocity = vec2(-coord.y, coord.x);
    
    // Normalize and apply strength
    vortexVelocity = normalize(vortexVelocity) * uStrength;
    
    // Adjust strength based on distance from center for a more natural look
    float strengthMultiplier = smoothstep(0.0, 0.5, distance);
    vortexVelocity *= strengthMultiplier;

    // Add a slight inward pull
    vec2 inwardPull = -normalize(coord) * uStrength * 0.1;
    vortexVelocity += inwardPull;

    gl_FragColor = vec4(vortexVelocity, 0.0, 1.0);
}
`
);

const vortexCombinationShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uVortexVelocity;
uniform float uBlendFactor;

void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec2 vortexVelocity = texture2D(uVortexVelocity, vUv).xy;
    
    vec2 finalVelocity = mix(velocity, vortexVelocity, uBlendFactor);
    
    gl_FragColor = vec4(finalVelocity, 0.0, 1.0);
}
`
);

function applyVortexForce(strength) {
    let tempVelocity = createFBO(
        velocity.width,
        velocity.height,
        ext.formatRG.internalFormat,
        ext.formatRG.format,
        ext.halfFloatTexType,
        gl.NEAREST
    );

    const vortexProgram = createProgram(baseVertexShader, vortexShader);

    gl.useProgram(vortexProgram);
    gl.uniform2f(gl.getUniformLocation(vortexProgram, "texelSize"), velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1f(gl.getUniformLocation(vortexProgram, "uStrength"), strength);
    gl.uniform2f(gl.getUniformLocation(vortexProgram, "uCenter"), 0.5, 0.5); // Center of the screen

    gl.uniform1i(gl.getUniformLocation(vortexProgram, "uVelocity"), velocity.read.attach(0));
    blit(tempVelocity);

    const combineProgram = createProgram(baseVertexShader, vortexCombinationShader);

    gl.useProgram(combineProgram);
    gl.uniform1i(gl.getUniformLocation(combineProgram, "uVelocity"), velocity.read.attach(0));
    gl.uniform1i(gl.getUniformLocation(combineProgram, "uVortexVelocity"), tempVelocity.attach(1));
    gl.uniform1f(gl.getUniformLocation(combineProgram, "uBlendFactor"), 0.1); // Adjust this value to control how strong the vortex effect is

    blit(velocity.write);
    velocity.swap();

    // Clean up
    gl.deleteFramebuffer(tempVelocity.fbo);
    gl.deleteTexture(tempVelocity.texture);
    gl.deleteProgram(vortexProgram);
    gl.deleteProgram(combineProgram);
}

const baseVertexShader = compileShader(
    gl.VERTEX_SHADER,
    `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`
);

const blurVertexShader = compileShader(
    gl.VERTEX_SHADER,
    `
    precision highp float;

    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform vec2 texelSize;

    void main () {
        vUv = aPosition * 0.5 + 0.5;
        float offset = 1.33333333;
        vL = vUv - texelSize * offset;
        vR = vUv + texelSize * offset;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`
);

const blurShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    uniform sampler2D uTexture;

    uniform sampler2D mixbox_lut;
    #include "mixbox.glsl"

    void main () {
        #if 1
        mixbox_latent sum = mixbox_rgb_to_latent(texture2D(uTexture, vUv).rgb) * 0.333333;
        sum += mixbox_rgb_to_latent(texture2D(uTexture, vL).rgb) * 0.333333;
        sum += mixbox_rgb_to_latent(texture2D(uTexture, vR).rgb) * 0.333333;
        gl_FragColor = vec4(mixbox_latent_to_rgb(sum),1.0);
        #else

        vec3 sum = vec3(texture2D(uTexture, vUv).rgb) * 0.333333;
        sum += vec3(texture2D(uTexture, vL).rgb) * 0.333333;
        sum += vec3(texture2D(uTexture, vR).rgb) * 0.333333;
        gl_FragColor = vec4(vec3(sum),1.0);
        #endif

        
    }
`.replace('#include "mixbox.glsl"', mixbox.glsl())
);

const copyShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`
);

const clearShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`
);

const colorShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;

    uniform vec4 color;

    void main () {
        gl_FragColor = color;
    }
`
);

const checkerboardShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float aspectRatio;

    #define SCALE 25.0

    void main () {
        vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));
        float v = mod(uv.x + uv.y, 2.0);
        v = v * 0.1 + 0.8;
        gl_FragColor = vec4(vec3(v), 1.0);
    }
`
);

const displayShaderSource = `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform sampler2D uDithering;
    uniform vec2 ditherScale;
    uniform vec2 texelSize;

    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;    
        gl_FragColor = vec4(c, 1.0);
    }
`;

const splatShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`
);

const splatShader2 = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    uniform sampler2D mixbox_lut;
    #include "mixbox.glsl"

    void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        float splat = exp(-dot(p, p) / radius);
        vec3 base = texture2D(uTarget, vUv).xyz;
        //gl_FragColor = vec4(mixbox_lerp(vec3(0.051, 0.106, 0.267),base,length(p)<10.0*radius ? 0.0:1.0), 1.0);
        
        gl_FragColor = vec4( length(p)<10.0*radius?  color : base, 1.0);
    }
`.replace('#include "mixbox.glsl"', mixbox.glsl())
);

const advectionShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;

        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
    #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
    #endif
        float decay = 1.0 + dissipation * dt;
        gl_FragColor = result / decay;
    }`,
    ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"]
);

const advectionShader2 = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform vec2 dyeSize;

    uniform float dt;
    uniform float dissipation;

    uniform sampler2D mixbox_lut;
    #include "mixbox.glsl"

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;

        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }


    vec4 bilerp_mixbox(sampler2D sam, vec2 uv, vec2 tsize) {
        vec2 st = uv / tsize - 0.5;

        vec2 iuv = floor(st);
        vec2 fuv = fract(st);

        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

        return mixbox_lerp(mixbox_lerp(a, b, fuv.x), mixbox_lerp(c, d, fuv.x), fuv.y);
        //return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        //vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp_mixbox(uSource, coord, dyeTexelSize);       
        //vec4 result = texture2D(uSource, coord);

        float decay = 1.0 + dissipation * dt;
        gl_FragColor = mixbox_lerp(result,vec4(1,1,1,1),dissipation*dt);
        //gl_FragColor = vec4(result.rgb,1.0);//,vec4(1,1,1,1),dissipation*dt);
    }`.replace('#include "mixbox.glsl"', mixbox.glsl()),
    /*ext.supportLinearFiltering ? null :*/ ["MANUAL_FILTERING"]
);
const divergenceShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;

        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) { L = -C.x; }
        if (vR.x > 1.0) { R = -C.x; }
        if (vT.y > 1.0) { T = -C.y; }
        if (vB.y < 0.0) { B = -C.y; }

        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`
);

const curlShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`
);

const vorticityShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;

        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;

        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`
);

const pressureShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`
);

const gradientSubtractShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`
);

const blit = (() => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return (target, clear = false) => {
        if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        // CHECK_FRAMEBUFFER_STATUS();
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
})();

function CHECK_FRAMEBUFFER_STATUS() {
    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE) console.trace("Framebuffer error: " + status);
}

let dye;
let velocity;
let divergence;
let curl;
let pressure;

let ditheringTexture = createTextureAsync("LDR_LLL1_0.png");

const blurProgram = new Program(blurVertexShader, blurShader);
const copyProgram = new Program(baseVertexShader, copyShader);
const clearProgram = new Program(baseVertexShader, clearShader);
const colorProgram = new Program(baseVertexShader, colorShader);
const checkerboardProgram = new Program(baseVertexShader, checkerboardShader);
const splatProgram = new Program(baseVertexShader, splatShader);
const splatProgram2 = new Program(baseVertexShader, splatShader2);
const advectionProgram = new Program(baseVertexShader, advectionShader);
const advectionProgram2 = new Program(baseVertexShader, advectionShader2);
const divergenceProgram = new Program(baseVertexShader, divergenceShader);
const curlProgram = new Program(baseVertexShader, curlShader);
const vorticityProgram = new Program(baseVertexShader, vorticityShader);
const pressureProgram = new Program(baseVertexShader, pressureShader);
const gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);

const displayMaterial = new Material(baseVertexShader, displayShaderSource);

function initFramebuffers() {
    let simRes = getResolution(config.SIM_RESOLUTION);
    let dyeRes = getResolution(config.DYE_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const rg = ext.formatRG;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    if (dye == null) dye = createDoubleFBO(dyeRes.width, dyeRes.height, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.LINEAR);
    //dye = createDoubleFBO(dyeRes.width, dyeRes.height, gl.RGBA16F,gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    else dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, gl.LINEAR);

    if (velocity == null)
        velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    else
        velocity = resizeDoubleFBO(
            velocity,
            simRes.width,
            simRes.height,
            rg.internalFormat,
            rg.format,
            texType,
            filtering
        );

    divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);

    drawColor(dye.read, { r: 1, g: 1, b: 1 });
}

function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let texelSizeX = 1.0 / w;
    let texelSizeY = 1.0 / h;

    return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX,
        texelSizeY,
        attach(id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        },
    };
}

function createDoubleFBO(w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(w, h, internalFormat, format, type, param);

    return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
            return fbo1;
        },
        set read(value) {
            fbo1 = value;
        },
        get write() {
            return fbo2;
        },
        set write(value) {
            fbo2 = value;
        },
        swap() {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        },
    };
}

function resizeFBO(target, w, h, internalFormat, format, type, param) {
    let newFBO = createFBO(w, h, internalFormat, format, type, param);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(newFBO);
    return newFBO;
}

function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
    if (target.width == w && target.height == h) return target;
    target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
    target.write = createFBO(w, h, internalFormat, format, type, param);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
}

function createTextureAsync(url) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));

    let obj = {
        texture,
        width: 1,
        height: 1,
        attach(id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        },
    };

    let image = new Image();
    image.onload = () => {
        obj.width = image.width;
        obj.height = image.height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    };
    image.src = url;

    return obj;
}

function updateKeywords() {
    let displayKeywords = [];
    displayMaterial.setKeywords(displayKeywords);
}

updateKeywords();
initFramebuffers();

let lastUpdateTime = Date.now();
let colorUpdateTimer = 0.0;
update();
splatStack.push(50);

function update() {
    const dt = calcDeltaTime();
    if (resizeCanvas()) initFramebuffers();
    applyInputs();
    if (!config.PAUSED) step(dt);
    render(null);
    requestAnimationFrame(update);
}

function calcDeltaTime() {
    let now = Date.now();
    let dt = (now - lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastUpdateTime = now;
    return dt;
}

function resizeCanvas() {
    let width = scaleByPixelRatio(canvas.clientWidth);
    let height = scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width != width || canvas.height != height) {
        canvas.width = width;
        canvas.height = height;
        return true;
    }
    return false;
}

function applyInputs() {
    if (splatStack.length > 0) multipleSplats(splatStack.pop());

    pointers.forEach((p) => {
        if (p.moved) {
            p.moved = false;
            splatPointer(p);
        }
    });
}

function step(dt) {
    dt = dt * config.SIM_SPEED;

    gl.disable(gl.BLEND);

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    // Apply the continuous vortex effect
    applyVortexForce(config.VORTEX_STRENGTH * dt * 300);

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
    }

    gradienSubtractProgram.bind();
    gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering)
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    let velocityId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    advectionProgram2.bind();
    gl.uniform2f(advectionProgram2.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    /*if (!ext.supportLinearFiltering)*/
    gl.uniform2f(advectionProgram2.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);

    gl.uniform1i(advectionProgram2.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram2.uniforms.uSource, dye.read.attach(1));

    gl.uniform2f(advectionProgram2.uniforms.dyeSize, dye.width, dye.height);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mixbox.lutTexture(gl));
    gl.uniform1i(gl.getUniformLocation(advectionProgram2.program, "mixbox_lut"), 2);

    gl.uniform1f(advectionProgram2.uniforms.dt, dt);
    // gl.uniform1f(advectionProgram2.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();

    blur(dye.read, dye.write, 1);
    //dye.swap();
}

function render(target) {
    drawDisplay(target);
}

function drawColor(target, color) {
    colorProgram.bind();
    gl.uniform4f(colorProgram.uniforms.color, color.r, color.g, color.b, 1);
    blit(target);
}

function drawCheckerboard(target) {
    checkerboardProgram.bind();
    gl.uniform1f(checkerboardProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    blit(target);
}

function drawDisplay(target) {
    let width = target == null ? gl.drawingBufferWidth : target.width;
    let height = target == null ? gl.drawingBufferHeight : target.height;

    displayMaterial.bind();
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    blit(target);
}

function blur(target, temp, iterations) {
    blurProgram.bind();

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mixbox.lutTexture(gl));
    gl.uniform1i(gl.getUniformLocation(blurProgram.program, "mixbox_lut"), 1);

    for (let i = 0; i < iterations; i++) {
        gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
        gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
        blit(temp);

        gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
        gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
        blit(target);
    }
}

function splatPointer(pointer) {
    let dx = pointer.deltaX * config.SPLAT_FORCE;
    let dy = pointer.deltaY * config.SPLAT_FORCE;
    splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
}

function multipleSplats(amount) {
    for (let i = 0; i < amount; i++) {
        const color = generateColor();
        const x = Math.random();
        const y = Math.random();
        const dx = 1000 * (Math.random() - 0.5);
        const dy = 1000 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
    }
}

function splat(x, y, dx, dy, color) {
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
    blit(velocity.write);
    velocity.swap();

    splatProgram2.bind();
    gl.uniform1i(splatProgram2.uniforms.uTarget, dye.read.attach(0));

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mixbox.lutTexture(gl));
    gl.uniform1i(gl.getUniformLocation(splatProgram2.program, "mixbox_lut"), 1);

    gl.uniform1f(splatProgram2.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram2.uniforms.point, x, y);
    gl.uniform1f(splatProgram2.uniforms.radius, correctRadius(config.SPLAT_RADIUS / 100.0));
    gl.uniform3f(splatProgram2.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
}

function correctRadius(radius) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) radius *= aspectRatio;
    return radius;
}

canvas.addEventListener("mousedown", (e) => {
    let posX = scaleByPixelRatio(e.offsetX);
    let posY = scaleByPixelRatio(e.offsetY);
    let pointer = pointers.find((p) => p.id == -1);
    if (pointer == null) pointer = new pointerPrototype();
    updatePointerDownData(pointer, -1, posX, posY);

    splatPointer(pointer);
});

canvas.addEventListener("mousemove", (e) => {
    let pointer = pointers[0];
    if (!pointer.down) return;
    let posX = scaleByPixelRatio(e.offsetX);
    let posY = scaleByPixelRatio(e.offsetY);
    updatePointerMoveData(pointer, posX, posY);

    splatPointer(pointer);
});

window.addEventListener("mouseup", () => {
    updatePointerUpData(pointers[0]);
});

function clearScreen() {
    gl.disable(gl.BLEND);
    colorProgram.bind();
    gl.uniform4f(colorProgram.uniforms.color, 1, 1, 1, 1); // Set color to white (1, 1, 1, 1)
    blit(dye.write);
    dye.swap();
}

// Modify the existing keydown event listener
window.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") config.PAUSED = !config.PAUSED;
    if (e.key === " ") splatStack.push(parseInt(Math.random() * 20) + 5);
    if (e.code === "KeyC") clearScreen();
    if (e.code === "KeyS") captureScreenshot();
});

function updatePointerDownData(pointer, id, posX, posY) {
    iter_mod = 3;
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor();
}

function updatePointerMoveData(pointer, posX, posY) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

function updatePointerUpData(pointer) {
    pointer.down = false;
}

function correctDeltaX(delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
}

function correctDeltaY(delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
}

function generateColor() {
    let color;
    let intensity = config.COLOR_INTENSITY / 100; // Convert percentage to 0-1 range

    switch (config.COLOR) {
        case "Cyan":
            color = { r: 1 - intensity, g: 1, b: 1 };
            break;
        case "Magenta":
            color = { r: 1, g: 1 - intensity, b: 1 };
            break;
        case "Yellow":
            color = { r: 1, g: 1, b: 1 - intensity };
            break;
        case "Black":
            color = { r: 1 - intensity, g: 1 - intensity, b: 1 - intensity };
            break;
        default:
            color = { r: 1, g: 1, b: 1 }; // White as fallback
    }
    return color;
}

function HSVtoRGB(h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            (r = v), (g = t), (b = p);
            break;
        case 1:
            (r = q), (g = v), (b = p);
            break;
        case 2:
            (r = p), (g = v), (b = t);
            break;
        case 3:
            (r = p), (g = q), (b = v);
            break;
        case 4:
            (r = t), (g = p), (b = v);
            break;
        case 5:
            (r = v), (g = p), (b = q);
            break;
    }

    return {
        r,
        g,
        b,
    };
}

function normalizeColor(input) {
    let output = {
        r: input.r / 255,
        g: input.g / 255,
        b: input.b / 255,
    };
    return output;
}

function wrap(value, min, max) {
    let range = max - min;
    if (range == 0) return min;
    return ((value - min) % range) + min;
}

function getResolution(resolution) {
    let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

    let min = Math.round(resolution);
    let max = Math.round(resolution * aspectRatio);

    if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
    else return { width: min, height: max };
}

function getTextureScale(texture, width, height) {
    return {
        x: width / texture.width,
        y: height / texture.height,
    };
}

function scaleByPixelRatio(input) {
    let pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
}

function hashCode(s) {
    if (s.length == 0) return 0;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

class FluidSimulationWebSocket {
    constructor(port) {
        this.socket = new WebSocket(`ws://localhost:${port}`);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onerror = this.onError.bind(this);
        this.socket.onclose = this.onClose.bind(this);
    }

    onOpen() {
        console.log("Connected to WebSocket server");
    }

    onMessage(event) {
        const data = JSON.parse(event.data);
        console.log("Received command:", data);

        switch (data.type) {
            case "updateConfig":
                this.performConfigUpdate(data.key, data.value);
                break;
            case "clear":
                this.performClear();
                break;
            case "centerSplat":
                this.performCenterSplat();
                break;
            case "computeAverageColor":
                this.performComputeAverageColor();
                break;
            case "computeColorVariance":
                this.performComputeColorVariance();
                break;
            case "computeColorStandardDeviation":
                this.performComputeColorStandardDeviation();
                break;
            default:
                console.log("Unknown command type:", data.type);
        }
    }

    onError(error) {
        console.error("WebSocket error:", error);
    }

    onClose() {
        console.log("Disconnected from WebSocket server");
    }

    performConfigUpdate(key, value) {
        if (key in config) {
            //config[key] = value;
            guiControllers[key].setValue(value);
        } else {
            console.warn(`Received update for unknown config key: ${key}`);
        }
    }

    performClear() {
        clearScreen();
    }

    performCenterSplat() {
        console.log("Performing center splat");
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const color = generateColor();
        const dx = 0;
        const dy = 0;
        splat(centerX / canvas.width, centerY / canvas.height, dx, dy, color);
    }

    performComputeAverageColor() {
        const avgColor = computeAverageColor();
        console.log("Computed average color:", avgColor);
        this.socket.send(
            JSON.stringify({
                type: "averageColor",
                color: avgColor,
            })
        );
    }

    performComputeColorVariance() {
        const colorVariance = computeColorVariance();
        console.log("Computed color variance:", colorVariance);
        this.socket.send(
            JSON.stringify({
                type: "colorVariance",
                variance: colorVariance,
            })
        );
    }

    performComputeColorStandardDeviation() {
        const colorStdDev = computeColorStandardDeviation();
        console.log("Computed color standard deviation:", colorStdDev);
        this.socket.send(
            JSON.stringify({
                type: "colorStandardDeviation",
                stdDev: colorStdDev,
            })
        );
    }
}

// Usage:
const urlParams = new URLSearchParams(window.location.search);
const port = parseInt(urlParams.get('port')) || 8030;
const fluidSimWebSocket = new FluidSimulationWebSocket(port,);
