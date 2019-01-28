/* eslint-env node, es6 */
// @remove-on-eject-begin
/**
 * Portions of this source code file are from create-react-app, used under the
 * following MIT license:
 *
 * Copyright (c) 2013-present, Facebook, Inc.
 * https://github.com/facebook/create-react-app
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @remove-on-eject-end

const fs = require('fs');
const path = require('path');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin-alt');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const eslintFormatter = require('react-dev-utils/eslintFormatter');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const typescriptFormatter = require('react-dev-utils/typescriptFormatter');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const LessPluginRi = require('resolution-independence');
const resolve = require('resolve');
const TerserPlugin = require('terser-webpack-plugin');
const {DefinePlugin, EnvironmentPlugin} = require('webpack');
const {optionParser: app, GracefulFsPlugin, ILibPlugin, WebOSMetaPlugin} = require('@enact/dev-utils');

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = function(env) {
	process.chdir(app.context);

	// Load applicable .env files into environment variables.
	require('./dotenv').load(app.context);

	// Sets the browserslist default fallback set of browsers to the Enact default browser support list.
	app.setEnactTargetsAsDefault();

	// Check if TypeScript is setup
	const useTypeScript = fs.existsSync('tsconfig.json');

	process.env.NODE_ENV = env || process.env.NODE_ENV;
	const isEnvProduction = process.env.NODE_ENV === 'production';

	// Source maps are resource heavy and can cause out of memory issue for large source files.
	// By default, sourcemaps will be used in development, however it can universally forced
	// on or off by setting the GENERATE_SOURCEMAP environment variable.
	const GENERATE_SOURCEMAP = process.env.GENERATE_SOURCEMAP || (isEnvProduction ? 'false' : 'true');
	const shouldUseSourceMap = GENERATE_SOURCEMAP !== 'false';

	// common function to get style loaders
	const getStyleLoaders = (cssLoaderOptions = {}, preProcessor) => {
		// Multiple styling-support features are used together, bottom-to-top.
		// An optonal preprocessor, like "less loader", compiles LESS syntax into CSS.
		// "postcss" loader applies autoprefixer to our CSS.
		// "css" loader resolves paths in CSS and adds assets as dependencies.
		// `MiniCssExtractPlugin` takes the resulting CSS and puts it into an
		// external file in our build process. If you use code splitting, any async
		// bundles will stilluse the "style" loader inside the async code so CSS
		// from them won't be in the main CSS file.
		const loaders = [
			MiniCssExtractPlugin.loader,
			{
				loader: require.resolve('css-loader'),
				options: Object.assign(
					{importLoaders: preProcessor ? 2 : 1, sourceMap: shouldUseSourceMap},
					cssLoaderOptions.modules && {getLocalIdent: getCSSModuleLocalIdent},
					cssLoaderOptions
				)
			},
			{
				// Options for PostCSS as we reference these options twice
				// Adds vendor prefixing based on your specified browser support in
				// package.json
				loader: require.resolve('postcss-loader'),
				options: {
					// https://webpack.js.org/guides/migrating/#complex-options
					ident: 'postcss',
					sourceMap: shouldUseSourceMap,
					plugins: () => [
						// Fix and adjust for known flexbox issues
						// See https://github.com/philipwalton/flexbugs
						require('postcss-flexbugs-fixes'),
						// Support @global-import syntax to import css in a global context.
						require('postcss-global-import'),
						// Transpile stage-3 CSS standards based on browserslist targets.
						// See https://preset-env.cssdb.org/features for supported features.
						// Includes support for targetted auto-prefixing.
						require('postcss-preset-env')({
							autoprefixer: {
								flexbox: 'no-2009',
								remove: false
							},
							stage: 3,
							features: {'custom-properties': false}
						})
					]
				}
			}
		];
		if (preProcessor) {
			loaders.push(preProcessor);
		}
		return loaders;
	};

	const getLessStyleLoaders = cssLoaderOptions =>
		getStyleLoaders(cssLoaderOptions, {
			loader: require.resolve('less-loader'),
			options: {
				modifyVars: Object.assign({__DEV__: !isEnvProduction}, app.accent),
				sourceMap: shouldUseSourceMap,
				// If resolution independence options are specified, use the LESS plugin.
				plugins: app.ri ? [new LessPluginRi(app.ri)] : []
			}
		});

	return {
		mode: isEnvProduction ? 'production' : 'development',
		// Don't attempt to continue if there are any errors.
		bail: true,
		// Use source maps during development builds or when specified by GENERATE_SOURCEMAP
		devtool: shouldUseSourceMap && (isEnvProduction ? 'source-map' : 'cheap-module-source-map'),
		// These are the "entry points" to our application.
		entry: {
			main: [
				// Include any polyfills needed for the target browsers.
				require.resolve('./polyfills'),
				// This is your app's code
				app.context
			]
		},
		output: {
			// The build output directory.
			path: path.resolve('./dist'),
			// Generated JS file names (with nested folders).
			// There will be one main bundle, and one file per asynchronous chunk.
			// We don't currently advertise code splitting but Webpack supports it.
			filename: '[name].js',
			// There are also additional JS chunk files if you use code splitting.
			chunkFilename: 'chunk.[name].js',
			// Add /* filename */ comments to generated require()s in the output.
			pathinfo: !isEnvProduction
		},
		resolve: {
			// These are the reasonable defaults supported by the React/ES6 ecosystem.
			extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
			// Allows us to specify paths to check for module resolving.
			modules: [path.resolve('./node_modules'), 'node_modules'],
			alias: {
				// Support ilib shorthand alias for ilib modules
				ilib: '@enact/i18n/ilib/lib'
			}
		},
		// @remove-on-eject-begin
		// Resolve loaders (webpack plugins for CSS, images, transpilation) from the
		// directory of `@enact/cli` itself rather than the project directory.
		resolveLoader: {
			modules: [path.resolve(__dirname, '../node_modules'), path.resolve('./node_modules')]
		},
		// @remove-on-eject-end
		module: {
			rules: [
				// First, run the linter.
				// It's important to do this before Babel processes the JS.
				{
					test: /\.(js|jsx)$/,
					enforce: 'pre',
					include: process.cwd(),
					exclude: /node_modules/,
					loader: require.resolve('eslint-loader'),
					// Point ESLint to our predefined config.
					options: {
						formatter: eslintFormatter,
						eslintPath: require.resolve('eslint'),
						// @remove-on-eject-begin
						baseConfig: {
							extends: [require.resolve('eslint-config-enact')]
						},
						useEslintrc: false,
						// @remove-on-eject-end
						cache: true
					}
				},
				{
					// "oneOf" will traverse all following loaders until one will
					// match the requirements. When no loader matches it will fall
					// back to the "file" loader at the end of the loader list.
					oneOf: [
						// Process JS with Babel.
						{
							test: /\.(js|jsx|ts|tsx)$/,
							exclude: /node_modules.(?!@enact)/,
							use: [
								{
									loader: require.resolve('babel-loader'),
									options: {
										// @remove-on-eject-begin
										extends: path.join(__dirname, '.babelrc.js'),
										babelrc: false,
										// @remove-on-eject-end
										// This is a feature of `babel-loader` for webpack (not Babel itself).
										// It enables caching results in ./node_modules/.cache/babel-loader/
										// directory for faster rebuilds.
										cacheDirectory: !isEnvProduction,
										cacheCompression: false,
										highlightCode: true,
										compact: isEnvProduction
									}
								}
							]
						},
						// CSS within @enact-scoped packages have already been precompiled from LESS to CSS with
						// desired resolution independence applied.
						{
							test: /node_modules(\\|\/).*\1?@enact\1.*\.css/,
							use: getStyleLoaders({modules: true})
						},
						// Style-based rules support both LESS and CSS format, with *.module.* extension format
						// to designate CSS modular support.
						// See comments within `getStyleLoaders` for details on the stylesheet loader chains and
						// options used at each level of processing.
						{
							test: /\.module\.css$/,
							// Temporarily use LESS loader for CSS to apply resolution independence.
							use: getLessStyleLoaders({modules: true})
						},
						{
							test: /\.css$/,
							// The `forceCSSModules` Enact build option can be set true to universally apply
							// modular CSS support.
							// Temporarily use LESS loader for CSS to apply resolution independence.
							use: getLessStyleLoaders({modules: app.forceCSSModules}),
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true
						},
						{
							test: /\.module\.less$/,
							use: getLessStyleLoaders({modules: true})
						},
						{
							test: /\.less$/,
							use: getLessStyleLoaders({modules: app.forceCSSModules}),
							sideEffects: true
						},
						// "file" loader handles on all files not caught by the above loaders.
						// When you `import` an asset, you get its output filename and the file
						// is copied during the build process.
						{
							loader: require.resolve('file-loader'),
							// Exclude `js` files to keep "css" loader working as it injects
							// its runtime that would otherwise be processed through "file" loader.
							// Also exclude `html` and `json` extensions so they get processed
							// by webpacks internal loaders.
							exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
							options: {
								name: '[path][name].[ext]'
							}
						}
						// ** STOP ** Are you adding a new loader?
						// Make sure to add the new loader(s) before the "file" loader.
					]
				}
			]
		},
		// Target app to build for a specific environment (default 'web')
		target: app.environment,
		// Optional configuration for polyfilling NodeJS built-ins.
		node: app.nodeBuiltins,
		performance: {
			hints: false
		},
		optimization: {
			minimize: isEnvProduction,
			// These are only used in production mode
			minimizer: [
				new TerserPlugin({
					terserOptions: {
						parse: {
							// we want uglify-js to parse ecma 8 code. However, we don't want it
							// to apply any minfication steps that turns valid ecma 5 code
							// into invalid ecma 5 code. This is why the 'compress' and 'output'
							// sections only apply transformations that are ecma 5 safe
							// https://github.com/facebook/create-react-app/pull/4234
							ecma: 8
						},
						compress: {
							ecma: 5,
							warnings: false,
							// Disabled because of an issue with Uglify breaking seemingly valid code:
							// https://github.com/facebook/create-react-app/issues/2376
							// Pending further investigation:
							// https://github.com/mishoo/UglifyJS2/issues/2011
							comparisons: false,
							// Disabled because of an issue with Terser breaking valid code:
							// https://github.com/facebook/create-react-app/issues/5250
							// Pending futher investigation:
							// https://github.com/terser-js/terser/issues/120
							inline: 2
						},
						output: {
							ecma: 5,
							comments: false,
							// Turned on because emoji and regex is not minified properly using default
							// https://github.com/facebook/create-react-app/issues/2488
							ascii_only: true
						}
					},
					// Use multi-process parallel running to improve the build speed
					// Default number of concurrent runs: os.cpus().length - 1
					parallel: true,
					// Enable file caching
					cache: true,
					sourceMap: shouldUseSourceMap
				}),
				new OptimizeCSSAssetsPlugin({
					cssProcessorOptions: {
						calc: false,
						map: shouldUseSourceMap && {
							// `inline: false` forces the sourcemap to be output into a
							// separate file
							inline: false,
							// `annotation: true` appends the sourceMappingURL to the end of
							// the css file, helping the browser find the sourcemap
							annotation: true
						}
					}
				})
			]
		},
		plugins: [
			// Generates an `index.html` file with the js and css tags injected.
			new HtmlWebpackPlugin({
				// Title can be specified in the package.json enact options or will
				// be determined automatically from any appinfo.json files discovered.
				title: app.title || '',
				inject: 'body',
				template: app.template || path.join(__dirname, 'html-template.ejs'),
				xhtml: true,
				minify: isEnvProduction && {
					removeComments: true,
					collapseWhitespace: false,
					removeRedundantAttributes: true,
					useShortDoctype: true,
					removeEmptyAttributes: true,
					removeStyleLinkTypeAttributes: true,
					keepClosingSlash: true,
					minifyJS: true,
					minifyCSS: true,
					minifyURLs: true
				}
			}),
			// Make NODE_ENV environment variable available to the JS code, for example:
			// if (process.env.NODE_ENV === 'production') { ... }.
			// It is absolutely essential that NODE_ENV was set to production here.
			// Otherwise React will be compiled in the very slow development mode.
			new DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(isEnvProduction ? 'production' : 'development')
			}),
			// Inject prefixed environment variables within code, when used
			new EnvironmentPlugin(Object.keys(process.env).filter(key => /^REACT_APP_/.test(key))),
			// Note: this won't work without MiniCssExtractPlugin.loader in `loaders`.
			new MiniCssExtractPlugin({
				filename: '[name].css',
				chunkFilename: 'chunk.[name].css'
			}),
			// Ensure correct casing in module filepathes
			new CaseSensitivePathsPlugin(),
			// If you require a missing module and then `npm install` it, you still have
			// to restart the development server for Webpack to discover it. This plugin
			// makes the discovery automatic so you don't have to restart.
			// See https://github.com/facebookincubator/create-react-app/issues/186
			!isEnvProduction && new WatchMissingNodeModulesPlugin('./node_modules'),
			// Switch the internal NodeOutputFilesystem to use graceful-fs to avoid
			// EMFILE errors when hanndling mass amounts of files at once, such as
			// what happens when using ilib bundles/resources.
			new GracefulFsPlugin(),
			// Automatically configure iLib library within @enact/i18n. Additionally,
			// ensure the locale data files and the resource files are copied during
			// the build to the output directory.
			new ILibPlugin(),
			// Automatically detect ./appinfo.json and ./webos-meta/appinfo.json files,
			// and parses any to copy over any webOS meta assets at build time.
			new WebOSMetaPlugin(),
			// TypeScript type checking
			useTypeScript &&
				new ForkTsCheckerWebpackPlugin({
					typescript: resolve.sync('typescript', {
						basedir: 'node_modules'
					}),
					async: false,
					checkSyntacticErrors: true,
					tsconfig: 'tsconfig.json',
					compilerOptions: {
						module: 'esnext',
						moduleResolution: 'node',
						resolveJsonModule: true,
						isolatedModules: true,
						noEmit: true,
						jsx: 'preserve'
					},
					reportFiles: [
						'**',
						'!**/*.json',
						'!**/__tests__/**',
						'!**/?(*.)(spec|test).*',
						'!**/*-specs.*',
						'!**/src/setupProxy.*',
						'!**/src/setupTests.*'
					],
					watch: app.context,
					silent: true,
					formatter: typescriptFormatter
				})
		].filter(Boolean)
	};
};