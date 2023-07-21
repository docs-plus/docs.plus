// rollup.config.js
import typescript from "rollup-plugin-typescript2";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import babel from "@rollup/plugin-babel";
import autoExternal from "rollup-plugin-auto-external";
import sourcemaps from "rollup-plugin-sourcemaps";
import sizes from "@atomico/rollup-plugin-sizes";
import pkg from "./package.json" assert { type: "json" };

const config = {
  external: [/@tiptap\/core\/.*/, /@tiptap\/pm\/.*/],
  input: "src/index.ts",
  output: [
    {
      name: pkg.name,
      file: pkg.umd,
      format: "umd",
      sourcemap: true,
    },
    {
      name: pkg.name,
      file: pkg.main,
      format: "cjs",
      sourcemap: true,
      exports: "auto",
    },
    {
      name: pkg.name,
      file: pkg.module,
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    autoExternal({
      packagePath: "./package.json",
    }),
    sourcemaps(),
    resolve(),
    commonjs(),
    babel({
      babelHelpers: "bundled",
      exclude: "../../node_modules/**",
    }),
    sizes(),
    typescript({
      tsconfig: "../../tsconfig.json",
      tsconfigOverride: {
        compilerOptions: {
          declaration: true,
          paths: {
            "@docsplus/*": ["packages/*/src"],
          },
        },
      },
      include: null,
    }),
    // json(),
    // terser(),
  ],
};

export default config;
