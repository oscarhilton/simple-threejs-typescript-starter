#include "../shaders/lygia/color/palette/heatmap.glsl"

uniform vec3 targetColor;
varying vec2 vUv;

void main() {
    gl_FragColor = vec4(targetColor, 1.0);
}